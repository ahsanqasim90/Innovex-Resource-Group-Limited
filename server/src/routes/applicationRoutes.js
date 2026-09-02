import express from "express";
import Application from "../models/Application.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { extractDocumentText, structureDocumentReviewText } from "../services/documentIntelligenceService.js";
import { assertDocumentReleased, scanRecruitmentDocument } from "../services/malwareScanService.js";
import { logActivity } from "../services/activityLogService.js";
import { runAutomations } from "../services/automationService.js";

const router = express.Router();

router.use(protect, requirePermission("applications.view"));

router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) filter.$text = { $search: req.query.search };
    const applications = await Application.find(filter).select("-cv.data").populate("job").sort({ createdAt: -1 });
    res.json(applications);
  } catch (error) {
    next(error);
  }
});

router.put("/:id/status", async (req, res, next) => {
  try {
    const current = await Application.findById(req.params.id);
    if (!current) return res.status(404).json({ message: "Application not found" });
    const previousStatus = current.status;
    current.status = req.body.status;
    await current.save();
    const application = await current.populate("job");
    if (!application) return res.status(404).json({ message: "Application not found" });
    if (previousStatus !== application.status) await runAutomations({ entityType: "Application", event: "status_changed", record: application.toObject(), actor: req.user, changes: { status: { from: previousStatus, to: application.status } } }).catch(() => null);
    res.json(application);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/download", async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id).select("+cv.data");
    if (!application?.cv?.data) return res.status(404).json({ message: "CV not found" });
    assertDocumentReleased(application.cv);
    await logActivity(req, { module: "Applications", action: "CV downloaded", entityType: "Application", entityId: application._id, summary: `${req.user.name} downloaded ${application.name}'s application CV` });
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Type", application.cv.mimetype || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${application.cv.originalName || application.cv.filename}"`);
    res.send(application.cv.data);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/cv-review", async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id).select("+cv.data +cv.extractedText");
    if (!application?.cv?.data) return res.status(404).json({ message: "CV not found" });
    assertDocumentReleased(application.cv);
    let text = String(application.cv.extractedText || "").trim();
    if (!text) {
      const extracted = await extractDocumentText({ buffer: application.cv.data, originalname: application.cv.originalName, mimetype: application.cv.mimetype, size: application.cv.size });
      text = extracted.text;
      application.cv.extractedText = text;
      application.cv.indexedAt = new Date();
      application.cv.verifiedType = extracted.verifiedType;
      await application.save();
    }
    await logActivity(req, { module: "Applications", action: "CV viewed", entityType: "Application", entityId: application._id, summary: `${req.user.name} reviewed ${application.name}'s application CV` });
    res.set("Cache-Control", "private, no-store, max-age=0");
    res.json({ name: application.name, originalName: application.cv.originalName, verifiedType: application.cv.verifiedType, text: structureDocumentReviewText(text) });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/security-scan", requirePermission("applications.edit"), async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id).select("+cv.data");
    if (!application?.cv?.data) return res.status(404).json({ message: "CV not found" });
    const result = await scanRecruitmentDocument(application.cv.data);
    application.cv.scanStatus = result.status;
    application.cv.scanEngine = result.engine;
    application.cv.scannedAt = result.status === "Clean" ? new Date() : undefined;
    application.cv.quarantineReason = result.reason;
    await application.save();
    await logActivity(req, { module: "Applications", action: "CV security scan run", entityType: "Application", entityId: application._id, summary: `${application.name}'s CV scan result: ${result.status}`, metadata: { engine: result.engine } });
    res.status(result.status === "Clean" ? 200 : 423).json({ message: result.status === "Clean" ? "CV passed the antivirus scan" : result.reason, scanStatus: result.status, engine: result.engine });
  } catch (error) { next(error); }
});

export default router;
