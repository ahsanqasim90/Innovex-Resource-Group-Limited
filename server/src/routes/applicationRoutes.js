import express from "express";
import Application from "../models/Application.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();

router.use(protect);

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
    if (!application?.cv?.data) return res.status(404).json({ message: "CV not found" });
    res.setHeader("Content-Type", application.cv.mimetype || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename="${application.cv.originalName || application.cv.filename}"`);
    res.send(application.cv.data);
  } catch (error) {
    next(error);
  }
});

export default router;
