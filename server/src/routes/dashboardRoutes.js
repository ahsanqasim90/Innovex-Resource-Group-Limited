import express from "express";
import Application from "../models/Application.js";
import Candidate from "../models/Candidate.js";
import CallLog from "../models/CallLog.js";
import ContactMessage from "../models/ContactMessage.js";
import CvUpload from "../models/CvUpload.js";
import ActivityLog from "../models/ActivityLog.js";
import Interview from "../models/Interview.js";
import Job from "../models/Job.js";
import Meeting from "../models/Meeting.js";
import Partner from "../models/Partner.js";
import Testimonial from "../models/Testimonial.js";
import TrainingBooking from "../models/TrainingBooking.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { canViewFinance } from "../config/permissions.js";

const router = express.Router();
router.use(protect, requirePermission("dashboard.view"));

function stripInterviewFinance(interview) {
  const item = interview?.toObject ? interview.toObject() : { ...interview };
  [
    "selectedPayRate",
    "hoursPerWeek",
    "placementType",
    "flatFeeAmount",
    "percentage",
    "revenue"
  ].forEach((field) => delete item[field]);
  return item;
}

function stripTrainingFinance(booking) {
  const item = booking?.toObject ? booking.toObject() : { ...booking };
  ["quotedPrice", "actualTrainerCost", "otherExpenses", "profit", "paymentStatus"].forEach((field) => delete item[field]);
  if (item.trainer) {
    delete item.trainer.fee;
    delete item.trainer.paymentStatus;
  }
  return item;
}

router.get("/stats", async (req, res, next) => {
  try {
    const showFinance = canViewFinance(req.user);
    const [
      activeJobs,
      applications,
      newCvs,
      pendingReviews,
      partners,
      recentApplications,
      messages,
      pendingInterviews,
      selectedCandidates,
      rejectedCandidates,
      revenueAgg,
      recentInterviews,
      upcomingMeetings,
      recentMeetings,
      totalTrainingBookings,
      upcomingTrainingSessions,
      trainingFinance,
      trainingReminders,
      recentTrainingBookings,
      totalCandidates,
      availableCandidates,
      interestedTalent,
      todayCalls,
      followUpsDue,
      recentCalls,
      recentActivityLogs
    ] = await Promise.all([
      Job.countDocuments({ isActive: true }),
      Application.countDocuments(),
      CvUpload.countDocuments({ status: "New" }),
      Testimonial.countDocuments({ status: "Pending" }),
      Partner.countDocuments({ isActive: true }),
      Application.find().populate("job").sort({ createdAt: -1 }).limit(6),
      ContactMessage.countDocuments({ status: "New" }),
      Interview.countDocuments({ interviewStatus: "Pending" }),
      Interview.countDocuments({ candidateSelected: "Yes" }),
      Interview.countDocuments({ candidateSelected: "No" }),
      Interview.aggregate([{ $group: { _id: null, totalRevenue: { $sum: "$revenue" } } }]),
      Interview.find().sort({ interviewDate: -1, interviewTime: -1, createdAt: -1 }).limit(6),
      Meeting.countDocuments({ meetingStatus: "Upcoming", meetingDate: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
      Meeting.find().sort({ meetingDate: -1, meetingTime: -1, createdAt: -1 }).limit(6),
      TrainingBooking.countDocuments(),
      TrainingBooking.countDocuments({ trainingDate: { $gte: new Date() }, bookingStatus: { $nin: ["Cancelled", "Completed"] } }),
      TrainingBooking.aggregate([
        {
          $group: {
            _id: null,
            totalQuotedRevenue: { $sum: "$quotedPrice" },
            totalTrainerCosts: { $sum: "$actualTrainerCost" },
            totalTrainingProfit: { $sum: "$profit" }
          }
        }
      ]),
      TrainingBooking.find({
        trainingDate: { $gte: new Date(), $lte: new Date(Date.now() + 48 * 60 * 60 * 1000) },
        bookingStatus: { $nin: ["Cancelled", "Completed"] }
      }).sort({ trainingDate: 1, trainingStartTime: 1 }).limit(8),
      TrainingBooking.find().sort({ trainingDate: -1, trainingStartTime: -1, createdAt: -1 }).limit(6),
      Candidate.countDocuments(),
      Candidate.countDocuments({ status: "Available" }),
      Candidate.countDocuments({ status: "Interested" }),
      CallLog.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
      CallLog.countDocuments({
        followUpAt: {
          $gte: new Date(new Date().setHours(0, 0, 0, 0)),
          $lt: new Date(new Date().setHours(24, 0, 0, 0))
        },
        outcome: "Call Back"
      }),
      CallLog.find().sort({ createdAt: -1 }).limit(6),
      showFinance ? ActivityLog.find().sort({ createdAt: -1 }).limit(10) : Promise.resolve([])
    ]);

    const stats = {
      activeJobs,
      applications,
      newCvs,
      pendingReviews,
      partners,
      placements: 128,
      messages,
      pendingInterviews,
      selectedCandidates,
      rejectedCandidates,
      upcomingMeetings,
      totalTrainingBookings,
      upcomingTrainingSessions,
      totalCandidates,
      availableCandidates,
      interestedTalent,
      todayCalls,
      followUpsDue
    };

    if (showFinance) {
      stats.totalRevenue = revenueAgg[0]?.totalRevenue || 0;
      stats.totalQuotedRevenue = trainingFinance[0]?.totalQuotedRevenue || 0;
      stats.totalTrainerCosts = trainingFinance[0]?.totalTrainerCosts || 0;
      stats.totalTrainingProfit = trainingFinance[0]?.totalTrainingProfit || 0;
    }

    res.json({
      stats,
      recentApplications,
      recentInterviews: showFinance ? recentInterviews : recentInterviews.map(stripInterviewFinance),
      recentMeetings,
      recentCalls,
      trainingReminders: showFinance ? trainingReminders : trainingReminders.map(stripTrainingFinance),
      recentTrainingBookings: showFinance ? recentTrainingBookings : recentTrainingBookings.map(stripTrainingFinance),
      recentActivityLogs
    });
  } catch (error) {
    next(error);
  }
});

export default router;
