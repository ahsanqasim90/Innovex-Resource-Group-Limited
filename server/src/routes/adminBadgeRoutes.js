import express from "express";
import AdminSectionSeen from "../models/AdminSectionSeen.js";
import ContactMessage from "../models/ContactMessage.js";
import Application from "../models/Application.js";
import CvUpload from "../models/CvUpload.js";
import TrainingBooking from "../models/TrainingBooking.js";
import TrainingQuotation from "../models/TrainingQuotation.js";
import { protect } from "../middleware/auth.js";
import { hasPermission } from "../config/permissions.js";

const router = express.Router();
router.use(protect);

// One entry per sidebar section that receives new items from outside the team.
const sections = [
  { key: "website-enquiries", permission: "contacts.view", model: ContactMessage },
  { key: "applications", permission: "applications.view", model: Application },
  { key: "cv-uploads", permission: "cvs.view", model: CvUpload },
  { key: "training-bookings", permission: "trainingBookings.view", model: TrainingBooking },
  { key: "training-quotations", permission: "trainingQuotations.view", model: TrainingQuotation }
];

const MAX_COUNT = 99;

router.get("/", async (req, res, next) => {
  try {
    const allowed = sections.filter((section) => hasPermission(req.user, section.permission));
    const seenRows = await AdminSectionSeen.find({ user: req.user._id, section: { $in: allowed.map((section) => section.key) } }).lean();
    const seenByKey = new Map(seenRows.map((row) => [row.section, row.seenAt]));
    const counts = {};
    for (const section of allowed) {
      let since = seenByKey.get(section.key);
      if (!since) {
        // First time this user sees the feature: start from zero instead of counting all history.
        since = new Date();
        await AdminSectionSeen.updateOne({ user: req.user._id, section: section.key }, { $setOnInsert: { seenAt: since } }, { upsert: true });
        counts[section.key] = 0;
        continue;
      }
      counts[section.key] = await section.model.countDocuments({ createdAt: { $gt: since } }, { limit: MAX_COUNT });
    }
    res.json({ counts, total: Object.values(counts).reduce((sum, value) => sum + value, 0), max: MAX_COUNT });
  } catch (error) {
    next(error);
  }
});

router.post("/seen", async (req, res, next) => {
  try {
    const key = String(req.body?.section || "");
    const section = sections.find((item) => item.key === key);
    if (!section || !hasPermission(req.user, section.permission)) return res.status(400).json({ message: "Unknown section" });
    await AdminSectionSeen.updateOne({ user: req.user._id, section: key }, { $set: { seenAt: new Date() } }, { upsert: true });
    res.json({ section: key, count: 0 });
  } catch (error) {
    next(error);
  }
});

export default router;
