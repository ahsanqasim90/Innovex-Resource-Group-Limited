import express from "express";
import Application from "../models/Application.js";
import ContactMessage from "../models/ContactMessage.js";
import CvUpload from "../models/CvUpload.js";
import Job from "../models/Job.js";
import Partner from "../models/Partner.js";
import Testimonial from "../models/Testimonial.js";
import { protect } from "../middleware/auth.js";

const router = express.Router();
router.use(protect);

router.get("/stats", async (req, res, next) => {
  try {
    const [activeJobs, applications, newCvs, pendingReviews, partners, recentApplications, messages] = await Promise.all([
      Job.countDocuments({ isActive: true }),
      Application.countDocuments(),
      CvUpload.countDocuments({ status: "New" }),
      Testimonial.countDocuments({ status: "Pending" }),
      Partner.countDocuments({ isActive: true }),
      Application.find().populate("job").sort({ createdAt: -1 }).limit(6),
      ContactMessage.countDocuments({ status: "New" })
    ]);

    res.json({
      stats: {
        activeJobs,
        applications,
        newCvs,
        pendingReviews,
        partners,
        placements: 128,
        messages
      },
      recentApplications
    });
  } catch (error) {
    next(error);
  }
});

export default router;
