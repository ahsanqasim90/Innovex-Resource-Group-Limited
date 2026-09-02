import express from "express";
import Candidate from "../models/Candidate.js";
import User from "../models/User.js";
import ActivityLog from "../models/ActivityLog.js";
import { hasPermission } from "../config/permissions.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { uploadCv } from "../middleware/upload.js";
import { logActivity } from "../services/activityLogService.js";
import { extractDocumentText, secureDocumentMeta } from "../services/documentIntelligenceService.js";
import { createProtectedCvPreview } from "../services/watermarkPdfService.js";
import { assertDocumentReleased, scanRecruitmentDocument } from "../services/malwareScanService.js";

const router = express.Router();
router.use(protect, requirePermission("candidateCvs.view"));

function isManager(user) {
  return ["admin", "super_admin"].includes(user?.role) || hasPermission(user, "candidateCvs.manage");
}

function requireManager(req, res, next) {
  if (isManager(req.user)) return next();
  return res.status(403).json({ message: "Only an admin or CV Library manager can perform this action" });
}

function sameId(first, second) {
  return String(first || "") === String(second || "");
}

function includesUser(values = [], userId) {
  return values.some((value) => sameId(value, userId));
}

function candidateCode(candidate) {
  return `IRG-${String(candidate?._id || "").slice(-8).toUpperCase()}`;
}

function fileDisplayName(value = "") {
  return String(value)
    .replace(/\.(pdf|docx?|rtf)$/i, "")
    .replace(/\b(curriculum[\s_-]*vitae|resume|cv)\b/gi, " ")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || "Unnamed candidate";
}

function safeHeaderFilename(value = "candidate-cv.pdf") {
  return String(value).replace(/[\r\n"\\]/g, "-");
}

function structureCvReviewText(value = "") {
  const headings = [
    "Professional Profile", "Personal Profile", "Professional Summary", "Career Summary",
    "Key Clinical Skills", "Core Skills", "Key Skills", "Employment History", "Work Experience",
    "Professional Experience", "Education", "Education and Qualifications", "Qualifications", "Training",
    "Certifications", "Professional Registration", "Achievements", "References", "Additional Information"
  ];
  const headingPattern = headings.map((heading) => heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return String(value || "")
    .replace(/\r\n?/g, "\n")
    .replace(new RegExp(`\\s+(${headingPattern})\\s*:?\\s+`, "gi"), "\n\n$1\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function accessFor(candidate, user) {
  const manager = isManager(user);
  const canView = manager
    || includesUser(candidate.cvAccess?.viewUserIds, user._id)
    || includesUser(candidate.cvAccess?.downloadUserIds, user._id);
  const canDownload = manager || includesUser(candidate.cvAccess?.downloadUserIds, user._id);
  return { manager, canView, canDownload };
}

function libraryItem(candidate, user) {
  const access = accessFor(candidate, user);
  const requests = candidate.cvAccess?.downloadRequests || [];
  const ownRequest = [...requests].reverse().find((request) => sameId(request.user, user._id));
  return {
    _id: candidate._id,
    candidateId: candidateCode(candidate),
    name: candidate.name,
    email: candidate.email,
    phone: candidate.phone,
    desiredRole: candidate.desiredRole,
    status: candidate.status,
    lawfulBasis: candidate.lawfulBasis,
    retentionReviewDate: candidate.retentionReviewDate,
    updatedAt: candidate.updatedAt,
    cv: candidate.cv ? {
      originalName: candidate.cv.originalName,
      mimetype: candidate.cv.mimetype,
      size: candidate.cv.size,
      uploadedAt: candidate.cv.uploadedAt,
      uploadedBy: candidate.cv.uploadedBy,
      indexedAt: candidate.cv.indexedAt,
      verifiedType: candidate.cv.verifiedType,
      scanStatus: candidate.cv.scanStatus
    } : null,
    access: {
      canView: access.canView,
      canDownload: access.canDownload,
      viewUserIds: access.manager ? (candidate.cvAccess?.viewUserIds || []).map(String) : undefined,
      downloadUserIds: access.manager ? (candidate.cvAccess?.downloadUserIds || []).map(String) : undefined,
      requests: access.manager ? requests : undefined,
      requestStatus: ownRequest?.status || null
    }
  };
}

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 100);
    const filter = { "cv.data": { $exists: true } };
    if (!isManager(req.user)) {
      filter.$or = [
        { "cvAccess.viewUserIds": req.user._id },
        { "cvAccess.downloadUserIds": req.user._id }
      ];
    }
    const search = String(req.query.search || "").trim();
    if (search) {
      const escaped = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchConditions = ["name", "email", "phone", "desiredRole", "cv.originalName"].map((field) => ({ [field]: new RegExp(escaped, "i") }));
      const idSuffix = search.replace(/^IRG-/i, "").replace(/[^a-f0-9]/gi, "");
      if (idSuffix.length >= 6) {
        searchConditions.push({ $expr: { $regexMatch: { input: { $toString: "$_id" }, regex: `${idSuffix}$`, options: "i" } } });
      }
      if (filter.$or) filter.$and = [{ $or: filter.$or }, { $or: searchConditions }], delete filter.$or;
      else filter.$or = searchConditions;
    }
    const [items, total] = await Promise.all([
      Candidate.find(filter).select("-cv.data -outreachHistory").sort({ "cv.uploadedAt": -1, updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Candidate.countDocuments(filter)
    ]);
    res.json({
      items: items.map((candidate) => libraryItem(candidate, req.user)),
      total,
      page,
      pages: Math.ceil(total / limit) || 1,
      limit,
      canManage: isManager(req.user)
    });
  } catch (error) {
    next(error);
  }
});

router.get("/team", requireManager, async (req, res, next) => {
  try {
    const users = await User.find({ isActive: true }).select("name email role permissions").sort({ name: 1 }).lean();
    res.json(users.filter((user) => hasPermission(user, "candidateCvs.view")).map((user) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    })));
  } catch (error) {
    next(error);
  }
});

router.get("/security/summary", requireManager, async (req, res, next) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const reviewDeadline = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const [views, downloads, denied, retentionDue, missingLawfulBasis, activityByUser, recent] = await Promise.all([
      ActivityLog.countDocuments({ module: "CV Library", action: "CV viewed", createdAt: { $gte: since } }),
      ActivityLog.countDocuments({ module: "CV Library", action: "CV downloaded", createdAt: { $gte: since } }),
      ActivityLog.countDocuments({ module: "CV Library", action: /denied/i, createdAt: { $gte: since } }),
      Candidate.countDocuments({ "cv.data": { $exists: true }, retentionReviewDate: { $lte: reviewDeadline } }),
      Candidate.countDocuments({ "cv.data": { $exists: true }, $or: [{ lawfulBasis: "Not recorded" }, { lawfulBasis: { $exists: false } }] }),
      ActivityLog.aggregate([
        { $match: { module: "CV Library", action: { $in: ["CV viewed", "CV downloaded"] }, createdAt: { $gte: since } } },
        { $group: { _id: "$actor.user", name: { $first: "$actor.name" }, email: { $first: "$actor.email" }, actions: { $sum: 1 } } },
        { $sort: { actions: -1 } },
        { $limit: 8 }
      ]),
      ActivityLog.find({ module: "CV Library", createdAt: { $gte: since } }).select("actor action summary createdAt ipAddress").sort({ createdAt: -1 }).limit(12).lean()
    ]);
    const unusual = activityByUser.filter((entry) => entry.actions >= 30);
    res.json({ windowHours: 24, views, downloads, denied, retentionDue, missingLawfulBasis, unusual, recent, riskLevel: denied || unusual.length ? "Review" : "Normal" });
  } catch (error) {
    next(error);
  }
});

router.post("/upload", requireManager, uploadCv.single("cv"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "Choose a genuine PDF or DOCX CV to upload" });
    let candidate = req.body.candidateId ? await Candidate.findById(req.body.candidateId).select("+cv.data +cv.extractedText") : null;
    let created = false;
    if (!candidate) {
      const proposedName = String(req.body.name || fileDisplayName(req.file.originalname)).trim();
      const exactName = new RegExp(`^${proposedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
      candidate = await Candidate.findOne({ name: exactName }).select("+cv.data +cv.extractedText").sort({ updatedAt: -1 });
      if (!candidate) {
        candidate = new Candidate({ name: proposedName, source: "CV Library Upload" });
        created = true;
      }
    }
    const replaced = Boolean(candidate.cv?.data);
    candidate.cv = await secureDocumentMeta(req.file, req.user);
    await candidate.save();
    await logActivity(req, {
      module: "CV Library",
      action: replaced ? "CV replaced" : "CV uploaded",
      entityType: "Candidate",
      entityId: candidate._id,
      summary: `${replaced ? "Replaced" : "Uploaded"} CV for ${candidate.name}`
    });
    res.status(created ? 201 : 200).json({
      message: candidate.cv.scanStatus === "Clean" ? `${candidate.name}: CV ${replaced ? "replaced" : "uploaded"} and antivirus cleared` : `${candidate.name}: CV uploaded to quarantine; antivirus clearance is still required`,
      created,
      replaced,
      item: libraryItem(candidate.toObject(), req.user)
    });
  } catch (error) {
    next(error);
  }
});

router.post("/index-library", requireManager, async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.body.limit || 8), 1), 20);
    const candidates = await Candidate.find({
      "cv.data": { $exists: true },
      $or: [{ "cv.indexedAt": { $exists: false } }, { "cv.extractedText": { $exists: false } }]
    }).select("name cv.originalName cv.mimetype +cv.data +cv.extractedText").limit(limit);
    let indexed = 0;
    const failed = [];
    for (const candidate of candidates) {
      try {
        assertDocumentReleased(candidate.cv);
        const result = await extractDocumentText({
          buffer: candidate.cv.data,
          originalname: candidate.cv.originalName,
          mimetype: candidate.cv.mimetype,
          size: candidate.cv.size
        });
        candidate.cv.extractedText = result.text;
        candidate.cv.indexedAt = new Date();
        candidate.cv.verifiedType = result.verifiedType;
        await candidate.save();
        indexed += 1;
      } catch (error) {
        if (["Clean", "Validated"].includes(candidate.cv.scanStatus)) candidate.cv.scanStatus = "Needs review";
        await candidate.save().catch(() => null);
        failed.push({ candidateId: candidateCode(candidate), name: candidate.name, message: error.message });
      }
    }
    const remaining = await Candidate.countDocuments({
      "cv.data": { $exists: true },
      $or: [{ "cv.indexedAt": { $exists: false } }, { "cv.extractedText": { $exists: false } }]
    });
    await logActivity(req, { module: "CV Library", action: "Library indexed", entityType: "Candidate", summary: `${req.user.name} prepared ${indexed} CVs for vacancy matching`, metadata: { indexed, remaining, failed: failed.length } });
    res.json({ message: `${indexed} CVs prepared for intelligent matching`, indexed, remaining, failed });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/review-text", async (req, res, next) => {
  try {
    const candidate = await Candidate.findById(req.params.id).select("+cv.data +cv.extractedText");
    if (!candidate?.cv?.data) return res.status(404).json({ message: "Candidate CV not found" });
    assertDocumentReleased(candidate.cv);
    const access = accessFor(candidate, req.user);
    if (!access.canView) {
      await logActivity(req, { module: "CV Library", action: "Review denied", entityType: "Candidate", entityId: candidate._id, summary: `${req.user.name} attempted to review an unallocated CV` });
      return res.status(403).json({ message: "This CV has not been allocated to your account" });
    }
    let text = String(candidate.cv.extractedText || "").trim();
    if (!text || candidate.cv.verifiedType === "docx" || /wordprocessingml/i.test(candidate.cv.mimetype || "")) {
      const extracted = await extractDocumentText({ buffer: candidate.cv.data, originalname: candidate.cv.originalName, mimetype: candidate.cv.mimetype, size: candidate.cv.size });
      text = extracted.text;
      candidate.cv.extractedText = text;
      candidate.cv.indexedAt = new Date();
      candidate.cv.verifiedType = extracted.verifiedType;
      await candidate.save();
    }
    text = structureCvReviewText(text);
    await logActivity(req, {
      module: "CV Library",
      action: "CV viewed",
      entityType: "Candidate",
      entityId: candidate._id,
      summary: `${req.user.name} reviewed ${candidate.name}'s complete CV`,
      metadata: { candidateId: candidateCode(candidate), reviewFormat: "protected-text" }
    });
    res.set("Cache-Control", "private, no-store, max-age=0");
    res.json({ candidateId: candidateCode(candidate), name: candidate.name, originalName: candidate.cv.originalName, verifiedType: candidate.cv.verifiedType, text });
  } catch (error) {
    next(error);
  }
});

router.get("/:id/preview", async (req, res, next) => {
  try {
    const candidate = await Candidate.findById(req.params.id).select("+cv.data");
    if (!candidate?.cv?.data) return res.status(404).json({ message: "Candidate CV not found" });
    assertDocumentReleased(candidate.cv);
    const access = accessFor(candidate, req.user);
    if (!access.canView) {
      await logActivity(req, { module: "CV Library", action: "Preview denied", entityType: "Candidate", entityId: candidate._id, summary: `${req.user.name} attempted to view an unallocated CV` });
      return res.status(403).json({ message: "This CV has not been allocated to your account" });
    }
    if (candidate.cv.mimetype !== "application/pdf") {
      return res.status(415).json({ message: "Secure in-browser preview is available for PDF CVs only. Ask an admin to replace this file with a PDF." });
    }
    await logActivity(req, {
      module: "CV Library",
      action: "CV viewed",
      entityType: "Candidate",
      entityId: candidate._id,
      summary: `${req.user.name} viewed ${candidate.name}'s CV`,
      metadata: { candidateId: candidateCode(candidate) }
    });
    const protectedPdf = await createProtectedCvPreview(candidate.cv.data, {
      viewerName: req.user.name,
      viewerEmail: req.user.email,
      candidateId: candidateCode(candidate)
    });
    res.set({
      "Content-Type": "application/pdf",
      "Content-Length": protectedPdf.length,
      "Content-Disposition": `inline; filename="${safeHeaderFilename(candidate.cv.originalName)}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff"
    });
    res.send(protectedPdf);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/download", async (req, res, next) => {
  try {
    const candidate = await Candidate.findById(req.params.id).select("+cv.data");
    if (!candidate?.cv?.data) return res.status(404).json({ message: "Candidate CV not found" });
    assertDocumentReleased(candidate.cv);
    if (!accessFor(candidate, req.user).canDownload) {
      await logActivity(req, { module: "CV Library", action: "Download denied", entityType: "Candidate", entityId: candidate._id, summary: `${req.user.name} attempted an unapproved CV download` });
      return res.status(403).json({ message: "Download access has not been approved by an admin" });
    }
    await logActivity(req, {
      module: "CV Library",
      action: "CV downloaded",
      entityType: "Candidate",
      entityId: candidate._id,
      summary: `${req.user.name} downloaded ${candidate.name}'s CV`
    });
    res.set({
      "Content-Type": candidate.cv.mimetype || "application/octet-stream",
      "Content-Length": candidate.cv.size,
      "Content-Disposition": `attachment; filename="${safeHeaderFilename(candidate.cv.originalName)}"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff"
    });
    res.send(candidate.cv.data);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/request-download", async (req, res, next) => {
  try {
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate?.cv?.originalName) return res.status(404).json({ message: "Candidate CV not found" });
    const access = accessFor(candidate, req.user);
    if (!access.canView) return res.status(403).json({ message: "This CV has not been allocated to your account" });
    if (access.canDownload) return res.status(400).json({ message: "You already have download access" });
    const existing = candidate.cvAccess?.downloadRequests?.find((request) => sameId(request.user, req.user._id) && request.status === "Pending");
    if (existing) return res.status(409).json({ message: "Your download request is already pending" });
    candidate.cvAccess.downloadRequests.push({
      user: req.user._id,
      name: req.user.name,
      email: req.user.email,
      status: "Pending",
      requestedAt: new Date()
    });
    await candidate.save();
    await logActivity(req, { module: "CV Library", action: "Download requested", entityType: "Candidate", entityId: candidate._id, summary: `${req.user.name} requested ${candidate.name}'s CV` });
    res.status(201).json({ message: "Download request sent to the admin" });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/security-scan", requireManager, async (req, res, next) => {
  try {
    const candidate = await Candidate.findById(req.params.id).select("+cv.data");
    if (!candidate?.cv?.data) return res.status(404).json({ message: "Candidate CV not found" });
    const result = await scanRecruitmentDocument(candidate.cv.data);
    candidate.cv.scanStatus = result.status;
    candidate.cv.scanEngine = result.engine;
    candidate.cv.scannedAt = result.status === "Clean" ? new Date() : undefined;
    candidate.cv.quarantineReason = result.reason;
    await candidate.save();
    await logActivity(req, { module: "CV Library", action: "Security scan run", entityType: "Candidate", entityId: candidate._id, summary: `${candidate.name}'s CV scan result: ${result.status}`, metadata: { engine: result.engine } });
    res.status(result.status === "Clean" ? 200 : 423).json({ message: result.status === "Clean" ? "CV passed the antivirus scan" : result.reason, scanStatus: result.status, engine: result.engine });
  } catch (error) { next(error); }
});

router.patch("/:id/access", requireManager, async (req, res, next) => {
  try {
    const { userId, action } = req.body;
    const user = await User.findOne({ _id: userId, isActive: true });
    if (!user || !hasPermission(user, "candidateCvs.view")) {
      return res.status(400).json({ message: "Select an active team member who has CV Library permission" });
    }
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate?.cv?.originalName) return res.status(404).json({ message: "Candidate CV not found" });
    if (action === "grant-view") candidate.cvAccess.viewUserIds.addToSet(user._id);
    else if (action === "revoke-view") {
      candidate.cvAccess.viewUserIds.pull(user._id);
      candidate.cvAccess.downloadUserIds.pull(user._id);
    } else if (action === "grant-download") {
      candidate.cvAccess.viewUserIds.addToSet(user._id);
      candidate.cvAccess.downloadUserIds.addToSet(user._id);
    } else if (action === "revoke-download") candidate.cvAccess.downloadUserIds.pull(user._id);
    else return res.status(400).json({ message: "Invalid access action" });
    await candidate.save();
    await logActivity(req, { module: "CV Library", action: "Access changed", entityType: "Candidate", entityId: candidate._id, summary: `${req.user.name} applied ${action} for ${user.name} on ${candidate.name}'s CV` });
    res.json({ message: `Access updated for ${user.name}`, item: libraryItem(candidate.toObject(), req.user) });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/requests/:requestId", requireManager, async (req, res, next) => {
  try {
    const decision = String(req.body.decision || "");
    if (!["Approved", "Rejected"].includes(decision)) return res.status(400).json({ message: "Decision must be Approved or Rejected" });
    const candidate = await Candidate.findById(req.params.id);
    if (!candidate?.cv?.originalName) return res.status(404).json({ message: "Candidate CV not found" });
    const request = candidate.cvAccess?.downloadRequests?.id(req.params.requestId);
    if (!request) return res.status(404).json({ message: "Download request not found" });
    request.status = decision;
    request.reviewedAt = new Date();
    request.reviewedBy = { user: req.user._id, name: req.user.name, email: req.user.email };
    if (decision === "Approved") {
      candidate.cvAccess.viewUserIds.addToSet(request.user);
      candidate.cvAccess.downloadUserIds.addToSet(request.user);
    }
    await candidate.save();
    await logActivity(req, { module: "CV Library", action: `Request ${decision.toLowerCase()}`, entityType: "Candidate", entityId: candidate._id, summary: `${req.user.name} ${decision.toLowerCase()} ${request.name}'s request for ${candidate.name}'s CV` });
    res.json({ message: `Download request ${decision.toLowerCase()}`, item: libraryItem(candidate.toObject(), req.user) });
  } catch (error) {
    next(error);
  }
});

export default router;
