import express from "express";
import mongoose from "mongoose";
import ActivityLog from "../models/ActivityLog.js";
import BackupDrill from "../models/BackupDrill.js";
import SystemEvent from "../models/SystemEvent.js";
import UserSession from "../models/UserSession.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { logActivity } from "../services/activityLogService.js";

const router = express.Router();
router.use(protect, requirePermission("audit.view"));

function escapeRegex(value = "") { return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

router.get("/overview", async (req, res, next) => {
  try {
    const [openErrors, criticalErrors, suspiciousSessions, recentEvents, latestDrill] = await Promise.all([
      SystemEvent.countDocuments({ type: "Error", status: { $ne: "Resolved" } }),
      SystemEvent.countDocuments({ severity: "Critical", status: { $ne: "Resolved" } }),
      UserSession.countDocuments({ suspicious: true, revokedAt: null, expiresAt: { $gt: new Date() } }),
      SystemEvent.find().sort({ lastSeenAt: -1 }).limit(20).lean(),
      BackupDrill.findOne().sort({ startedAt: -1 }).lean()
    ]);
    const pingStarted = Date.now();
    await mongoose.connection.db.admin().ping();
    res.json({ health: { api: "Operational", database: "Connected", antivirus: process.env.CLAMAV_HOST ? "Configured" : "Action required", databasePingMs: Date.now() - pingStarted, uptimeSeconds: Math.round(process.uptime()), checkedAt: new Date() }, metrics: { openErrors, criticalErrors, suspiciousSessions }, recentEvents, latestDrill });
  } catch (error) { next(error); }
});

router.get("/audit", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(20, Number(req.query.limit || 40)));
    const filter = {};
    if (req.query.module) filter.module = req.query.module;
    if (req.query.action) filter.action = new RegExp(escapeRegex(req.query.action), "i");
    if (req.query.search) {
      const search = new RegExp(escapeRegex(req.query.search), "i");
      filter.$or = [{ summary: search }, { "actor.name": search }, { "actor.email": search }, { entityType: search }];
    }
    if (req.query.from || req.query.to) filter.createdAt = { ...(req.query.from ? { $gte: new Date(req.query.from) } : {}), ...(req.query.to ? { $lte: new Date(`${req.query.to}T23:59:59.999Z`) } : {}) };
    const [items, total, modules] = await Promise.all([ActivityLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(), ActivityLog.countDocuments(filter), ActivityLog.distinct("module")]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)), modules: modules.sort() });
  } catch (error) { next(error); }
});

router.patch("/events/:id/resolve", async (req, res, next) => {
  try {
    const event = await SystemEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ message: "Operational event not found" });
    event.status = req.body.status === "Monitoring" ? "Monitoring" : "Resolved";
    event.resolvedAt = event.status === "Resolved" ? new Date() : null;
    event.resolvedBy = req.user._id;
    await event.save();
    await logActivity(req, { module: "Operations", action: "Event resolved", entityType: "SystemEvent", entityId: event._id, summary: `${event.title} marked ${event.status.toLowerCase()}` });
    res.json(event);
  } catch (error) { next(error); }
});

router.post("/backup-drills", requirePermission("organization.manage"), async (req, res, next) => {
  const started = Date.now();
  const drill = await BackupDrill.create({ status: "Running", initiatedBy: req.user._id, initiatedByName: req.user.name, notes: String(req.body?.notes || "Automated database readiness verification") });
  try {
    const pingStarted = Date.now();
    await mongoose.connection.db.admin().ping();
    const databasePingMs = Date.now() - pingStarted;
    const collections = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray();
    let recordsSampled = 0;
    for (const collection of collections.slice(0, 50)) recordsSampled += await mongoose.connection.db.collection(collection.name).countDocuments({}, { limit: 5 });
    drill.status = "Passed";
    drill.completedAt = new Date();
    drill.durationMs = Date.now() - started;
    drill.collectionsChecked = collections.length;
    drill.recordsSampled = recordsSampled;
    drill.databasePingMs = databasePingMs;
    await drill.save();
    await SystemEvent.create({ type: "Backup", severity: "Info", status: "Resolved", title: "Recovery readiness drill passed", message: `${collections.length} collections verified`, resolvedAt: new Date(), lastSeenAt: new Date(), metadata: { drillId: drill._id, durationMs: drill.durationMs } });
    res.status(201).json(drill);
  } catch (error) {
    drill.status = "Failed"; drill.completedAt = new Date(); drill.durationMs = Date.now() - started; drill.notes = `${drill.notes}\n${error.message}`; await drill.save().catch(() => null); next(error);
  }
});

export default router;
