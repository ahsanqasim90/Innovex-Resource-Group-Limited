import express from "express";
import Candidate from "../models/Candidate.js";
import EmailLog from "../models/EmailLog.js";
import Job from "../models/Job.js";
import { allowedSenderAccountsForUser, canUseSender } from "../config/emailAccounts.js";
import { hasPermission } from "../config/permissions.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { uploadCv } from "../middleware/upload.js";
import { analyseJobDescription, buildCriteriaReview, defaultScoreProfile, rankCandidateForJob, secureDocumentMeta } from "../services/documentIntelligenceService.js";
import { sendCandidateVacancyEmail } from "../services/emailService.js";
import { vacancyLocationContext } from "../services/postcodeIntelligenceService.js";
import { logActivity } from "../services/activityLogService.js";
import { notifyPortalMembersOfVacancy } from "../services/portalNotificationService.js";

const router = express.Router();
router.use(protect, requirePermission("vacancyIntelligence.view"));

const pipelineStages = new Set(["Shortlisted", "Contacted", "Interested", "Submitted", "Interview", "Offered", "Placed", "Rejected"]);

function canManage(user) {
  return ["admin", "super_admin"].includes(user?.role) || hasPermission(user, "vacancyIntelligence.manage");
}

function requireManager(req, res, next) {
  if (canManage(req.user)) return next();
  return res.status(403).json({ message: "Only an admin or Vacancy Intelligence manager can perform this action" });
}

function vacancyCode(job) {
  return `IRG-JOB-${String(job?._id || "").slice(-6).toUpperCase()}`;
}

function jobView(job) {
  const value = typeof job.toObject === "function" ? job.toObject() : job;
  if (value.sourceDocument) delete value.sourceDocument.data;
  return { ...value, vacancyId: vacancyCode(value) };
}

function cleanArray(value) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean).slice(0, 80);
  return String(value || "").split(/[\r\n;,]+/).map((item) => item.trim()).filter(Boolean).slice(0, 80);
}

function cleanBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return value === true || String(value).toLowerCase() === "true";
}

function reviewedCriteria(value = {}, fallback = {}) {
  return {
    mandatorySkills: cleanArray(value.mandatorySkills ?? fallback.mandatorySkills),
    desirableSkills: cleanArray(value.desirableSkills ?? fallback.desirableSkills),
    qualifications: cleanArray(value.qualifications ?? fallback.qualifications),
    minimumExperienceYears: Math.min(Math.max(Number(value.minimumExperienceYears ?? fallback.minimumExperienceYears ?? 0), 0), 40),
    registrationRequired: cleanBoolean(value.registrationRequired, fallback.registrationRequired),
    registrationTerms: cleanArray(value.registrationTerms ?? fallback.registrationTerms),
    rightToWorkRequired: cleanBoolean(value.rightToWorkRequired, fallback.rightToWorkRequired ?? true),
    drivingRequired: cleanBoolean(value.drivingRequired, fallback.drivingRequired),
    availabilityRequirement: String(value.availabilityRequirement ?? fallback.availabilityRequirement ?? "").trim(),
    reviewStatus: value.reviewStatus === "Reviewed" ? "Reviewed" : "Needs review"
  };
}

function scoreProfile(value = {}, title = "") {
  const fallback = defaultScoreProfile(title);
  const result = { name: String(value.name || fallback.name || "Balanced").slice(0, 50) };
  for (const key of ["skills", "experience", "qualifications", "location", "availability", "recency"]) result[key] = Math.min(Math.max(Number(value[key] ?? fallback[key] ?? 0), 0), 100);
  return result;
}

router.get("/", async (req, res, next) => {
  try {
    const search = String(req.query.search || "").trim();
    const filter = {};
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      filter.$or = ["title", "location", "description", "sourceDocument.originalName"].map((field) => ({ [field]: new RegExp(escaped, "i") }));
    }
    if (req.query.status === "active") filter.isActive = true;
    if (req.query.status === "closed") filter.isActive = false;
    const jobs = await Job.find(filter).select("-sourceDocument.data").sort({ updatedAt: -1 }).lean();
    res.json({ items: jobs.map(jobView), total: jobs.length, canManage: canManage(req.user) });
  } catch (error) {
    next(error);
  }
});

router.get("/summary", async (req, res, next) => {
  try {
    const [total, active, indexedCandidates, shortlisted, placed] = await Promise.all([
      Job.countDocuments(),
      Job.countDocuments({ isActive: true }),
      Candidate.countDocuments({ "cv.indexedAt": { $exists: true } }),
      Job.countDocuments({ "pipeline.stage": "Shortlisted" }),
      Job.countDocuments({ "pipeline.stage": "Placed" })
    ]);
    res.json({ total, active, indexedCandidates, vacanciesWithShortlists: shortlisted, vacanciesWithPlacements: placed });
  } catch (error) {
    next(error);
  }
});

router.get("/senders", (req, res) => {
  res.json({ senders: allowedSenderAccountsForUser(req.user) });
});

router.post("/", requireManager, uploadCv.single("document"), async (req, res, next) => {
  try {
    let sourceDocument;
    let extracted = "";
    if (req.file) {
      const secured = await secureDocumentMeta(req.file, req.user);
      extracted = secured.extractedText;
      sourceDocument = {
        originalName: secured.originalName,
        mimetype: secured.mimetype,
        size: secured.size,
        data: secured.data,
        contentHash: secured.contentHash,
        verifiedType: secured.verifiedType,
        uploadedAt: secured.uploadedAt,
        uploadedBy: secured.uploadedBy
      };
    }
    const description = String(req.body.description || extracted || "").trim();
    const title = String(req.body.title || "").trim();
    const location = String(req.body.location || "").trim();
    if (!title || !location || !description) return res.status(400).json({ message: "Job title, location and a job description/file are required" });
    const requirements = cleanArray(req.body.requirements);
    const intelligence = analyseJobDescription(description, { title, location });
    const isActive = String(req.body.isActive ?? "true") !== "false";
    const job = await Job.create({
      title,
      location,
      postcode: String(req.body.postcode || "").trim(),
      radiusMiles: Math.min(Math.max(Number(req.body.radiusMiles || 25), 0), 150),
      salary: String(req.body.salary || "Competitive").trim(),
      type: String(req.body.type || "Permanent").trim(),
      shift: String(req.body.shift || "As required").trim(),
      description,
      requirements,
      isActive,
      vacancyStatus: isActive ? "Open" : "Closed",
      sourceDocument,
      intelligence,
      criteriaReview: buildCriteriaReview(description, { title, location, shift: req.body.shift, requirements }, intelligence),
      scoreProfile: defaultScoreProfile(title)
    });
    if (job.isActive) await notifyPortalMembersOfVacancy(job, req.user).catch(() => 0);
    await logActivity(req, { module: "Vacancy Intelligence", action: "Vacancy analysed", entityType: "Job", entityId: job._id, summary: `${req.user.name} created and analysed ${job.title}` });
    res.status(201).json({ message: `${job.title} analysed successfully`, item: jobView(job) });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", requireManager, uploadCv.single("document"), async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id).select("+sourceDocument.data");
    if (!job) return res.status(404).json({ message: "Vacancy not found" });
    const fields = ["title", "location", "postcode", "salary", "type", "shift", "description"];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) job[field] = req.body[field];
    });
    if (req.body.radiusMiles !== undefined) job.radiusMiles = Math.min(Math.max(Number(req.body.radiusMiles), 0), 150);
    if (req.body.isActive !== undefined) job.isActive = String(req.body.isActive) !== "false";
    if (req.body.requirements !== undefined) job.requirements = cleanArray(req.body.requirements);
    if (req.file) {
      const secured = await secureDocumentMeta(req.file, req.user);
      job.sourceDocument = {
        originalName: secured.originalName,
        mimetype: secured.mimetype,
        size: secured.size,
        data: secured.data,
        contentHash: secured.contentHash,
        verifiedType: secured.verifiedType,
        uploadedAt: secured.uploadedAt,
        uploadedBy: secured.uploadedBy
      };
      job.description = secured.extractedText || job.description;
    }
    job.intelligence = analyseJobDescription(job.description, { title: job.title, location: job.location });
    if (job.criteriaReview?.reviewStatus !== "Reviewed") job.criteriaReview = buildCriteriaReview(job.description, { title: job.title, location: job.location, shift: job.shift, requirements: job.requirements }, job.intelligence);
    if (!job.scoreProfile?.name) job.scoreProfile = defaultScoreProfile(job.title);
    await job.save();
    await logActivity(req, { module: "Vacancy Intelligence", action: "Vacancy updated", entityType: "Job", entityId: job._id, summary: `${req.user.name} updated and re-analysed ${job.title}` });
    res.json({ message: `${job.title} updated`, item: jobView(job) });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/criteria", requireManager, async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "Vacancy not found" });
    const nextCriteria = reviewedCriteria(req.body.criteria || {}, job.criteriaReview?.toObject?.() || job.criteriaReview || {});
    nextCriteria.reviewStatus = "Reviewed";
    nextCriteria.reviewedAt = new Date();
    nextCriteria.reviewedBy = { user: req.user._id, name: req.user.name, email: req.user.email };
    job.criteriaReview = nextCriteria;
    job.scoreProfile = scoreProfile(req.body.scoreProfile || {}, job.title);
    await job.save();
    await logActivity(req, { module: "Vacancy Intelligence", action: "Matching criteria reviewed", entityType: "Job", entityId: job._id, summary: `${req.user.name} approved matching criteria for ${job.title}` });
    res.json({ message: "Matching criteria reviewed and saved", item: jobView(job) });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/matches", async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id).select("-sourceDocument.data").lean();
    if (!job) return res.status(404).json({ message: "Vacancy not found" });
    if (!job.intelligence?.analysedAt) job.intelligence = analyseJobDescription(job.description, { title: job.title, location: job.location });
    const candidates = await Candidate.find({ "cv.indexedAt": { $exists: true }, status: { $ne: "Do Not Contact" } })
      .select("name email phone city postcode postcodePrefix latitude longitude desiredRole experience availability shiftPreference payExpectation status tags cv.originalName cv.indexedAt cv.verifiedType +cv.extractedText")
      .sort({ updatedAt: -1 })
      .limit(1200)
      .lean();
    const minimumScore = Math.min(Math.max(Number(req.query.minimumScore || 0), 0), 100);
    const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 300);
    const pipelineByCandidate = new Map((job.pipeline || []).map((entry) => [String(entry.candidate), entry]));
    const locationContext = await vacancyLocationContext(job.postcode, job.radiusMiles);
    const feedbackByCandidate = new Map((job.matchFeedback || []).map((entry) => [String(entry.candidate), entry]));
    const matches = candidates
      .map((candidate) => ({ ...rankCandidateForJob(job, candidate, locationContext), pipeline: pipelineByCandidate.get(String(candidate._id)) || null, recruiterFeedback: feedbackByCandidate.get(String(candidate._id)) || null }))
      .filter((match) => match.matchScore >= minimumScore)
      .sort((first, second) => second.matchScore - first.matchScore)
      .slice(0, limit);
    await Job.updateOne({ _id: job._id }, { $push: { matchRuns: { $each: [{ analysedCandidates: candidates.length, returnedCandidates: matches.length, minimumScore, generatedAt: new Date(), generatedBy: req.user._id }], $slice: -50 } } });
    await logActivity(req, { module: "Vacancy Intelligence", action: "Candidate matching run", entityType: "Job", entityId: job._id, summary: `${req.user.name} matched ${candidates.length} indexed CVs against ${job.title}`, metadata: { candidates: candidates.length, results: matches.length } });
    res.json({ vacancy: jobView(job), matches, analysedCandidates: candidates.length, returned: matches.length, generatedAt: new Date() });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/feedback", requireManager, async (req, res, next) => {
  try {
    const verdicts = new Set(["Accurate", "Needs correction", "Strong candidate", "Not suitable"]);
    const verdict = String(req.body.verdict || "");
    if (!verdicts.has(verdict)) return res.status(400).json({ message: "Choose a valid feedback option" });
    const [job, candidate] = await Promise.all([Job.findById(req.params.id), Candidate.findById(req.body.candidateId).select("name")]);
    if (!job) return res.status(404).json({ message: "Vacancy not found" });
    if (!candidate) return res.status(404).json({ message: "Candidate not found" });
    job.matchFeedback = (job.matchFeedback || []).filter((entry) => String(entry.candidate) !== String(candidate._id));
    job.matchFeedback.push({ candidate: candidate._id, verdict, reason: String(req.body.reason || "").slice(0, 600), matchScore: Number(req.body.matchScore || 0), createdBy: { user: req.user._id, name: req.user.name, email: req.user.email } });
    if (job.matchFeedback.length > 500) job.matchFeedback = job.matchFeedback.slice(-500);
    await job.save();
    await logActivity(req, { module: "Vacancy Intelligence", action: "Match feedback recorded", entityType: "Job", entityId: job._id, summary: `${req.user.name} marked ${candidate.name} as ${verdict} for ${job.title}` });
    res.json({ message: "Recruiter feedback saved", feedback: job.matchFeedback[job.matchFeedback.length - 1] });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/email-candidate", requireManager, async (req, res, next) => {
  try {
    const [job, candidate] = await Promise.all([Job.findById(req.params.id), Candidate.findById(req.body.candidateId)]);
    if (!job) return res.status(404).json({ message: "Vacancy not found" });
    if (!candidate) return res.status(404).json({ message: "Candidate not found" });
    if (!candidate.email) return res.status(400).json({ message: "This candidate does not have an email address" });
    if (candidate.status === "Do Not Contact") return res.status(409).json({ message: "This candidate is marked Do Not Contact" });
    const senders = allowedSenderAccountsForUser(req.user);
    const fromEmail = String(req.body.fromEmail || senders[0]?.address || "").toLowerCase().trim();
    if (!fromEmail) return res.status(400).json({ message: "No sender mailbox is assigned to your account" });
    if (!canUseSender(req.user, fromEmail)) return res.status(403).json({ message: "You are not allowed to use this sender mailbox" });

    const result = await sendCandidateVacancyEmail({ candidate, job, fromEmail, subject: String(req.body.subject || "").trim(), introduction: String(req.body.introduction || "").trim() });
    await EmailLog.create({
      fromEmail: result.fromEmail || fromEmail,
      fromName: "Innovex Resource Group Limited",
      to: [candidate.email],
      subject: result.subject || `${job.title} opportunity`,
      message: result.message || req.body.introduction || "Vacancy details sent",
      targetType: "Candidate",
      targetId: candidate._id,
      status: result.sent ? "Sent" : "Failed",
      error: result.sent ? result.sentFolderError || "" : result.reason || "Email was not sent",
      sentBy: { user: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role }
    });
    if (!result.sent) return res.status(400).json({ message: result.reason || "Vacancy email was not sent" });

    candidate.lastContactedAt = new Date();
    if (candidate.status === "Available") candidate.status = "Contacted";
    candidate.outreachHistory.unshift({ job: job._id, jobTitle: job.title, subject: result.subject, message: result.message, status: "Emailed" });
    candidate.outreachHistory = candidate.outreachHistory.slice(0, 20);
    await candidate.save();

    let pipeline = job.pipeline.find((entry) => String(entry.candidate) === String(candidate._id));
    if (!pipeline) {
      job.pipeline.push({ candidate: candidate._id, stage: "Contacted", matchScore: Number(req.body.matchScore || 0), updatedBy: { user: req.user._id, name: req.user.name, email: req.user.email }, vacancyEmailSentAt: new Date(), vacancyEmailFrom: result.fromEmail || fromEmail });
      pipeline = job.pipeline[job.pipeline.length - 1];
    } else {
      if (["Shortlisted", "Contacted"].includes(pipeline.stage)) pipeline.stage = "Contacted";
      pipeline.vacancyEmailSentAt = new Date();
      pipeline.vacancyEmailFrom = result.fromEmail || fromEmail;
      pipeline.updatedAt = new Date();
    }
    await job.save();
    await logActivity(req, { module: "Vacancy Intelligence", action: "Vacancy emailed to candidate", entityType: "Job", entityId: job._id, summary: `${req.user.name} emailed ${job.title} details to ${candidate.name}`, metadata: { candidateId: candidate._id, fromEmail: result.fromEmail || fromEmail } });
    res.json({ message: `Vacancy details emailed to ${candidate.name}`, pipeline, sentFolderSaved: result.sentFolderSaved });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/pipeline", requireManager, async (req, res, next) => {
  try {
    const stage = String(req.body.stage || "Shortlisted");
    if (!pipelineStages.has(stage)) return res.status(400).json({ message: "Invalid recruitment pipeline stage" });
    const [job, candidate] = await Promise.all([Job.findById(req.params.id), Candidate.findById(req.body.candidateId).select("name")]);
    if (!job) return res.status(404).json({ message: "Vacancy not found" });
    if (!candidate) return res.status(404).json({ message: "Candidate not found" });
    let entry = job.pipeline.find((item) => String(item.candidate) === String(candidate._id));
    if (!entry) {
      job.pipeline.push({ candidate: candidate._id, stage, matchScore: Number(req.body.matchScore || 0), notes: req.body.notes, updatedBy: { user: req.user._id, name: req.user.name, email: req.user.email } });
      entry = job.pipeline[job.pipeline.length - 1];
    } else {
      entry.stage = stage;
      entry.matchScore = Number(req.body.matchScore ?? entry.matchScore ?? 0);
      if (req.body.notes !== undefined) entry.notes = req.body.notes;
      entry.updatedAt = new Date();
      entry.updatedBy = { user: req.user._id, name: req.user.name, email: req.user.email };
    }
    await job.save();
    await logActivity(req, { module: "Vacancy Intelligence", action: "Pipeline updated", entityType: "Job", entityId: job._id, summary: `${candidate.name} moved to ${stage} for ${job.title}`, metadata: { candidateId: candidate._id, stage } });
    res.json({ message: `${candidate.name} moved to ${stage}`, pipeline: entry });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/document", requireManager, async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id).select("title sourceDocument +sourceDocument.data");
    if (!job?.sourceDocument?.data) return res.status(404).json({ message: "Original job description not found" });
    res.set({
      "Content-Type": job.sourceDocument.mimetype || "application/octet-stream",
      "Content-Length": job.sourceDocument.size,
      "Content-Disposition": `attachment; filename="${String(job.sourceDocument.originalName || "job-description").replace(/[\r\n"\\]/g, "-")}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff"
    });
    res.send(job.sourceDocument.data);
  } catch (error) {
    next(error);
  }
});

export default router;
