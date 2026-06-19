import express from "express";
import mongoose from "mongoose";
import BusinessLead from "../models/BusinessLead.js";
import CallLog from "../models/CallLog.js";
import Candidate from "../models/Candidate.js";
import { allowedCallerIdsForUser, outboundCallerIds, resolveCallerIdForUser } from "../config/calling.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { logActivity } from "../services/activityLogService.js";
import { normalizePhone, startYayOutboundCall, testYayConnection, yayConfigStatus } from "../services/yayCallService.js";
import { pick, requireFields } from "../utils.js";

const router = express.Router();
router.use(protect, requirePermission("calls.view"));

const updateFields = ["status", "outcome", "durationSeconds", "followUpAt", "notes"];

function actorFromReq(req) {
  return {
    user: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role
  };
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function resolveTarget(body) {
  const targetType = body.targetType || "Manual";
  const targetId = body.targetId;

  if (targetType === "Candidate" && mongoose.Types.ObjectId.isValid(targetId)) {
    const candidate = await Candidate.findById(targetId);
    if (!candidate) {
      const error = new Error("Candidate not found");
      error.statusCode = 404;
      throw error;
    }
    return {
      targetType,
      targetId: candidate._id,
      targetName: candidate.name,
      targetPhone: candidate.phone,
      sourceModule: "Talent Pool",
      record: candidate
    };
  }

  if (targetType === "BusinessLead" && mongoose.Types.ObjectId.isValid(targetId)) {
    const lead = await BusinessLead.findById(targetId);
    if (!lead) {
      const error = new Error("Business lead not found");
      error.statusCode = 404;
      throw error;
    }
    return {
      targetType,
      targetId: lead._id,
      targetName: lead.companyName,
      targetPhone: lead.phone,
      sourceModule: "Business Leads",
      record: lead
    };
  }

  return {
    targetType: "Manual",
    targetName: body.targetName,
    targetPhone: body.targetPhone || body.phone,
    sourceModule: body.sourceModule || "Calls"
  };
}

async function markTargetContacted(target) {
  if (!target?.record) return;
  target.record.lastContactedAt = new Date();
  if (target.targetType === "Candidate" && target.record.status === "Available") target.record.status = "Contacted";
  if (target.targetType === "BusinessLead" && target.record.status === "New") target.record.status = "Contacted";
  await target.record.save();
}

router.get("/config/status", (req, res) => {
  res.json({
    ...yayConfigStatus(),
    companyCallerIds: outboundCallerIds(),
    allowedCallerIds: allowedCallerIdsForUser(req.user)
  });
});

router.post("/config/test", async (req, res, next) => {
  try {
    const result = await testYayConnection();
    res.status(result.ok ? 200 : 400).json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/stats/summary", async (req, res, next) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [total, todayCalls, connected, failed, followUpsDue] = await Promise.all([
      CallLog.countDocuments(),
      CallLog.countDocuments({ createdAt: { $gte: today } }),
      CallLog.countDocuments({ status: { $in: ["Connected", "Completed"] } }),
      CallLog.countDocuments({ status: "Failed" }),
      CallLog.countDocuments({ followUpAt: { $gte: today, $lt: tomorrow }, outcome: "Call Back" })
    ]);

    res.json({ total, todayCalls, connected, failed, followUpsDue });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);
    const skip = (page - 1) * limit;
    const filter = {};

    if (req.query.search) {
      const regex = new RegExp(escapeRegex(req.query.search), "i");
      filter.$or = [{ targetName: regex }, { targetPhone: regex }, { notes: regex }, { sourceModule: regex }];
    }
    if (req.query.status) filter.status = req.query.status;
    if (req.query.outcome) filter.outcome = req.query.outcome;
    if (req.query.targetType) filter.targetType = req.query.targetType;

    const [items, total] = await Promise.all([
      CallLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      CallLog.countDocuments(filter)
    ]);

    res.json({ items, total, page, pages: Math.ceil(total / limit) || 1, limit });
  } catch (error) {
    next(error);
  }
});

router.post("/start", async (req, res, next) => {
  try {
    const target = await resolveTarget(req.body);
    const phone = normalizePhone(target.targetPhone);
    const outboundCallerId = resolveCallerIdForUser(req.user, req.body.outboundCallerId || req.body.callerId);
    requireFields({ targetName: target.targetName, targetPhone: phone }, ["targetName", "targetPhone"]);

    const call = await CallLog.create({
      targetType: target.targetType,
      targetId: target.targetId,
      targetName: target.targetName,
      targetPhone: phone,
      outboundCallerId,
      sourceModule: target.sourceModule,
      status: "Queued",
      notes: req.body.notes,
      initiatedBy: actorFromReq(req)
    });

    let yayResult;
    try {
      yayResult = await startYayOutboundCall({ phone, targetName: target.targetName, callerId: outboundCallerId });
    } catch (error) {
      yayResult = {
        ok: false,
        configured: yayConfigStatus().configured,
        message: error.message || "Yay request failed."
      };
    }

    call.status = yayResult.ok ? "Dialling" : yayResult.skipped ? "Logged" : "Failed";
    call.yay = {
      requestPayload: yayResult.payload || {},
      responsePayload: yayResult.responsePayload || {},
      attempts: yayResult.attempts || [],
      requestUrl: yayResult.url || "",
      requestStatus: yayResult.status,
      configured: Boolean(yayResult.configured),
      message: yayResult.message || ""
    };
    await call.save();

    await markTargetContacted(target);
    await logActivity(req, {
      module: "Calls",
      action: "start",
      entityType: "CallLog",
      entityId: call._id,
      summary: `${req.user.name} started a call to ${target.targetName}`,
      metadata: { targetType: target.targetType, targetPhone: phone, outboundCallerId, yayConfigured: Boolean(yayResult.configured) }
    });

    res.status(201).json({ call, yay: yayResult });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", async (req, res, next) => {
  try {
    const payload = pick(req.body, updateFields);
    if (payload.followUpAt === "") payload.followUpAt = undefined;
    const call = await CallLog.findByIdAndUpdate(req.params.id, payload, { new: true, runValidators: true });
    if (!call) return res.status(404).json({ message: "Call log not found" });

    await logActivity(req, {
      module: "Calls",
      action: "update",
      entityType: "CallLog",
      entityId: call._id,
      summary: `${req.user.name} updated call outcome for ${call.targetName}`,
      metadata: { status: call.status, outcome: call.outcome }
    });

    res.json(call);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const call = await CallLog.findByIdAndDelete(req.params.id);
    if (!call) return res.status(404).json({ message: "Call log not found" });
    await logActivity(req, {
      module: "Calls",
      action: "delete",
      entityType: "CallLog",
      entityId: call._id,
      summary: `${req.user.name} deleted a call log for ${call.targetName}`
    });
    res.json({ message: "Call log deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
