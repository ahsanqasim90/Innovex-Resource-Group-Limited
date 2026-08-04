import express from "express";
import Interview from "../models/Interview.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { canViewFinance } from "../config/permissions.js";
import { logActivity } from "../services/activityLogService.js";
import { pick, requireFields, validateEmail } from "../utils.js";
import { runInterviewReminders } from "../services/interviewReminderService.js";
import { sendCandidateInterviewFollowUpEmail, sendInterviewConfirmationEmail } from "../services/emailService.js";

const router = express.Router();
const fields = [
  "candidateName",
  "candidateEmail",
  "candidatePhone",
  "candidatePostcode",
  "visaStatus",
  "jobTitle",
  "clientName",
  "careHomeAddress",
  "careHomePostcode",
  "careHomeContactName",
  "careHomeContactPhone",
  "interviewInstructions",
  "interviewDate",
  "interviewTime",
  "interviewType",
  "interviewStatus",
  "notes",
  "confirmationEmailCc",
  "reminderEmailEnabled",
  "candidateSelected",
  "feedback",
  "selectedPayRate",
  "hoursPerWeek",
  "shiftType",
  "placementDate",
  "placementType",
  "flatFeeAmount",
  "percentage"
];

const financeFields = ["selectedPayRate", "hoursPerWeek", "placementType", "flatFeeAmount", "percentage"];

function normalizeCc(value) {
  const items = Array.isArray(value) ? value : String(value || "").split(",");
  return [...new Set(items.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean))];
}

function toPayload(body, user) {
  const payload = pick(body, fields);
  ["reminderEmailEnabled"].forEach((field) => {
    if (payload[field] !== undefined) payload[field] = payload[field] === true || payload[field] === "true";
  });
  ["selectedPayRate", "hoursPerWeek", "flatFeeAmount", "percentage"].forEach((field) => {
    if (payload[field] !== undefined) payload[field] = payload[field] === "" ? 0 : Number(payload[field]);
  });
  ["placementDate"].forEach((field) => {
    if (payload[field] === "") delete payload[field];
  });
  if (payload.confirmationEmailCc !== undefined) {
    payload.confirmationEmailCc = normalizeCc(payload.confirmationEmailCc);
    payload.confirmationEmailCc.forEach(validateEmail);
  }
  if (!canViewFinance(user)) {
    financeFields.forEach((field) => delete payload[field]);
  }
  return payload;
}

function sanitizeInterview(interview, user) {
  const item = interview?.toObject ? interview.toObject() : { ...interview };
  if (item.interviewStatus !== "Cancelled" && ["Yes", "No"].includes(item.candidateSelected)) {
    item.interviewStatus = "Completed";
  }
  if (canViewFinance(user)) return item;
  [...financeFields, "revenue"].forEach((field) => delete item[field]);
  return item;
}

function isUpcomingInterview(interview) {
  const interviewDate = new Date(interview.interviewDate);
  if (Number.isNaN(interviewDate.getTime())) return false;
  interviewDate.setHours(23, 59, 59, 999);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return interviewDate >= today;
}

function makeDateFilter(date) {
  if (!date) return null;
  const start = new Date(date);
  if (Number.isNaN(start.getTime())) return null;
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { $gte: start, $lt: end };
}

async function dashboardStats() {
  const [pendingInterviews, selectedCandidates, rejectedCandidates, revenueAgg, recentInterviews] = await Promise.all([
    Interview.countDocuments({ interviewStatus: "Pending", candidateSelected: "Pending" }),
    Interview.countDocuments({ candidateSelected: "Yes" }),
    Interview.countDocuments({ candidateSelected: "No" }),
    Interview.aggregate([{ $group: { _id: null, totalRevenue: { $sum: "$revenue" } } }]),
    Interview.find().sort({ interviewDate: -1, interviewTime: -1, createdAt: -1 }).limit(6)
  ]);

  return {
    pendingInterviews,
    selectedCandidates,
    rejectedCandidates,
    totalRevenue: revenueAgg[0]?.totalRevenue || 0,
    recentInterviews
  };
}

router.get("/reminders/run", async (req, res, next) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}` && req.query.secret !== secret) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(await runInterviewReminders());
  } catch (error) {
    next(error);
  }
});

router.use(protect, requirePermission("interviews.view"));

router.get("/stats/dashboard", async (req, res, next) => {
  try {
    const stats = await dashboardStats();
    stats.recentInterviews = stats.recentInterviews.map((item) => sanitizeInterview(item, req.user));
    if (!canViewFinance(req.user)) {
      delete stats.totalRevenue;
    }
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    const conditions = [];
    const { search, status, date, jobTitle, selected } = req.query;

    if (status === "Pending") {
      filter.interviewStatus = "Pending";
      filter.candidateSelected = "Pending";
    } else if (status === "Completed") {
      conditions.push({ $or: [{ interviewStatus: "Completed" }, { candidateSelected: { $in: ["Yes", "No"] } }] });
    } else if (status === "Cancelled") {
      filter.interviewStatus = "Cancelled";
    }
    if (jobTitle) filter.jobTitle = new RegExp(jobTitle, "i");
    if (selected) filter.candidateSelected = selected;
    const dateFilter = makeDateFilter(date);
    if (dateFilter) filter.interviewDate = dateFilter;
    if (search) {
      conditions.push({ $or: [
        { candidateName: new RegExp(search, "i") },
        { clientName: new RegExp(search, "i") },
        { jobTitle: new RegExp(search, "i") }
      ] });
    }
    if (conditions.length) filter.$and = conditions;

    const interviews = await Interview.find(filter).sort({ interviewDate: -1, interviewTime: -1, createdAt: -1 });
    res.json(interviews.map((item) => sanitizeInterview(item, req.user)));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ message: "Interview not found" });
    res.json(sanitizeInterview(interview, req.user));
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    requireFields(req.body, ["candidateName", "candidateEmail", "candidatePhone", "jobTitle", "clientName", "interviewDate", "interviewTime"]);
    if (req.body.interviewType === "Face-to-face") {
      requireFields(req.body, ["careHomeAddress", "careHomePostcode"]);
    }
    validateEmail(req.body.candidateEmail);
    const interview = await Interview.create(toPayload(req.body, req.user));
    try {
      const confirmation = await sendInterviewConfirmationEmail(interview);
      interview.confirmationEmailStatus = confirmation.sent ? "Sent" : "Failed";
      interview.confirmationEmailSentAt = confirmation.sent ? new Date() : undefined;
      interview.confirmationEmailError = confirmation.sent ? "" : confirmation.reason || "Email delivery failed";
      interview.confirmationEmailCount = confirmation.sent ? 1 : 0;
    } catch (emailError) {
      interview.confirmationEmailStatus = "Failed";
      interview.confirmationEmailError = emailError.message || "Email delivery failed";
    }
    await interview.save();
    await logActivity(req, {
      module: "Interviews",
      action: "Created",
      entityType: "Interview",
      entityId: interview._id,
      summary: `Booked interview for ${interview.candidateName} with ${interview.clientName}`,
      metadata: {
        jobTitle: interview.jobTitle,
        interviewDate: interview.interviewDate,
        interviewTime: interview.interviewTime,
        confirmationEmailStatus: interview.confirmationEmailStatus
      }
    });
    res.status(201).json(sanitizeInterview(interview, req.user));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (req.body.candidateEmail) validateEmail(req.body.candidateEmail);
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ message: "Interview not found" });
    Object.assign(interview, toPayload(req.body, req.user));
    if (interview.interviewType === "Face-to-face") {
      requireFields(interview, ["careHomeAddress", "careHomePostcode"]);
    }
    await interview.save();
    await logActivity(req, {
      module: "Interviews",
      action: "Updated",
      entityType: "Interview",
      entityId: interview._id,
      summary: `Updated interview for ${interview.candidateName}`,
      metadata: { jobTitle: interview.jobTitle, candidateSelected: interview.candidateSelected, interviewStatus: interview.interviewStatus }
    });
    res.json(sanitizeInterview(interview, req.user));
  } catch (error) {
    next(error);
  }
});

router.post("/:id/send-details", async (req, res, next) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ message: "Interview not found" });

    const cc = req.body.cc !== undefined ? normalizeCc(req.body.cc) : normalizeCc(interview.confirmationEmailCc);
    cc.forEach(validateEmail);
    interview.confirmationEmailCc = cc;

    try {
      const delivery = await sendInterviewConfirmationEmail(interview, cc);
      if (!delivery.sent) throw new Error(delivery.reason || "Email delivery failed");
      interview.confirmationEmailStatus = "Sent";
      interview.confirmationEmailSentAt = new Date();
      interview.confirmationEmailError = "";
      interview.confirmationEmailCount = Number(interview.confirmationEmailCount || 0) + 1;
      await interview.save();
    } catch (emailError) {
      interview.confirmationEmailStatus = "Failed";
      interview.confirmationEmailError = emailError.message || "Email delivery failed";
      await interview.save();
      return res.status(502).json({
        message: `Interview details were not sent: ${interview.confirmationEmailError}`,
        interview: sanitizeInterview(interview, req.user)
      });
    }

    await logActivity(req, {
      module: "Interviews",
      action: "Interview details email sent",
      entityType: "Interview",
      entityId: interview._id,
      summary: `Sent interview details to ${interview.candidateName}`,
      metadata: { candidateEmail: interview.candidateEmail, cc, count: interview.confirmationEmailCount }
    });
    res.json({
      message: `Interview details sent to ${interview.candidateEmail}${cc.length ? ` with CC to ${cc.join(", ")}` : ""}.`,
      interview: sanitizeInterview(interview, req.user)
    });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/follow-up", async (req, res, next) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ message: "Interview not found" });
    if (interview.interviewStatus !== "Pending" || interview.candidateSelected !== "Pending") {
      return res.status(409).json({ message: "Follow-up emails can only be sent for pending interviews awaiting an outcome." });
    }
    if (!isUpcomingInterview(interview)) {
      return res.status(409).json({ message: "This interview date has passed, so an upcoming interview follow-up cannot be sent." });
    }

    try {
      const delivery = await sendCandidateInterviewFollowUpEmail(interview);
      if (!delivery.sent) throw new Error(delivery.reason || "Email delivery failed");
      interview.candidateFollowUpEmailStatus = "Sent";
      interview.candidateFollowUpEmailSentAt = new Date();
      interview.candidateFollowUpEmailError = "";
      interview.candidateFollowUpEmailCount = Number(interview.candidateFollowUpEmailCount || 0) + 1;
      await interview.save();
    } catch (emailError) {
      interview.candidateFollowUpEmailStatus = "Failed";
      interview.candidateFollowUpEmailError = emailError.message || "Email delivery failed";
      await interview.save();
      return res.status(502).json({
        message: `Follow-up email was not sent: ${interview.candidateFollowUpEmailError}`,
        interview: sanitizeInterview(interview, req.user)
      });
    }

    await logActivity(req, {
      module: "Interviews",
      action: "Follow-up email sent",
      entityType: "Interview",
      entityId: interview._id,
      summary: `Sent interview follow-up to ${interview.candidateName}`,
      metadata: { candidateEmail: interview.candidateEmail, interviewDate: interview.interviewDate, count: interview.candidateFollowUpEmailCount }
    });
    res.json({
      message: `Professional interview follow-up sent to ${interview.candidateEmail}.`,
      interview: sanitizeInterview(interview, req.user)
    });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const interview = await Interview.findByIdAndDelete(req.params.id);
    if (!interview) return res.status(404).json({ message: "Interview not found" });
    await logActivity(req, {
      module: "Interviews",
      action: "Deleted",
      entityType: "Interview",
      entityId: interview._id,
      summary: `Deleted interview for ${interview.candidateName}`,
      metadata: { jobTitle: interview.jobTitle, clientName: interview.clientName }
    });
    res.json({ message: "Interview deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
