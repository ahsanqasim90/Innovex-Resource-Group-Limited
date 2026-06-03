import express from "express";
import fs from "fs";
import path from "path";
import CvUpload from "../models/CvUpload.js";
import { protect } from "../middleware/auth.js";
import { uploadCv, uploadDir } from "../middleware/upload.js";
import { requireFields, validateEmail } from "../utils.js";

const router = express.Router();

router.post("/", uploadCv.single("cv"), async (req, res, next) => {
  try {
    requireFields(req.body, ["name", "email", "phone", "desiredRole", "location", "experience"]);
    validateEmail(req.body.email);
    if (!req.file) return res.status(400).json({ message: "CV file is required" });

    const cvUpload = await CvUpload.create({
      ...req.body,
      cv: {
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      }
    });
    res.status(201).json(cvUpload);
  } catch (error) {
    next(error);
  }
});

router.get("/", protect, async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.role) filter.desiredRole = new RegExp(req.query.role, "i");
    if (req.query.search) filter.$text = { $search: req.query.search };
    const cvs = await CvUpload.find(filter).sort({ createdAt: -1 });
    res.json(cvs);
  } catch (error) {
    next(error);
  }
});

router.put("/:id/status", protect, async (req, res, next) => {
  try {
    const cv = await CvUpload.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true });
    if (!cv) return res.status(404).json({ message: "CV upload not found" });
    res.json(cv);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/download", protect, async (req, res, next) => {
  try {
    const cv = await CvUpload.findById(req.params.id);
    if (!cv?.cv?.filename) return res.status(404).json({ message: "CV not found" });
    const cvPath = path.resolve(uploadDir, "cvs", cv.cv.filename);
    const legacyPath = path.resolve(uploadDir, cv.cv.filename);
    res.download(fs.existsSync(cvPath) ? cvPath : legacyPath, cv.cv.originalName);
  } catch (error) {
    next(error);
  }
});

export default router;
