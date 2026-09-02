import express from "express";
import Candidate from "../models/Candidate.js";
import PortalAccount from "../models/PortalAccount.js";
import SchedulingRequest from "../models/SchedulingRequest.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { sendSystemEmail } from "../services/emailService.js";
import { logActivity } from "../services/activityLogService.js";
import { requireFields, validateEmail } from "../utils.js";

const router = express.Router();
router.use(protect, requirePermission("interviews.view"));
const html = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);

router.get("/", async (req, res, next) => {
  try {
    await SchedulingRequest.updateMany({ status: "Sent", expiresAt: { $lte: new Date() } }, { status: "Expired" });
    const requests = await SchedulingRequest.find().populate("interview", "interviewDate interviewTime interviewStatus").populate("createdBy", "name email").sort({ createdAt: -1 }).limit(100).lean();
    res.json(requests);
  } catch (error) { next(error); }
});

router.post("/", async (req, res, next) => {
  try {
    requireFields(req.body, ["candidateName", "candidateEmail", "candidatePhone", "jobTitle", "clientName"]);
    validateEmail(req.body.candidateEmail);
    const email = String(req.body.candidateEmail).trim().toLowerCase();
    const portal = await PortalAccount.findOne({ type: "Candidate", email, status: "Active" });
    if (!portal) return res.status(409).json({ message: "Activate this candidate's portal account before sending a self-scheduling request" });
    const slotValues = (Array.isArray(req.body.slots) ? req.body.slots : []).map((value) => new Date(value)).filter((value) => !Number.isNaN(value.getTime()) && value > new Date()).sort((a, b) => a - b);
    const uniqueSlots = [...new Map(slotValues.map((value) => [value.toISOString(), value])).values()].slice(0, 12);
    if (!uniqueSlots.length) return res.status(400).json({ message: "Add at least one future interview slot" });
    const candidate = await Candidate.findOne({ email }).select("_id").lean();
    const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : new Date(Math.min(uniqueSlots.at(-1).getTime(), Date.now() + 14 * 86400000));
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) return res.status(400).json({ message: "Scheduling request expiry must be in the future" });
    const request = await SchedulingRequest.create({ candidate: candidate?._id, candidateName: req.body.candidateName, candidateEmail: email, candidatePhone: req.body.candidatePhone, jobTitle: req.body.jobTitle, clientName: req.body.clientName, interviewType: req.body.interviewType, location: req.body.location, instructions: req.body.instructions, timezone: req.organization.locale?.timezone || "Europe/London", slots: uniqueSlots.map((startsAt) => ({ startsAt })), expiresAt, createdBy: req.user._id });
    const portalUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/portal`;
    const delivery = await sendSystemEmail({ to: email, subject: `Choose an interview time for ${request.jobTitle}`, text: `Hello ${request.candidateName}, sign in to your secure Innovex Candidate Portal to choose an interview time for ${request.jobTitle} with ${request.clientName}: ${portalUrl}`, html: `<p>Hello ${html(request.candidateName)},</p><p>Please sign in to your secure Candidate Portal to choose an interview time for <strong>${html(request.jobTitle)}</strong> with ${html(request.clientName)}.</p><p><a href="${html(portalUrl)}">Choose interview time</a></p><p>This request expires on ${expiresAt.toLocaleDateString("en-GB")}.</p>` }).catch((error) => ({ skipped: true, reason: error.message }));
    await logActivity(req, { module: "Interviews", action: "Self-scheduling request sent", entityType: "SchedulingRequest", entityId: request._id, summary: `Sent interview slot options to ${request.candidateName}` });
    res.status(201).json({ request, emailDelivery: delivery.skipped ? "Not sent" : "Sent", emailReason: delivery.reason || "" });
  } catch (error) { next(error); }
});

router.patch("/:id/cancel", async (req, res, next) => {
  try {
    const request = await SchedulingRequest.findOne({ _id: req.params.id, status: "Sent" });
    if (!request) return res.status(404).json({ message: "Open scheduling request not found" });
    request.status = "Cancelled"; await request.save();
    res.json({ message: "Scheduling request cancelled" });
  } catch (error) { next(error); }
});

export default router;
