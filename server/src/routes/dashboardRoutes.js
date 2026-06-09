import express from "express";
import Application from "../models/Application.js";
import ContactMessage from "../models/ContactMessage.js";
import CvUpload from "../models/CvUpload.js";
import Interview from "../models/Interview.js";
import Job from "../models/Job.js";
import Meeting from "../models/Meeting.js";
import Partner from "../models/Partner.js";
import Testimonial from "../models/Testimonial.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);

router.get("/stats", async (req, res, next) => {
  try {
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
      recentMeetings
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
      Meeting.find().sort({ meetingDate: -1, meetingTime: -1, createdAt: -1 }).limit(6)
    ]);

    res.json({
      stats: {
        activeJobs,
        applications,
        newCvs,
        pendingReviews,
        partners,
        placements: 128,
        messages,
        totalRevenue: revenueAgg[0]?.totalRevenue || 0,
        pendingInterviews,
        selectedCandidates,
        rejectedCandidates,
        upcomingMeetings
      },
      recentApplications,
      recentInterviews,
      recentMeetings
    });
  } catch (error) {
    next(error);
  }
});

export default router;
