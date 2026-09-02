import express from "express";
import Application from "../models/Application.js";
import Candidate from "../models/Candidate.js";
import Interview from "../models/Interview.js";
import Invoice from "../models/Invoice.js";
import Job from "../models/Job.js";
import RecruitmentSubmission from "../models/RecruitmentSubmission.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { canViewFinance } from "../config/permissions.js";

const router = express.Router();
router.use(protect, requirePermission("reports.view"));

router.get("/recruitment", async (req, res, next) => {
  try {
    const days = Math.min(730, Math.max(30, Number(req.query.days || 365)));
    const from = new Date(Date.now() - days * 86400000);
    const [sourceQuality, applicationSources, recruiterPerformance, funnel, filledJobs, applicationTrend, placementStats, openVacancies] = await Promise.all([
      Candidate.aggregate([{ $match: { createdAt: { $gte: from } } }, { $group: { _id: { $ifNull: ["$source", "Unknown"] }, candidates: { $sum: 1 }, placements: { $sum: { $cond: [{ $eq: ["$status", "Placed"] }, 1, 0] } } } }, { $sort: { candidates: -1 } }, { $limit: 12 }]),
      Application.aggregate([{ $match: { createdAt: { $gte: from } } }, { $group: { _id: { $ifNull: ["$attribution.source", "Direct"] }, applications: { $sum: 1 }, shortlisted: { $sum: { $cond: [{ $eq: ["$status", "Shortlisted"] }, 1, 0] } } } }, { $sort: { applications: -1 } }, { $limit: 12 }]),
      RecruitmentSubmission.aggregate([{ $match: { createdAt: { $gte: from } } }, { $group: { _id: "$submittedBy.user", name: { $first: "$submittedBy.name" }, submitted: { $sum: 1 }, clientReview: { $sum: { $cond: [{ $in: ["$stage", ["Client review", "Interview requested", "Interview scheduled", "Offer stage", "Hired"]] }, 1, 0] } }, hired: { $sum: { $cond: [{ $eq: ["$stage", "Hired"] }, 1, 0] } } } }, { $sort: { hired: -1, submitted: -1 } }, { $limit: 15 }]),
      RecruitmentSubmission.aggregate([{ $match: { createdAt: { $gte: from } } }, { $group: { _id: "$stage", count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Job.find({ vacancyStatus: "Filled", closedAt: { $gte: from } }).select("createdAt closedAt title").lean(),
      Application.aggregate([{ $match: { createdAt: { $gte: from } } }, { $group: { _id: { year: { $year: "$createdAt" }, month: { $month: "$createdAt" } }, count: { $sum: 1 }, shortlisted: { $sum: { $cond: [{ $eq: ["$status", "Shortlisted"] }, 1, 0] } } } }, { $sort: { "_id.year": 1, "_id.month": 1 } }]),
      Interview.aggregate([{ $match: { createdAt: { $gte: from } } }, { $group: { _id: null, interviews: { $sum: 1 }, placements: { $sum: { $cond: [{ $eq: ["$candidateSelected", "Yes"] }, 1, 0] } }, revenue: { $sum: "$revenue" } } }]),
      Job.countDocuments({ vacancyStatus: "Open", $or: [{ publicationStatus: "Approved" }, { publicationStatus: { $exists: false } }] })
    ]);
    const fillDays = filledJobs.map((job) => Math.max(0, (new Date(job.closedAt) - new Date(job.createdAt)) / 86400000)).filter(Number.isFinite);
    const totalCandidates = sourceQuality.reduce((sum, source) => sum + source.candidates, 0);
    const totalPlacements = sourceQuality.reduce((sum, source) => sum + source.placements, 0);
    const placement = placementStats[0] || { interviews: 0, placements: 0, revenue: 0 };
    const response = {
      periodDays: days,
      metrics: { openVacancies, candidates: totalCandidates, placements: placement.placements || totalPlacements, averageTimeToFillDays: fillDays.length ? Math.round((fillDays.reduce((sum, value) => sum + value, 0) / fillDays.length) * 10) / 10 : 0, interviewToPlacementRate: placement.interviews ? Math.round((placement.placements / placement.interviews) * 100) : 0 },
      sourceQuality: sourceQuality.map((item) => ({ source: item._id, candidates: item.candidates, placements: item.placements, conversionRate: item.candidates ? Math.round((item.placements / item.candidates) * 100) : 0 })),
      applicationSources: applicationSources.map((item) => ({ source: item._id, applications: item.applications, shortlisted: item.shortlisted, conversionRate: item.applications ? Math.round((item.shortlisted / item.applications) * 100) : 0 })),
      recruiterPerformance: recruiterPerformance.map((item) => ({ ...item, conversionRate: item.submitted ? Math.round((item.hired / item.submitted) * 100) : 0 })),
      funnel: funnel.map((item) => ({ stage: item._id, count: item.count })),
      applicationTrend: applicationTrend.map((item) => ({ month: `${item._id.year}-${String(item._id.month).padStart(2, "0")}`, count: item.count, shortlisted: item.shortlisted }))
    };
    if (canViewFinance(req.user)) {
      const invoice = await Invoice.aggregate([{ $match: { issueDate: { $gte: from }, status: { $ne: "Cancelled" } } }, { $group: { _id: null, invoiced: { $sum: "$total" }, collected: { $sum: "$amountPaid" }, outstanding: { $sum: "$balanceDue" } } }]);
      response.finance = { placementRevenue: placement.revenue || 0, invoiced: invoice[0]?.invoiced || 0, collected: invoice[0]?.collected || 0, outstanding: invoice[0]?.outstanding || 0 };
    }
    res.json(response);
  } catch (error) { next(error); }
});

export default router;
