import express from "express";
import EmployeeSuggestion, { suggestionStatuses } from "../models/EmployeeSuggestion.js";
import PortalNotification from "../models/PortalNotification.js";
import User from "../models/User.js";
import { hasPermission } from "../config/permissions.js";
import { protect } from "../middleware/auth.js";
import { logActivity } from "../services/activityLogService.js";

const router = express.Router();
const kinds = ["Suggestion", "Process Improvement", "Portal Idea", "Workplace Feedback", "Concern"];
const areas = ["Recruitment", "Sales & CRM", "Training", "People & Culture", "Portal & Technology", "General"];
const impacts = ["Low", "Medium", "High"];

router.use(protect);

function canManage(user) {
  return ["admin", "super_admin"].includes(user?.role) || hasPermission(user, "team.manage");
}

function publicSuggestion(item, req) {
  const suggestion = item.toObject ? item.toObject() : { ...item };
  const own = String(suggestion.submittedBy?.user || "") === String(req.user._id);
  suggestion.isOwn = own;
  if (suggestion.anonymous) {
    suggestion.submittedBy = { name: own ? "You (anonymous)" : "Anonymous employee", role: "Employee" };
  } else if (!canManage(req.user) && !own) {
    delete suggestion.submittedBy;
  }
  return suggestion;
}

router.get("/", async (req, res, next) => {
  try {
    const manager = canManage(req.user);
    const baseFilter = manager ? {} : { "submittedBy.user": req.user._id };
    const filter = { ...baseFilter };
    if (manager && suggestionStatuses.includes(req.query.status)) filter.status = req.query.status;
    if (manager && kinds.includes(req.query.kind)) filter.kind = req.query.kind;
    if (manager && req.query.search) {
      const escaped = String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const search = new RegExp(escaped, "i");
      filter.$or = [{ title: search }, { message: search }, { "submittedBy.name": search }];
    }
    const [items, statusCounts] = await Promise.all([
      EmployeeSuggestion.find(filter).sort({ createdAt: -1 }).limit(200),
      EmployeeSuggestion.aggregate([
        { $match: baseFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ])
    ]);
    const stats = Object.fromEntries(suggestionStatuses.map((status) => [status, statusCounts.find((item) => item._id === status)?.count || 0]));
    stats.total = Object.values(stats).reduce((sum, value) => sum + value, 0);
    res.json({ items: items.map((item) => publicSuggestion(item, req)), stats, canManage: manager });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const title = String(req.body.title || "").trim();
    const message = String(req.body.message || "").trim();
    if (title.length < 5) return res.status(400).json({ message: "Add a clear suggestion title" });
    if (message.length < 15) return res.status(400).json({ message: "Please add a little more detail to your suggestion" });
    const suggestion = await EmployeeSuggestion.create({
      title,
      message,
      kind: kinds.includes(req.body.kind) ? req.body.kind : "Suggestion",
      area: areas.includes(req.body.area) ? req.body.area : "General",
      impact: impacts.includes(req.body.impact) ? req.body.impact : "Medium",
      anonymous: Boolean(req.body.anonymous),
      submittedBy: { user: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role },
      statusHistory: [{ status: "Submitted", changedBy: req.body.anonymous ? "Anonymous employee" : req.user.name }]
    });

    const managers = await User.find({
      isActive: true,
      _id: { $ne: req.user._id },
      $or: [{ role: { $in: ["admin", "super_admin"] } }, { permissions: "team.manage" }]
    }).select("_id").lean();
    if (managers.length) {
      await PortalNotification.insertMany(managers.map((manager) => ({
        user: manager._id,
        type: "suggestion_created",
        title: "New employee suggestion",
        message: `${suggestion.anonymous ? "An employee" : req.user.name} submitted: ${suggestion.title}`,
        link: "/admin/suggestions",
        entityType: "EmployeeSuggestion",
        entityId: suggestion._id,
        actor: suggestion.anonymous ? undefined : { user: req.user._id, name: req.user.name }
      })), { ordered: false }).catch(() => {});
    }
    await logActivity(req, { module: "Suggestions", action: "Suggestion submitted", entityType: "EmployeeSuggestion", entityId: suggestion._id, summary: `${suggestion.anonymous ? "An employee" : req.user.name} submitted a suggestion` });
    res.status(201).json({ message: "Thank you — your suggestion has been submitted for review", item: publicSuggestion(suggestion, req) });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    if (!canManage(req.user)) return res.status(403).json({ message: "Only workspace administrators can review suggestions" });
    const suggestion = await EmployeeSuggestion.findById(req.params.id);
    if (!suggestion) return res.status(404).json({ message: "Suggestion not found" });
    const nextStatus = suggestionStatuses.includes(req.body.status) ? req.body.status : suggestion.status;
    const adminResponse = String(req.body.adminResponse || "").trim();
    const changed = nextStatus !== suggestion.status || adminResponse !== (suggestion.adminResponse || "");
    suggestion.status = nextStatus;
    suggestion.adminResponse = adminResponse;
    suggestion.reviewedBy = { user: req.user._id, name: req.user.name };
    suggestion.statusUpdatedAt = new Date();
    if (changed) suggestion.statusHistory.push({ status: nextStatus, note: adminResponse, changedBy: req.user.name });
    await suggestion.save();

    if (String(suggestion.submittedBy.user) !== String(req.user._id)) {
      await PortalNotification.create({
        user: suggestion.submittedBy.user,
        type: "suggestion_updated",
        title: "Suggestion update",
        message: `Your suggestion “${suggestion.title}” is now ${nextStatus}.`,
        link: "/admin/suggestions",
        entityType: "EmployeeSuggestion",
        entityId: suggestion._id,
        actor: { user: req.user._id, name: req.user.name }
      }).catch(() => {});
    }
    await logActivity(req, { module: "Suggestions", action: "Suggestion reviewed", entityType: "EmployeeSuggestion", entityId: suggestion._id, summary: `${req.user.name} moved ${suggestion.title} to ${nextStatus}` });
    res.json({ message: "Suggestion review updated", item: publicSuggestion(suggestion, req) });
  } catch (error) {
    next(error);
  }
});

export default router;
