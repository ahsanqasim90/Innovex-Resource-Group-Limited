import express from "express";
import Testimonial from "../models/Testimonial.js";
import { protect } from "../middleware/auth.js";
import { pick, requireFields } from "../utils.js";

const router = express.Router();
const fields = ["name", "role", "company", "rating", "message", "status"];

function protectAdminQuery(req, res, next) {
  if (req.query.admin) return protect(req, res, next);
  next();
}

router.get("/", protectAdminQuery, async (req, res, next) => {
  try {
    const filter = req.query.admin ? {} : { status: "Approved" };
    const testimonials = await Testimonial.find(filter).sort({ createdAt: -1 });
    res.json(testimonials);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    requireFields(req.body, ["name", "role", "message"]);
    const testimonial = await Testimonial.create(pick(req.body, fields));
    res.status(201).json(testimonial);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", protect, async (req, res, next) => {
  try {
    const testimonial = await Testimonial.findByIdAndUpdate(req.params.id, pick(req.body, fields), { new: true, runValidators: true });
    if (!testimonial) return res.status(404).json({ message: "Testimonial not found" });
    res.json(testimonial);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", protect, async (req, res, next) => {
  try {
    const testimonial = await Testimonial.findByIdAndDelete(req.params.id);
    if (!testimonial) return res.status(404).json({ message: "Testimonial not found" });
    res.json({ message: "Testimonial deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
