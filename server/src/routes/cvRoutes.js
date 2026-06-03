import express from "express";
import CvUpload from "../models/CvUpload.js";
import { protect } from "../middleware/auth.js";
import { fileMeta, uploadCv } from "../middleware/upload.js";
import { requireFields, validateEmail } from "../utils.js";

const router = express.Router();

router.post("/", uploadCv.single("cv"), async (req, res, next) => {
  try {
    requireFields(req.body, ["name", "email", "phone", "desiredRole", "location", "experience"]);
    validateEmail(req.body.email);
    if (!req.file) return res.status(400).json({ message: "CV file is required" });

    const cvUpload = await CvUpload.create({
      ...req.body,
      cv: fileMeta(req.file)
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
    const cvs = await CvUpload.find(filter).select("-cv.data").sort({ createdAt: -1 });
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
    if (!cv?.cv?.data) return res.status(404).json({ message: "CV not found" });
    res.setHeader("Content-Type", cv.cv.mimetype || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${cv.cv.originalName || cv.cv.filename}"`);
    res.send(cv.cv.data);
  } catch (error) {
    next(error);
  }
});

export default router;
