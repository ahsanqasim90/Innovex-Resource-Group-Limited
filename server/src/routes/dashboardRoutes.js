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
import TrainingQuotation from "../models/TrainingQuotation.js";
import BusinessLead from "../models/BusinessLead.js";
import CompliancePassport from "../models/CompliancePassport.js";
import AutomationTask from "../models/AutomationTask.js";
import SystemEvent from "../models/SystemEvent.js";
import Invoice from "../models/Invoice.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { buildDashboard } from "../services/dashboardService.js";

const router = express.Router();
router.use(protect, requirePermission("dashboard.view"));
const models = { Application, Candidate, CallLog, ContactMessage, CvUpload, ActivityLog, Interview, Job, Meeting, Partner, Testimonial, TrainingBooking, TrainingQuotation, BusinessLead, CompliancePassport, AutomationTask, SystemEvent, Invoice };
router.get("/stats", async (req, res, next) => {
  try { res.json(await buildDashboard(req.user, models)); }
  catch (error) { next(error); }
});
export default router;
