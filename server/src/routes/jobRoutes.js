import express from "express";
import Job from "../models/Job.js";
import Application from "../models/Application.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { uploadCv } from "../middleware/upload.js";
import { secureDocumentMeta } from "../services/documentIntelligenceService.js";
import { logActivity } from "../services/activityLogService.js";
import { notifyPortalMembersOfVacancy } from "../services/portalNotificationService.js";
import { runAutomations } from "../services/automationService.js";
import { pick, requireFields, validateEmail } from "../utils.js";

const router = express.Router();
const jobFields = ["reference", "clientName", "clientAccount", "title", "location", "postcode", "salary", "type", "shift", "description", "requirements", "priority", "openings", "assignedRecruiters", "vacancyStatus", "closingDate"];
const vacancyStatuses = ["Open", "Paused", "Closed", "Filled"];

function protectAdminQuery(req, res, next) {
  if (req.query.admin) return protect(req, res, () => requirePermission("jobs.view")(req, res, next));
  next();
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function locationSearchRegex(value = "") {
  const location = String(value).trim();
  const firstToken = location.split(/[\s,]+/).find(Boolean) || "";
  const compactPrefix = location.replace(/[^a-z0-9]/gi, "").slice(0, 2);
  const options = [...new Set([location, firstToken, compactPrefix].filter((item) => item.length >= 2))];
  return new RegExp(options.map(escapeRegex).join("|"), "i");
}

router.get("/", protectAdminQuery, async (req, res, next) => {
  try {
    const filter = {};
    if (!req.query.admin) {
      filter.isActive = true;
      filter.$and = [{ $or: [{ publicationStatus: "Approved" }, { publicationStatus: { $exists: false } }] }, { $or: [{ closingDate: null }, { closingDate: { $exists: false } }, { closingDate: { $gte: new Date() } }] }];
    }
    if (req.query.search) {
      const search = new RegExp(escapeRegex(req.query.search), "i");
      filter.$or = [
        { title: search },
        { description: search },
        { location: search },
        { salary: search },
        { type: search },
        { shift: search }
      ];
    }
    if (req.query.location) filter.location = locationSearchRegex(req.query.location);
    if (req.query.type) filter.type = new RegExp(escapeRegex(req.query.type), "i");

    const requestedLimit = Number.parseInt(req.query.limit, 10);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 50) : 0;
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const query = Job.find(filter).sort({ createdAt: -1 });
    if (req.query.admin) query.select("+clientName +assignedRecruiters").populate("assignedRecruiters", "name email role");
    if (limit) query.skip(req.query.paginated === "1" ? (page - 1) * limit : 0).limit(limit);
    const [jobs, total] = await Promise.all([query, req.query.paginated === "1" ? Job.countDocuments(filter) : Promise.resolve(0)]);
    if (req.query.paginated === "1") {
      return res.json({ items: jobs, total, page, pages: Math.ceil(total / (limit || 12)) || 1, limit: limit || 12 });
    }
    res.json(jobs);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", protectAdminQuery, async (req, res, next) => {
  try {
    const filter = req.query.admin
      ? { _id: req.params.id }
      : {
          _id: req.params.id,
          isActive: true,
          $and: [{ $or: [{ publicationStatus: "Approved" }, { publicationStatus: { $exists: false } }] }, { $or: [{ closingDate: null }, { closingDate: { $exists: false } }, { closingDate: { $gte: new Date() } }] }]
        };
    const query = Job.findOne(filter);
    if (req.query.admin) query.select("+clientName +assignedRecruiters").populate("assignedRecruiters", "name email role");
    const job = await query;
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json(job);
  } catch (error) {
    next(error);
  }
});

router.post("/", protect, requirePermission("jobs.view"), async (req, res, next) => {
  try {
    requireFields(req.body, ["title", "location", "salary", "type", "shift", "description"]);
    const payload = pick(req.body, jobFields);
    const duplicate = await Job.findOne({ title: new RegExp(`^${escapeRegex(payload.title)}$`, "i"), location: new RegExp(`^${escapeRegex(payload.location)}$`, "i"), clientName: payload.clientName || "", vacancyStatus: { $in: ["Open", "Paused"] } });
    if (duplicate) return res.status(409).json({ message: `A matching live vacancy already exists (${duplicate.reference || duplicate._id}). Review it before creating another.` });
    payload.vacancyStatus = vacancyStatuses.includes(payload.vacancyStatus) ? payload.vacancyStatus : payload.isActive === false ? "Closed" : "Open";
    payload.publicationStatus = "Pending Approval";
    payload.isActive = false;
    const job = await Job.create(payload);
    await runAutomations({ entityType: "Job", event: "created", record: job.toObject(), actor: req.user }).catch(() => null);
    await logActivity(req, { module: "Jobs", action: "Vacancy created", entityType: "Job", entityId: job._id, summary: `${req.user.name} created ${job.title}` });
    res.status(201).json(job);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", protect, requirePermission("jobs.view"), async (req, res, next) => {
  try {
    const payload = pick(req.body, jobFields);
    const job = await Job.findById(req.params.id).select("+clientName +assignedRecruiters");
    if (!job) return res.status(404).json({ message: "Job not found" });
    const previousStatus = job.vacancyStatus || (job.isActive ? "Open" : "Closed");
    if (vacancyStatuses.includes(payload.vacancyStatus)) {
      payload.isActive = payload.vacancyStatus === "Open" && (job.publicationStatus === "Approved" || !job.publicationStatus);
      if (["Closed", "Filled"].includes(payload.vacancyStatus)) {
        payload.closedAt = job.closedAt || new Date();
        payload.closedBy = job.closedBy?.user
          ? job.closedBy
          : { user: req.user._id, name: req.user.name, email: req.user.email };
      } else {
        job.closedAt = undefined;
        job.closedBy = undefined;
      }
    }
    job.set(payload);
    await job.save();
    if (job.vacancyStatus !== previousStatus) await runAutomations({ entityType: "Job", event: "status_changed", record: job.toObject(), actor: req.user, changes: { status: { from: previousStatus, to: job.vacancyStatus }, vacancyStatus: { from: previousStatus, to: job.vacancyStatus } } }).catch(() => null);
    res.json(job);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/lifecycle", protect, requirePermission("jobs.view"), async (req, res, next) => {
  try {
    const nextStatus = String(req.body.status || "").trim();
    if (!vacancyStatuses.includes(nextStatus)) return res.status(400).json({ message: "Invalid vacancy status" });
    const job = await Job.findById(req.params.id).select("+clientName +assignedRecruiters");
    if (!job) return res.status(404).json({ message: "Job not found" });
    const previousStatus = job.vacancyStatus || (job.isActive ? "Open" : "Closed");
    if (nextStatus === "Open" && job.publicationStatus && job.publicationStatus !== "Approved") return res.status(409).json({ message: "This vacancy must be approved before it can be published" });
    job.vacancyStatus = nextStatus;
    job.isActive = nextStatus === "Open";
    if (["Closed", "Filled"].includes(nextStatus)) {
      job.closedAt = new Date();
      job.closedBy = { user: req.user._id, name: req.user.name, email: req.user.email };
    } else {
      job.closedAt = undefined;
      job.closedBy = undefined;
    }
    await job.save();
    await runAutomations({ entityType: "Job", event: "status_changed", record: job.toObject(), actor: req.user, changes: { status: { from: previousStatus, to: nextStatus }, vacancyStatus: { from: previousStatus, to: nextStatus } } }).catch(() => null);
    await logActivity(req, { module: "Jobs", action: "Vacancy status changed", entityType: "Job", entityId: job._id, summary: `${job.title} changed from ${previousStatus} to ${nextStatus}` });
    res.json(job);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/publication", protect, requirePermission("jobs.approve"), async (req, res, next) => {
  try {
    const nextStatus = String(req.body.status || "");
    if (!["Approved", "Rejected", "Pending Approval"].includes(nextStatus)) return res.status(400).json({ message: "Invalid publication decision" });
    const job = await Job.findById(req.params.id).select("+clientName +assignedRecruiters");
    if (!job) return res.status(404).json({ message: "Job not found" });
    job.publicationStatus = nextStatus;
    job.approvalNotes = String(req.body.notes || "").trim();
    job.isActive = nextStatus === "Approved" && job.vacancyStatus === "Open";
    job.approvedAt = nextStatus === "Approved" ? new Date() : undefined;
    job.approvedBy = nextStatus === "Approved" ? { user: req.user._id, name: req.user.name, email: req.user.email } : undefined;
    await job.save();
    if (job.isActive) await notifyPortalMembersOfVacancy(job, req.user).catch(() => 0);
    if (nextStatus === "Approved") await runAutomations({ entityType: "Job", event: "approved", record: job.toObject(), actor: req.user }).catch(() => null);
    await logActivity(req, { module: "Jobs", action: `Vacancy ${nextStatus.toLowerCase()}`, entityType: "Job", entityId: job._id, summary: `${req.user.name} marked ${job.title} as ${nextStatus.toLowerCase()}` });
    res.json(job);
  } catch (error) { next(error); }
});

router.delete("/:id", protect, requirePermission("jobs.view"), async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found" });
    await job.archive(req.user._id, String(req.body?.reason || "Vacancy archived"));
    await logActivity(req, { module: "Jobs", action: "Vacancy archived", entityType: "Job", entityId: job._id, summary: `${job.title} archived; linked applications were retained` });
    res.json({ message: "Job archived. Applications and history were retained." });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/restore", protect, requirePermission("jobs.edit"), async (req, res, next) => {
  try {
    const job = await Job.findOne({ _id: req.params.id }).setOptions({ withArchived: true });
    if (!job) return res.status(404).json({ message: "Archived job not found" });
    await job.restore();
    await logActivity(req, { module: "Jobs", action: "Vacancy restored", entityType: "Job", entityId: job._id, summary: `${job.title} restored` });
    res.json(job);
  } catch (error) { next(error); }
});

router.post("/:id/apply", uploadCv.single("cv"), async (req, res, next) => {
  try {
    requireFields(req.body, ["name", "email", "phone"]);
    validateEmail(req.body.email);
    if (!["true", "on", "1"].includes(String(req.body.privacyConfirmed || "").toLowerCase())) {
      return res.status(400).json({ message: "Please confirm that you have read the privacy notice" });
    }
    const job = await Job.findById(req.params.id);
    const isExpired = job?.closingDate && new Date(job.closingDate) < new Date();
    if (!job || !job.isActive || isExpired) return res.status(404).json({ message: "Active job not found" });

    const application = await Application.create({
      job: job._id,
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      coverMessage: req.body.coverMessage,
      attribution: { source: String(req.body.source || "Direct").slice(0, 120), medium: String(req.body.medium || "").slice(0, 120), campaign: String(req.body.campaign || "").slice(0, 160), referrer: String(req.body.referrer || "").slice(0, 500) },
      privacyNoticeVersion: "2026-08-28",
      privacyAcknowledgedAt: new Date(),
      cv: req.file ? await secureDocumentMeta(req.file, null, { extract: false }) : undefined
    });
    runAutomations({ entityType: "Application", event: "created", record: application.toObject() }).catch(() => null);
    res.status(201).json(application);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/applications", protect, requirePermission("applications.view"), async (req, res, next) => {
  try {
    const applications = await Application.find({ job: req.params.id }).select("-cv.data").populate("job").sort({ createdAt: -1 });
    res.json(applications);
  } catch (error) {
    next(error);
  }
});

export default router;
