import express from "express";
import Course from "../models/Course.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { canViewFinance } from "../config/permissions.js";
import { pick, requireFields } from "../utils.js";
import { logActivity } from "../services/activityLogService.js";

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

function sanitizeCourse(course, user) {
  if (canViewFinance(user)) return course;
  const item = course?.toObject ? course.toObject() : { ...course };
  delete item.defaultSellingPrice;
  delete item.defaultTrainerCost;
  return item;
}

router.get("/public", async (req, res, next) => {
  try {
    const courses = await Course.find({ status: "Active" })
      .select("title category description duration defaultSellingPrice certificateIncluded updatedAt")
      .sort({ category: 1, title: 1 });
    res.json(courses);
  } catch (error) {
    next(error);
  }
});

router.use(protect, requirePermission("courses.view"));

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
    res.json(courses.map((course) => sanitizeCourse(course, req.user)));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    res.json(sanitizeCourse(course, req.user));
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    requireFields(req.body, ["title", "category", "description", "duration"]);
    const payload = toPayload(req.body);
    if (!canViewFinance(req.user)) {
      delete payload.defaultSellingPrice;
      delete payload.defaultTrainerCost;
    }
    const course = await Course.create(payload);
    await logActivity(req, {
      module: "Courses",
      action: "Created",
      entityType: "Course",
      entityId: course._id,
      summary: `Created course ${course.title}`,
      metadata: { category: course.category, status: course.status }
    });
    res.status(201).json(sanitizeCourse(course, req.user));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const payload = toPayload(req.body);
    if (!canViewFinance(req.user)) {
      delete payload.defaultSellingPrice;
      delete payload.defaultTrainerCost;
    }
    const course = await Course.findByIdAndUpdate(req.params.id, payload, {
      new: true,
      runValidators: true
    });
    if (!course) return res.status(404).json({ message: "Course not found" });
    await logActivity(req, {
      module: "Courses",
      action: "Updated",
      entityType: "Course",
      entityId: course._id,
      summary: `Updated course ${course.title}`,
      metadata: { category: course.category, status: course.status }
    });
    res.json(sanitizeCourse(course, req.user));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);
    if (!course) return res.status(404).json({ message: "Course not found" });
    await logActivity(req, {
      module: "Courses",
      action: "Deleted",
      entityType: "Course",
      entityId: course._id,
      summary: `Deleted course ${course.title}`,
      metadata: { category: course.category }
    });
    res.json({ message: "Course deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
