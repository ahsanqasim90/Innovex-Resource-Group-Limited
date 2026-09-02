import express from "express";
import rateLimit from "express-rate-limit";
import ContactMessage from "../models/ContactMessage.js";
import User from "../models/User.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { sendContactEmail } from "../services/emailService.js";
import { logActivity } from "../services/activityLogService.js";
import { requireFields, validateEmail } from "../utils.js";

const router = express.Router();
const contactLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
const statuses = ["New", "Read", "In Progress", "Waiting", "Resolved", "Archived"];
const priorities = ["Low", "Normal", "High", "Urgent"];

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

router.post("/", contactLimiter, async (req, res, next) => {
  try {
    requireFields(req.body, ["name", "email", "subject", "message"]);
    validateEmail(req.body.email);
    const message = await ContactMessage.create({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      inquiryType: req.body.inquiryType,
      subject: req.body.subject,
      message: req.body.message,
      source: String(req.body.subject || "").startsWith("Chatbot lead:")
        ? "Website assistant"
        : "Website contact form",
      sourceIp: req.ip,
      userAgent: req.get("user-agent") || "",
      lastActivityAt: new Date()
    });
    const email = await sendContactEmail(message);
    res.status(201).json({ message, email });
  } catch (error) {
    next(error);
  }
});

router.use(protect, requirePermission("contacts.view"));

router.get("/summary", async (_req, res, next) => {
  try {
    const [total, fresh, active, urgent, resolved, byType] = await Promise.all([
      ContactMessage.countDocuments(),
      ContactMessage.countDocuments({ status: "New" }),
      ContactMessage.countDocuments({ status: { $in: ["Read", "In Progress", "Waiting"] } }),
      ContactMessage.countDocuments({ priority: "Urgent", status: { $nin: ["Resolved", "Archived"] } }),
      ContactMessage.countDocuments({ status: "Resolved" }),
      ContactMessage.aggregate([{ $group: { _id: "$inquiryType", count: { $sum: 1 } } }, { $sort: { count: -1 } }])
    ]);
    res.json({ total, new: fresh, active, urgent, resolved, byType: byType.map((item) => ({ type: item._id, count: item.count })) });
  } catch (error) {
    next(error);
  }
});

router.get("/assignees", async (_req, res, next) => {
  try {
    const users = await User.find({ isActive: true }).select("name email role permissions").sort({ name: 1 }).lean();
    res.json(users.map((user) => ({ id: user._id, name: user.name, email: user.email, role: user.role })));
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit, 10) || 20, 1), 100);
    const filter = {};
    if (statuses.includes(req.query.status)) filter.status = req.query.status;
    if (priorities.includes(req.query.priority)) filter.priority = req.query.priority;
    if (req.query.inquiryType) filter.inquiryType = req.query.inquiryType;
    if (req.query.assignedTo === "unassigned") filter.assignedTo = null;
    else if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;
    if (req.query.search) {
      const search = new RegExp(escapeRegex(req.query.search), "i");
      filter.$or = [{ name: search }, { email: search }, { phone: search }, { subject: search }, { message: search }];
    }
    const [items, total] = await Promise.all([
      ContactMessage.find(filter)
        .populate("assignedTo", "name email role")
        .sort({ lastActivityAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ContactMessage.countDocuments(filter)
    ]);
    res.json({ items, total, page, pages: Math.ceil(total / limit) || 1, limit });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const message = await ContactMessage.findById(req.params.id)
      .populate("assignedTo", "name email role")
      .populate("internalNotes.createdBy.user", "name email role");
    if (!message) return res.status(404).json({ message: "Website enquiry not found" });
    res.json(message);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requirePermission("contacts.manage"), async (req, res, next) => {
  try {
    const message = await ContactMessage.findById(req.params.id);
    if (!message) return res.status(404).json({ message: "Website enquiry not found" });
    const previousStatus = message.status;
    if (statuses.includes(req.body.status)) message.status = req.body.status;
    if (priorities.includes(req.body.priority)) message.priority = req.body.priority;
    if (req.body.assignedTo !== undefined) message.assignedTo = req.body.assignedTo || undefined;
    if (previousStatus === "New" && message.status !== "New" && !message.firstRespondedAt) message.firstRespondedAt = new Date();
    if (message.status === "Resolved" && previousStatus !== "Resolved") message.resolvedAt = new Date();
    if (message.status !== "Resolved") message.resolvedAt = undefined;
    message.lastActivityAt = new Date();
    await message.save();
    await logActivity(req, {
      module: "Website Enquiries",
      action: "Enquiry updated",
      entityType: "ContactMessage",
      entityId: message._id,
      summary: `${message.subject} updated to ${message.status}`
    });
    await message.populate("assignedTo", "name email role");
    res.json(message);
  } catch (error) {
    next(error);
  }
});

router.post("/:id/notes", requirePermission("contacts.manage"), async (req, res, next) => {
  try {
    const body = String(req.body.body || "").trim();
    if (!body) return res.status(400).json({ message: "Write an internal note before saving" });
    const message = await ContactMessage.findById(req.params.id);
    if (!message) return res.status(404).json({ message: "Website enquiry not found" });
    message.internalNotes.push({
      body,
      createdBy: { user: req.user._id, name: req.user.name, email: req.user.email }
    });
    if (message.status === "New") {
      message.status = "In Progress";
      message.firstRespondedAt = message.firstRespondedAt || new Date();
    }
    message.lastActivityAt = new Date();
    await message.save();
    await logActivity(req, {
      module: "Website Enquiries",
      action: "Internal note added",
      entityType: "ContactMessage",
      entityId: message._id,
      summary: `Internal note added to ${message.subject}`
    });
    res.status(201).json(message);
  } catch (error) {
    next(error);
  }
});

export default router;
