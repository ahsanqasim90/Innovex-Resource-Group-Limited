import express from "express";
import Interview from "../models/Interview.js";
import { protect } from "../middleware/auth.js";
import { pick, requireFields, validateEmail } from "../utils.js";
import { runInterviewReminders } from "../services/interviewReminderService.js";

const router = express.Router();
const fields = [
  "candidateName",
  "candidateEmail",
  "candidatePhone",
  "candidatePostcode",
  "visaStatus",
  "jobTitle",
  "clientName",
  "interviewDate",
  "interviewTime",
  "interviewType",
  "interviewStatus",
  "notes",
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

function toPayload(body) {
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
  return payload;
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
    Interview.countDocuments({ interviewStatus: "Pending" }),
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

router.use(protect);

router.get("/stats/dashboard", async (req, res, next) => {
  try {
    res.json(await dashboardStats());
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    const { search, status, date, jobTitle, selected } = req.query;

    if (status) filter.interviewStatus = status;
    if (jobTitle) filter.jobTitle = new RegExp(jobTitle, "i");
    if (selected) filter.candidateSelected = selected;
    const dateFilter = makeDateFilter(date);
    if (dateFilter) filter.interviewDate = dateFilter;
    if (search) {
      filter.$or = [
        { candidateName: new RegExp(search, "i") },
        { clientName: new RegExp(search, "i") },
        { jobTitle: new RegExp(search, "i") }
      ];
    }

    const interviews = await Interview.find(filter).sort({ interviewDate: -1, interviewTime: -1, createdAt: -1 });
    res.json(interviews);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ message: "Interview not found" });
    res.json(interview);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    requireFields(req.body, ["candidateName", "candidateEmail", "candidatePhone", "jobTitle", "clientName", "interviewDate", "interviewTime"]);
    validateEmail(req.body.candidateEmail);
    const interview = await Interview.create(toPayload(req.body));
    res.status(201).json(interview);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (req.body.candidateEmail) validateEmail(req.body.candidateEmail);
    const interview = await Interview.findById(req.params.id);
    if (!interview) return res.status(404).json({ message: "Interview not found" });
    Object.assign(interview, toPayload(req.body));
    await interview.save();
    res.json(interview);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const interview = await Interview.findByIdAndDelete(req.params.id);
    if (!interview) return res.status(404).json({ message: "Interview not found" });
    res.json({ message: "Interview deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
