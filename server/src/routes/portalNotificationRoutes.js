import express from "express";
import PortalNotification from "../models/PortalNotification.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);

router.get("/", async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 100);
    const [items, unread] = await Promise.all([
      PortalNotification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(limit).lean(),
      PortalNotification.countDocuments({ user: req.user._id, read: false })
    ]);
    res.json({ items, unread });
  } catch (error) {
    next(error);
  }
});

router.patch("/read-all", async (req, res, next) => {
  try {
    await PortalNotification.updateMany({ user: req.user._id, read: false }, { $set: { read: true } });
    res.json({ message: "Notifications marked as read" });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/read", async (req, res, next) => {
  try {
    const notification = await PortalNotification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { read: true } },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    res.json(notification);
  } catch (error) {
    next(error);
  }
});

export default router;
