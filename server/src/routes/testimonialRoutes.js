import express from "express";
import rateLimit from "express-rate-limit";
import Testimonial from "../models/Testimonial.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { pick, requireFields } from "../utils.js";

const router = express.Router();
const publicFields = ["name", "reviewType", "role", "company", "rating", "message"];
const adminFields = [...publicFields, "status"];
const submissionLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false });

function protectAdminQuery(req, res, next) {
  if (req.query.admin) return protect(req, res, () => requirePermission("testimonials.view")(req, res, next));
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

router.post("/", submissionLimiter, async (req, res, next) => {
  try {
    requireFields(req.body, ["name", "role", "message"]);
    if (!["true", "on", "1"].includes(String(req.body.publicationConsent || "").toLowerCase())) {
      return res.status(400).json({ message: "Please confirm that Innovex may publish your review" });
    }
    const testimonial = await Testimonial.create({ ...pick(req.body, publicFields), publicationConsent: true, publicationConsentAt: new Date(), status: "Pending" });
    res.status(201).json({ message: "Review submitted for approval", id: testimonial._id });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", protect, requirePermission("testimonials.view"), async (req, res, next) => {
  try {
    const testimonial = await Testimonial.findByIdAndUpdate(req.params.id, pick(req.body, adminFields), { new: true, runValidators: true });
    if (!testimonial) return res.status(404).json({ message: "Testimonial not found" });
    res.json(testimonial);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", protect, requirePermission("testimonials.view"), async (req, res, next) => {
  try {
    const testimonial = await Testimonial.findById(req.params.id);
    if (!testimonial) return res.status(404).json({ message: "Testimonial not found" });
    await testimonial.archive(req.user._id, "Testimonial archived");
    res.json({ message: "Testimonial archived" });
  } catch (error) {
    next(error);
  }
});

export default router;
