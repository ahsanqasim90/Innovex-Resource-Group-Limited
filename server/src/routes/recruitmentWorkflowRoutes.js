import crypto from "crypto";
import express from "express";
import Candidate from "../models/Candidate.js";
import Job from "../models/Job.js";
import RecruitmentSubmission, { RECRUITMENT_STAGES } from "../models/RecruitmentSubmission.js";
import { hasPermission } from "../config/permissions.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { uploadCv } from "../middleware/upload.js";
import { logActivity } from "../services/activityLogService.js";
import { extractDocumentText, secureDocumentMeta, structureDocumentReviewText } from "../services/documentIntelligenceService.js";
import { assertDocumentReleased, scanRecruitmentDocument } from "../services/malwareScanService.js";
import { requireFields, validateEmail } from "../utils.js";

const router = express.Router();
const SHARED_STAGES = RECRUITMENT_STAGES.filter((stage) => !["Pending admin review", "Changes requested", "Admin rejected"].includes(stage));
const ADMIN_ONLY_STAGES = new Set(RECRUITMENT_STAGES.filter((stage) => stage !== "Withdrawn"));

router.use(protect, requirePermission("recruitmentPipeline.view"));

function actor(user) {
  return { user: user._id, name: user.name, email: user.email, role: user.role };
}

function isReviewer(user) {
  return hasPermission(user, "recruitmentPipeline.review");
}

function accessFilter(user) {
  if (isReviewer(user)) return {};
  return { $or: [{ "submittedBy.user": user._id }, { stage: { $in: SHARED_STAGES } }] };
}

function clean(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function submissionReference() {
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  return `ATS-${stamp}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
}

async function visibleSubmission(id, user, includeCv = false) {
  const query = RecruitmentSubmission.findOne({ _id: id, ...accessFilter(user) });
  if (includeCv) query.select("+cv.data +cv.extractedText");
  return query.populate("job", "title location salary type shift isActive closingDate reference clientName priority openings");
}

router.get("/overview", async (req, res, next) => {
  try {
    const filter = accessFilter(req.user);
    if (req.query.stage && RECRUITMENT_STAGES.includes(req.query.stage)) filter.stage = req.query.stage;
    if (req.query.job) filter.job = req.query.job;
    if (req.query.owner === "mine") filter["submittedBy.user"] = req.user._id;
    if (req.query.search) {
      const search = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$and = [{ $or: [{ candidateName: search }, { email: search }, { phone: search }, { reference: search }, { currentRole: search }] }];
    }

    const [submissions, vacancies] = await Promise.all([
      RecruitmentSubmission.find(filter)
        .select("-cv.data")
        .populate("job", "title location salary type shift isActive closingDate reference clientName priority openings")
        .sort({ updatedAt: -1 })
        .limit(500)
        .lean(),
      Job.find({ isActive: true, $or: [{ closingDate: null }, { closingDate: { $exists: false } }, { closingDate: { $gte: new Date() } }] })
        .select("+clientName +assignedRecruiters title location salary type shift description requirements closingDate isActive reference priority openings")
        .populate("assignedRecruiters", "name email role")
        .sort({ priority: 1, createdAt: -1 })
        .lean()
    ]);

    const counts = Object.fromEntries(RECRUITMENT_STAGES.map((stage) => [stage, 0]));
    submissions.forEach((item) => { counts[item.stage] = (counts[item.stage] || 0) + 1; });
    res.json({
      submissions,
      vacancies,
      stages: RECRUITMENT_STAGES,
      canReview: isReviewer(req.user),
      stats: {
        visible: submissions.length,
        activeVacancies: vacancies.length,
        awaitingAdmin: counts["Pending admin review"],
        withClient: counts["Client review"],
        interviews: counts["Interview requested"] + counts["Interview scheduled"],
        hired: counts.Hired,
        counts
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const submission = await visibleSubmission(req.params.id, req.user);
    if (!submission) return res.status(404).json({ message: "Candidate submission not found" });
    res.json(submission);
  } catch (error) {
    next(error);
  }
});

router.post("/", requirePermission("recruitmentPipeline.submit"), uploadCv.single("cv"), async (req, res, next) => {
  try {
    requireFields(req.body, ["job", "candidateName", "email", "phone", "recruiterSummary"]);
    validateEmail(req.body.email);
    if (req.body.consentConfirmed !== "true") return res.status(400).json({ message: "Confirm candidate consent before submission" });
    if (!req.file) return res.status(400).json({ message: "Candidate CV is required" });

    const job = await Job.findOne({
      _id: req.body.job,
      isActive: true,
      $or: [{ closingDate: null }, { closingDate: { $exists: false } }, { closingDate: { $gte: new Date() } }]
    });
    if (!job) return res.status(404).json({ message: "Active vacancy not found" });

    const email = clean(req.body.email).toLowerCase();
    const duplicate = await RecruitmentSubmission.findOne({ job: job._id, email, stage: { $nin: ["Admin rejected", "Client rejected", "Withdrawn"] } });
    if (duplicate) {
      return res.status(409).json({ message: `This candidate is already in the pipeline for this vacancy (${duplicate.reference})`, duplicateId: duplicate._id });
    }

    const assignedRecruiter = actor(req.user);
    let candidate = await Candidate.findOne({ email });
    if (!candidate) {
      candidate = await Candidate.create({
        name: clean(req.body.candidateName),
        email,
        phone: clean(req.body.phone),
        city: clean(req.body.location),
        desiredRole: clean(req.body.currentRole || job.title),
        experience: req.body.experienceYears ? `${Number(req.body.experienceYears)} years` : "",
        visaStatus: clean(req.body.rightToWork),
        availability: clean(req.body.noticePeriod),
        payExpectation: clean(req.body.expectedSalary),
        status: "Submitted",
        source: "Recruiter ATS",
        lawfulBasis: "Consent",
        assignedRecruiter,
        cv: await secureDocumentMeta(req.file, req.user)
      });
    }

    const submittedBy = actor(req.user);
    const submission = await RecruitmentSubmission.create({
      reference: submissionReference(),
      job: job._id,
      candidate: candidate._id,
      candidateName: clean(req.body.candidateName),
      email,
      phone: clean(req.body.phone),
      location: clean(req.body.location),
      currentRole: clean(req.body.currentRole),
      experienceYears: req.body.experienceYears === "" ? undefined : Number(req.body.experienceYears),
      currentSalary: clean(req.body.currentSalary),
      expectedSalary: clean(req.body.expectedSalary),
      noticePeriod: clean(req.body.noticePeriod),
      rightToWork: clean(req.body.rightToWork),
      linkedinUrl: clean(req.body.linkedinUrl, 1000),
      recruiterSummary: clean(req.body.recruiterSummary, 5000),
      consentConfirmed: true,
      consentConfirmedAt: new Date(),
      submittedBy,
      assignedRecruiter,
      cv: await secureDocumentMeta(req.file, req.user, { extract: false }),
      timeline: [{ type: "Submission created", toStage: "Pending admin review", note: "Submitted for internal quality review", actor: submittedBy }]
    });

    await logActivity(req, { module: "Recruitment ATS", action: "Candidate submitted", entityType: "RecruitmentSubmission", entityId: submission._id, summary: `${req.user.name} submitted ${submission.candidateName} for ${job.title}` });
    res.status(201).json(await visibleSubmission(submission._id, req.user));
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/stage", async (req, res, next) => {
  try {
    const submission = await visibleSubmission(req.params.id, req.user);
    if (!submission) return res.status(404).json({ message: "Candidate submission not found" });
    const nextStage = clean(req.body.stage);
    if (!RECRUITMENT_STAGES.includes(nextStage)) return res.status(400).json({ message: "Invalid recruitment stage" });

    const ownsSubmission = String(submission.submittedBy?.user) === String(req.user._id);
    const recruiterResubmit = ownsSubmission && submission.stage === "Changes requested" && nextStage === "Pending admin review";
    const recruiterWithdraw = ownsSubmission && nextStage === "Withdrawn";
    if (ADMIN_ONLY_STAGES.has(nextStage) && !isReviewer(req.user) && !recruiterResubmit) {
      return res.status(403).json({ message: "Only an authorised reviewer can move a candidate to this stage" });
    }
    if (!isReviewer(req.user) && !recruiterResubmit && !recruiterWithdraw) {
      return res.status(403).json({ message: "You cannot update this candidate stage" });
    }

    const note = clean(req.body.note, 2000);
    if (["Changes requested", "Admin rejected", "Client rejected"].includes(nextStage) && !note) {
      return res.status(400).json({ message: "Add a reason or feedback note for this stage" });
    }
    if (nextStage === "Interview scheduled" && !req.body.interviewDate) {
      return res.status(400).json({ message: "Interview date is required" });
    }

    const previousStage = submission.stage;
    submission.stage = nextStage;
    submission.outcomeReason = note || submission.outcomeReason;
    if (["Changes requested", "Admin rejected", "Client review"].includes(nextStage)) {
      submission.adminReviewedBy = actor(req.user);
      submission.adminReviewedAt = new Date();
    }
    if (nextStage === "Client review" && !submission.clientSubmittedAt) submission.clientSubmittedAt = new Date();
    if (["Interview requested", "Interview scheduled"].includes(nextStage)) {
      submission.interview = {
        date: req.body.interviewDate || submission.interview?.date,
        time: clean(req.body.interviewTime),
        format: clean(req.body.interviewFormat) || submission.interview?.format || "",
        locationOrLink: clean(req.body.locationOrLink, 1000),
        contactName: clean(req.body.contactName)
      };
    }
    submission.timeline.push({ type: "Stage changed", fromStage: previousStage, toStage: nextStage, note, actor: actor(req.user) });
    await submission.save();
    await logActivity(req, { module: "Recruitment ATS", action: "Pipeline updated", entityType: "RecruitmentSubmission", entityId: submission._id, summary: `${submission.candidateName} moved from ${previousStage} to ${nextStage}` });
    res.json(await visibleSubmission(submission._id, req.user));
  } catch (error) {
    next(error);
  }
});

router.get("/:id/cv", async (req, res, next) => {
  try {
    const submission = await visibleSubmission(req.params.id, req.user, true);
    if (!submission?.cv?.data) return res.status(404).json({ message: "Candidate CV not found" });
    assertDocumentReleased(submission.cv);
    await logActivity(req, { module: "Recruitment ATS", action: "CV downloaded", entityType: "RecruitmentSubmission", entityId: submission._id, summary: `${req.user.name} downloaded ${submission.candidateName}'s CV` });
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Type", submission.cv.mimetype || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${String(submission.cv.originalName || "candidate-cv").replace(/[\r\n"]/g, "-")}"`);
    res.send(submission.cv.data);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/cv-review", async (req, res, next) => {
  try {
    const submission = await visibleSubmission(req.params.id, req.user, true);
    if (!submission?.cv?.data) return res.status(404).json({ message: "Candidate CV not found" });
    assertDocumentReleased(submission.cv);
    let text = String(submission.cv.extractedText || "").trim();
    if (!text) {
      const extracted = await extractDocumentText({ buffer: submission.cv.data, originalname: submission.cv.originalName, mimetype: submission.cv.mimetype, size: submission.cv.size });
      text = extracted.text;
      submission.cv.extractedText = text;
      submission.cv.indexedAt = new Date();
      submission.cv.verifiedType = extracted.verifiedType;
      await submission.save();
    }
    await logActivity(req, { module: "Recruitment ATS", action: "CV reviewed", entityType: "RecruitmentSubmission", entityId: submission._id, summary: `${req.user.name} reviewed ${submission.candidateName}'s CV in the portal` });
    res.set("Cache-Control", "private, no-store, max-age=0");
    res.json({ name: submission.candidateName, reference: submission.reference, originalName: submission.cv.originalName, verifiedType: submission.cv.verifiedType, text: structureDocumentReviewText(text) });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/security-scan", requirePermission("recruitmentPipeline.review"), async (req, res, next) => {
  try {
    const submission = await visibleSubmission(req.params.id, req.user, true);
    if (!submission?.cv?.data) return res.status(404).json({ message: "Candidate CV not found" });
    const result = await scanRecruitmentDocument(submission.cv.data);
    submission.cv.scanStatus = result.status;
    submission.cv.scanEngine = result.engine;
    submission.cv.scannedAt = result.status === "Clean" ? new Date() : undefined;
    submission.cv.quarantineReason = result.reason;
    await submission.save();
    await logActivity(req, { module: "Recruitment ATS", action: "CV security scan run", entityType: "RecruitmentSubmission", entityId: submission._id, summary: `${submission.candidateName}'s CV scan result: ${result.status}` });
    res.status(result.status === "Clean" ? 200 : 423).json({ message: result.status === "Clean" ? "CV passed the antivirus scan" : result.reason, scanStatus: result.status, engine: result.engine });
  } catch (error) { next(error); }
});

export default router;
