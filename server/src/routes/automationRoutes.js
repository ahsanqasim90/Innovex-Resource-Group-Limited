import express from "express";
import AutomationRule from "../models/AutomationRule.js";
import AutomationRun from "../models/AutomationRun.js";
import AutomationTask from "../models/AutomationTask.js";
import User from "../models/User.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { conditionsMatch } from "../services/automationService.js";
import { logActivity } from "../services/activityLogService.js";
import { pick, requireFields } from "../utils.js";

const router = express.Router();
router.use(protect);

router.get("/overview", requirePermission("automations.view"), async (req, res, next) => {
  try {
    const now = new Date();
    const [rules, openTasks, overdueTasks, failedRuns, recentRuns, tasks, team] = await Promise.all([
      AutomationRule.find().sort({ enabled: -1, updatedAt: -1 }).lean(),
      AutomationTask.countDocuments({ status: "Open" }),
      AutomationTask.countDocuments({ status: "Open", dueAt: { $lt: now } }),
      AutomationRun.countDocuments({ status: "Failed", createdAt: { $gte: new Date(Date.now() - 7 * 86400000) } }),
      AutomationRun.find().sort({ createdAt: -1 }).limit(20).lean(),
      AutomationTask.find({ status: "Open" }).populate("assignedTo", "name email").sort({ dueAt: 1 }).limit(50).lean(),
      User.find({ isActive: true }).select("name email role").sort({ name: 1 }).lean()
    ]);
    res.json({ rules, tasks, recentRuns, team, metrics: { enabledRules: rules.filter((rule) => rule.enabled).length, totalRules: rules.length, openTasks, overdueTasks, failedRuns } });
  } catch (error) { next(error); }
});

router.post("/rules", requirePermission("automations.manage"), async (req, res, next) => {
  try {
    requireFields(req.body, ["name", "trigger", "actions"]);
    const rule = await AutomationRule.create({ ...pick(req.body, ["name", "description", "enabled", "trigger", "conditions", "actions"]), createdBy: req.user._id, updatedBy: req.user._id });
    await logActivity(req, { module: "Automations", action: "Rule created", entityType: "AutomationRule", entityId: rule._id, summary: `${rule.name} automation created` });
    res.status(201).json(rule);
  } catch (error) { next(error); }
});

router.put("/rules/:id", requirePermission("automations.manage"), async (req, res, next) => {
  try {
    const rule = await AutomationRule.findById(req.params.id);
    if (!rule) return res.status(404).json({ message: "Automation rule not found" });
    rule.set(pick(req.body, ["name", "description", "enabled", "trigger", "conditions", "actions"]));
    rule.updatedBy = req.user._id;
    await rule.save();
    res.json(rule);
  } catch (error) { next(error); }
});

router.delete("/rules/:id", requirePermission("automations.manage"), async (req, res, next) => {
  try {
    const rule = await AutomationRule.findById(req.params.id);
    if (!rule) return res.status(404).json({ message: "Automation rule not found" });
    await rule.archive(req.user._id, "Automation rule archived");
    res.json({ message: "Automation rule archived" });
  } catch (error) { next(error); }
});

router.post("/rules/:id/test", requirePermission("automations.manage"), async (req, res, next) => {
  try {
    const rule = await AutomationRule.findById(req.params.id);
    if (!rule) return res.status(404).json({ message: "Automation rule not found" });
    const sample = req.body.sample || {};
    res.json({ matched: conditionsMatch(rule.conditions, sample, req.body.changes || {}), renderedActions: rule.actions.map((action) => ({ type: action.type, title: action.title })) });
  } catch (error) { next(error); }
});

router.patch("/tasks/:id", requirePermission("automations.execute"), async (req, res, next) => {
  try {
    const task = await AutomationTask.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Automation task not found" });
    task.status = ["Completed", "Cancelled"].includes(req.body.status) ? req.body.status : "Open";
    task.completedAt = task.status === "Completed" ? new Date() : undefined;
    task.completedBy = task.status === "Completed" ? req.user._id : undefined;
    await task.save();
    res.json(task);
  } catch (error) { next(error); }
});

export default router;
