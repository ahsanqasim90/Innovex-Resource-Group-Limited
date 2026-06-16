import express from "express";
import Course from "../models/Course.js";
import { protect } from "../middleware/auth.js";
import { pick, requireFields } from "../utils.js";

const router = express.Router();
const fields = [
  "title",
  "category",
  "description",
  "duration",
  "defaultSellingPrice",
  "defaultTrainerCost",
  "certificateIncluded",
  "status"
];

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function toPayload(body) {
  const payload = pick(body, fields);
  ["defaultSellingPrice", "defaultTrainerCost"].forEach((field) => {
    if (payload[field] !== undefined) payload[field] = Number(payload[field] || 0);
  });
  if (payload.certificateIncluded !== undefined) {
    payload.certificateIncluded = payload.certificateIncluded === true || payload.certificateIncluded === "true";
  }
  return payload;
}

router.use(protect);

router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    const { search, status, category } = req.query;
    if (status) filter.status = status;
    if (category) filter.category = new RegExp(escapeRegex(category), "i");
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ title: regex }, { category: regex }, { description: regex }];
    }
    const courses = await Course.find(filter).sort({ status: 1, category: 1, title: 1 });
    res.json(courses);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json(course);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    requireFields(req.body, ["title", "category", "description", "duration"]);
    const course = await Course.create(toPayload(req.body));
    res.status(201).json(course);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, toPayload(req.body), {
      new: true,
      runValidators: true
    });
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json(course);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json({ message: "Course deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
