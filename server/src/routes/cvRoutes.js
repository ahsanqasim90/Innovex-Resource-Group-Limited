import express from "express";
import rateLimit from "express-rate-limit";
import CvUpload from "../models/CvUpload.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { uploadCv } from "../middleware/upload.js";
import { extractDocumentText, secureDocumentMeta, structureDocumentReviewText } from "../services/documentIntelligenceService.js";
import { assertDocumentReleased, scanRecruitmentDocument } from "../services/malwareScanService.js";
import { logActivity } from "../services/activityLogService.js";
import { requireFields, validateEmail } from "../utils.js";

const router = express.Router();
const cvUploadLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false });

router.post("/", cvUploadLimiter, uploadCv.single("cv"), async (req, res, next) => {
  try {
    requireFields(req.body, ["name", "email", "phone", "desiredRole", "location", "experience"]);
    validateEmail(req.body.email);
    if (!req.file) return res.status(400).json({ message: "CV file is required" });
    if (!['true', 'on', '1'].includes(String(req.body.privacyConfirmed || "").toLowerCase())) {
      return res.status(400).json({ message: "Please confirm that you have read the privacy notice" });
    }

    const cvUpload = await CvUpload.create({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      desiredRole: req.body.desiredRole,
      location: req.body.location,
      experience: req.body.experience,
      privacyNoticeVersion: "2026-08-28",
      privacyAcknowledgedAt: new Date(),
      cv: await secureDocumentMeta(req.file, null, { extract: false })
    });
    res.status(201).json({ message: cvUpload.cv.scanStatus === "Clean" ? "CV uploaded and security scanned successfully" : "CV uploaded securely and quarantined pending antivirus scan", id: cvUpload._id, scanStatus: cvUpload.cv.scanStatus });
  } catch (error) {
    next(error);
  }
});

router.get("/", protect, requirePermission("cvs.view"), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.role) filter.desiredRole = new RegExp(req.query.role, "i");
    if (req.query.search) filter.$text = { $search: req.query.search };
    const cvs = await CvUpload.find(filter).select("-cv.data").sort({ createdAt: -1 });
    res.json(cvs);
  } catch (error) {
    next(error);
  }
});

router.put("/:id/status", protect, requirePermission("cvs.view"), async (req, res, next) => {
  try {
    const cv = await CvUpload.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
    if (!cv) return res.status(404).json({ message: "CV upload not found" });
    res.json(cv);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/download", protect, requirePermission("cvs.view"), async (req, res, next) => {
  try {
    const cv = await CvUpload.findById(req.params.id);
    if (!cv?.cv?.data) return res.status(404).json({ message: "CV not found" });
    assertDocumentReleased(cv.cv);
    await logActivity(req, { module: "CV Uploads", action: "CV downloaded", entityType: "CvUpload", entityId: cv._id, summary: `${req.user.name} downloaded ${cv.name}'s CV` });
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Type", cv.cv.mimetype || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${cv.cv.originalName || cv.cv.filename}"`);
    res.send(cv.cv.data);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/cv-review", protect, requirePermission("cvs.view"), async (req, res, next) => {
  try {
    const cv = await CvUpload.findById(req.params.id).select("+cv.extractedText");
    if (!cv?.cv?.data) return res.status(404).json({ message: "CV not found" });
    assertDocumentReleased(cv.cv);
    let text = String(cv.cv.extractedText || "").trim();
    if (!text) {
      const extracted = await extractDocumentText({ buffer: cv.cv.data, originalname: cv.cv.originalName, mimetype: cv.cv.mimetype, size: cv.cv.size });
      text = extracted.text;
      cv.cv.extractedText = text;
      cv.cv.indexedAt = new Date();
      cv.cv.verifiedType = extracted.verifiedType;
      await cv.save();
    }
    await logActivity(req, { module: "CV Uploads", action: "CV viewed", entityType: "CvUpload", entityId: cv._id, summary: `${req.user.name} reviewed ${cv.name}'s CV` });
    res.set("Cache-Control", "private, no-store, max-age=0");
    res.json({ name: cv.name, originalName: cv.cv.originalName, verifiedType: cv.cv.verifiedType, text: structureDocumentReviewText(text) });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/security-scan", protect, requirePermission("cvs.edit"), async (req, res, next) => {
  try {
    const cv = await CvUpload.findById(req.params.id);
    if (!cv?.cv?.data) return res.status(404).json({ message: "CV not found" });
    const result = await scanRecruitmentDocument(cv.cv.data);
    cv.cv.scanStatus = result.status;
    cv.cv.scanEngine = result.engine;
    cv.cv.scannedAt = result.status === "Clean" ? new Date() : undefined;
    cv.cv.quarantineReason = result.reason;
    await cv.save();
    await logActivity(req, { module: "CV Uploads", action: "Security scan run", entityType: "CvUpload", entityId: cv._id, summary: `${cv.name}'s CV scan result: ${result.status}`, metadata: { engine: result.engine } });
    res.status(result.status === "Clean" ? 200 : 423).json({ message: result.status === "Clean" ? "CV passed the antivirus scan" : result.reason, scanStatus: result.status, engine: result.engine });
  } catch (error) { next(error); }
});

export default router;
