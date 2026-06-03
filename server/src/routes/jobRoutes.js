import express from "express";
import Job from "../models/Job.js";
import Application from "../models/Application.js";
import { protect } from "../middleware/auth.js";
import { fileMeta, uploadCv } from "../middleware/upload.js";
import { pick, requireFields, validateEmail } from "../utils.js";

const router = express.Router();
const jobFields = ["title", "location", "salary", "type", "shift", "description", "requirements", "isActive", "closingDate"];

function protectAdminQuery(req, res, next) {
  if (req.query.admin) return protect(req, res, next);
  next();
}

router.get("/", protectAdminQuery, async (req, res, next) => {
  try {
    const filter = {};
    if (!req.query.admin) filter.isActive = true;
    if (req.query.search) filter.$text = { $search: req.query.search };
    if (req.query.location) filter.location = new RegExp(req.query.location, "i");
    if (req.query.type) filter.type = new RegExp(req.query.type, "i");

    const jobs = await Job.find(filter).sort({ createdAt: -1 });
    res.json(jobs);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json(job);
  } catch (error) {
    next(error);
  }
});

router.post("/", protect, async (req, res, next) => {
  try {
    requireFields(req.body, ["title", "location", "salary", "type", "shift", "description"]);
    const job = await Job.create(pick(req.body, jobFields));
    res.status(201).json(job);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", protect, async (req, res, next) => {
  try {
    const job = await Job.findByIdAndUpdate(req.params.id, pick(req.body, jobFields), { new: true, runValidators: true });
    if (!job) return res.status(404).json({ message: "Job not found" });
    res.json(job);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", protect, async (req, res, next) => {
  try {
    const job = await Job.findByIdAndDelete(req.params.id);
    if (!job) return res.status(404).json({ message: "Job not found" });
    await Application.deleteMany({ job: job._id });
    res.json({ message: "Job deleted" });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/apply", uploadCv.single("cv"), async (req, res, next) => {
  try {
    requireFields(req.body, ["name", "email", "phone"]);
    validateEmail(req.body.email);
    const job = await Job.findById(req.params.id);
    if (!job || !job.isActive) return res.status(404).json({ message: "Active job not found" });

    const application = await Application.create({
      job: job._id,
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      coverMessage: req.body.coverMessage,
      cv: fileMeta(req.file)
    });
    res.status(201).json(application);
  } catch (error) {
    next(error);
  }
});

router.get("/:id/applications", protect, async (req, res, next) => {
  try {
    const applications = await Application.find({ job: req.params.id }).select("-cv.data").populate("job").sort({ createdAt: -1 });
    res.json(applications);
  } catch (error) {
    next(error);
  }
});

export default router;
