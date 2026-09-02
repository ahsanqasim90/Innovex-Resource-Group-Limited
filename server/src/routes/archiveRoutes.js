import express from "express";
import Application from "../models/Application.js";
import Blog from "../models/Blog.js";
import BusinessLead from "../models/BusinessLead.js";
import CallLog from "../models/CallLog.js";
import Candidate from "../models/Candidate.js";
import ClientAccount from "../models/ClientAccount.js";
import ClientTerms from "../models/ClientTerms.js";
import Course from "../models/Course.js";
import CvUpload from "../models/CvUpload.js";
import Interview from "../models/Interview.js";
import Invoice from "../models/Invoice.js";
import Job from "../models/Job.js";
import Meeting from "../models/Meeting.js";
import OfferLetter from "../models/OfferLetter.js";
import Partner from "../models/Partner.js";
import SalarySlip from "../models/SalarySlip.js";
import Testimonial from "../models/Testimonial.js";
import TrainingBooking from "../models/TrainingBooking.js";
import TrainingQuotation from "../models/TrainingQuotation.js";
import User from "../models/User.js";
import WebLeadProspect from "../models/WebLeadProspect.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { logActivity } from "../services/activityLogService.js";

const router = express.Router();
const types = {
  applications: Application,
  blogs: Blog,
  businessLeads: BusinessLead,
  calls: CallLog,
  candidates: Candidate,
  clients: ClientAccount,
  terms: ClientTerms,
  courses: Course,
  cvs: CvUpload,
  interviews: Interview,
  invoices: Invoice,
  jobs: Job,
  meetings: Meeting,
  offerLetters: OfferLetter,
  partners: Partner,
  salarySlips: SalarySlip,
  testimonials: Testimonial,
  trainingBookings: TrainingBooking,
  trainingQuotations: TrainingQuotation,
  users: User,
  webLeads: WebLeadProspect
};

router.use(protect, requirePermission("archive.manage"));

function recordLabel(record) {
  return record.name || record.title || record.companyName || record.businessName || record.candidateName || record.clientName || record.invoiceNumber || record.documentNumber || record.email || "Archived record";
}

router.get("/", async (req, res, next) => {
  try {
    const selectedTypes = req.query.type && types[req.query.type] ? [req.query.type] : Object.keys(types);
    const groups = await Promise.all(selectedTypes.map(async (type) => {
      const Model = types[type];
      const records = await Model.find({ archivedAt: { $ne: null } }).setOptions({ withArchived: true }).sort({ archivedAt: -1 }).limit(100).lean();
      return records.map((record) => ({ id: record._id, type, label: recordLabel(record), archivedAt: record.archivedAt, archivedBy: record.archivedBy, archiveReason: record.archiveReason, retentionUntil: record.retentionUntil, legalHold: record.legalHold, legalHoldReason: record.legalHoldReason }));
    }));
    const items = groups.flat().sort((a, b) => new Date(b.archivedAt) - new Date(a.archivedAt));
    res.json({ items, total: items.length });
  } catch (error) { next(error); }
});

router.post("/:type/:id/restore", async (req, res, next) => {
  try {
    const Model = types[req.params.type];
    if (!Model) return res.status(400).json({ message: "Unsupported archive type" });
    const record = await Model.findOne({ _id: req.params.id }).setOptions({ withArchived: true });
    if (!record || !record.archivedAt) return res.status(404).json({ message: "Archived record not found" });
    await record.restore();
    await logActivity(req, { module: "Archive", action: "Record restored", entityType: Model.modelName, entityId: record._id, summary: `Restored ${recordLabel(record)}` });
    res.json({ message: "Record restored" });
  } catch (error) { next(error); }
});

router.patch("/:type/:id/legal-hold", async (req, res, next) => {
  try {
    const Model = types[req.params.type];
    if (!Model) return res.status(400).json({ message: "Unsupported archive type" });
    const record = await Model.findOne({ _id: req.params.id }).setOptions({ withArchived: true });
    if (!record) return res.status(404).json({ message: "Record not found" });
    record.legalHold = Boolean(req.body.enabled);
    record.legalHoldReason = record.legalHold ? String(req.body.reason || "Legal hold applied").trim() : "";
    await record.save();
    await logActivity(req, { module: "Archive", action: record.legalHold ? "Legal hold applied" : "Legal hold removed", entityType: Model.modelName, entityId: record._id, summary: `${recordLabel(record)} legal hold ${record.legalHold ? "enabled" : "removed"}` });
    res.json({ message: `Legal hold ${record.legalHold ? "enabled" : "removed"}`, legalHold: record.legalHold });
  } catch (error) { next(error); }
});

router.delete("/:type/:id/purge", async (req, res, next) => {
  try {
    if (req.user.role !== "super_admin") return res.status(403).json({ message: "Only a platform owner can permanently purge retained data" });
    const Model = types[req.params.type];
    if (!Model) return res.status(400).json({ message: "Unsupported archive type" });
    const record = await Model.findOne({ _id: req.params.id }).setOptions({ withArchived: true });
    if (!record?.archivedAt) return res.status(404).json({ message: "Archived record not found" });
    if (record.legalHold) return res.status(409).json({ message: "This record is under legal hold and cannot be purged" });
    if (!record.retentionUntil || record.retentionUntil > new Date()) return res.status(409).json({ message: "The retention period has not ended" });
    const label = recordLabel(record);
    await record.deleteOne({ tenantBypass: false });
    await logActivity(req, { module: "Archive", action: "Record permanently purged", entityType: Model.modelName, entityId: record._id, summary: `Permanently purged ${label} after retention period` });
    res.json({ message: "Record permanently purged" });
  } catch (error) { next(error); }
});

export default router;

