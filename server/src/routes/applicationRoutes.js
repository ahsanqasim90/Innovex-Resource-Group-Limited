import express from "express";
import fs from "fs";
import path from "path";
import Application from "../models/Application.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) filter.$text = { $search: req.query.search };
    const applications = await Application.find(filter).populate("job").sort({ createdAt: -1 });
    res.json(applications);
  } catch (error) {
    next(error);
  }
});

router.put("/:id/status", async (req, res, next) => {
  try {
    const application = await Application.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true, runValidators: true }).populate("job");
    if (!application) return res.status(404).json({ message: "Application not found" });
    res.json(application);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/download", async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.id);
    if (!application?.cv?.filename) return res.status(404).json({ message: "CV not found" });
    const cvPath = path.resolve("uploads", "cvs", application.cv.filename);
    const legacyPath = path.resolve("uploads", application.cv.filename);
    res.download(fs.existsSync(cvPath) ? cvPath : legacyPath, application.cv.originalName);
  } catch (error) {
    next(error);
  }
});

export default router;
