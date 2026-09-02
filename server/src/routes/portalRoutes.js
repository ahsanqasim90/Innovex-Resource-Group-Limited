import crypto from "node:crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import Application from "../models/Application.js";
import ActivityLog from "../models/ActivityLog.js";
import Candidate from "../models/Candidate.js";
import ClientAccount from "../models/ClientAccount.js";
import ClientTerms from "../models/ClientTerms.js";
import CompliancePassport from "../models/CompliancePassport.js";
import Interview from "../models/Interview.js";
import Invoice from "../models/Invoice.js";
import Job from "../models/Job.js";
import OfferLetter from "../models/OfferLetter.js";
import PortalAccount from "../models/PortalAccount.js";
import PortalSession from "../models/PortalSession.js";
import RecruitmentSubmission from "../models/RecruitmentSubmission.js";
import SchedulingRequest from "../models/SchedulingRequest.js";
import { protectPortal } from "../middleware/portalAuth.js";
import { tokenHash } from "../utils/authSecurity.js";
import { requireFields, validateEmail } from "../utils.js";
import { sendInterviewConfirmationEmail } from "../services/emailService.js";
import { generateOfferLetterPdf } from "../services/hrPdfService.js";

const router = express.Router();
const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false, message: { message: "Too many portal attempts. Please wait and try again." } });
const cookieName = () => process.env.NODE_ENV === "production" ? "__Host-innovex_portal" : "innovex_portal";

function publicAccount(account) { return { id: account._id, type: account.type, name: account.name, email: account.email, candidateId: account.candidate, clientAccountId: account.clientAccount }; }

async function issueSession(req, res, account) {
  const jti = crypto.randomUUID(); const csrf = crypto.randomBytes(24).toString("hex"); const maxAge = 8 * 60 * 60 * 1000;
  const token = jwt.sign({ audience: "portal", accountId: account._id, organizationId: account.organization, sessionVersion: account.sessionVersion || 1, jti, csrf }, process.env.JWT_SECRET, { expiresIn: "8h" });
  await PortalSession.create({ account: account._id, jtiHash: tokenHash(jti), ipAddress: req.ip, userAgent: req.get("user-agent") || "", expiresAt: new Date(Date.now() + maxAge) });
  res.cookie(cookieName(), token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge });
  return csrf;
}

router.get("/invitation/:token", limiter, async (req, res, next) => {
  try {
    const account = await PortalAccount.findOne({ invitationTokenHash: tokenHash(req.params.token), status: "Invited", invitationExpiresAt: { $gt: new Date() } }).select("+invitationTokenHash");
    if (!account) return res.status(404).json({ message: "Portal invitation is invalid or has expired" });
    res.json({ type: account.type, name: account.name, email: account.email, organization: req.organization.name, expiresAt: account.invitationExpiresAt });
  } catch (error) { next(error); }
});

router.post("/invitation/:token/activate", limiter, async (req, res, next) => {
  try {
    requireFields(req.body, ["password"]); if (String(req.body.password).length < 12) return res.status(400).json({ message: "Password must be at least 12 characters" });
    const account = await PortalAccount.findOne({ invitationTokenHash: tokenHash(req.params.token), status: "Invited", invitationExpiresAt: { $gt: new Date() } }).select("+invitationTokenHash +password");
    if (!account) return res.status(404).json({ message: "Portal invitation is invalid or has expired" });
    account.password = req.body.password; account.status = "Active"; account.activatedAt = new Date(); account.invitationTokenHash = undefined; account.invitationExpiresAt = undefined; await account.save();
    res.json({ message: "Portal activated. You can now sign in securely." });
  } catch (error) { next(error); }
});

router.post("/login", limiter, async (req, res, next) => {
  try {
    requireFields(req.body, ["email", "password"]); validateEmail(req.body.email);
    const account = await PortalAccount.findOne({ email: String(req.body.email).toLowerCase(), status: "Active" }).select("+password");
    if (!account || !(await account.matchPassword(req.body.password))) return res.status(401).json({ message: "Invalid portal email or password" });
    const csrfToken = await issueSession(req, res, account); account.lastLoginAt = new Date(); await account.save();
    res.json({ account: publicAccount(account), csrfToken });
  } catch (error) { next(error); }
});

router.get("/me", protectPortal, (req, res) => res.json({ account: publicAccount(req.portalAccount), csrfToken: req.portalAuth.csrf }));
router.post("/logout", protectPortal, async (req, res, next) => { try { await PortalSession.updateOne({ account: req.portalAccount._id, jtiHash: tokenHash(req.portalAuth.jti) }, { revokedAt: new Date() }); res.clearCookie(cookieName(), { path: "/" }); res.json({ message: "Signed out" }); } catch (error) { next(error); } });

router.get("/dashboard", protectPortal, async (req, res, next) => {
  try {
    const account = req.portalAccount;
    if (account.type === "Candidate") {
      const candidate = await Candidate.findById(account.candidate).select("name email phone postcode city desiredRole experience availability shiftPreference status lawfulBasis updatedAt").lean();
      if (!candidate) return res.status(404).json({ message: "Candidate profile not found" });
      const [applications, interviews, passport, schedulingRequests, offers] = await Promise.all([Application.find({ email: candidate.email }).select("job status createdAt updatedAt").populate("job", "title location salary type").sort({ createdAt: -1 }).lean(), Interview.find({ candidateEmail: candidate.email }).select("jobTitle clientName interviewDate interviewTime interviewType interviewStatus candidateSelected feedback").sort({ interviewDate: 1 }).lean(), CompliancePassport.findOne({ candidate: candidate._id }).select("overallStatus checks.type checks.label checks.required checks.status checks.expiresAt checks.verifiedAt consentCapturedAt updatedAt").lean(), SchedulingRequest.find({ candidateEmail: candidate.email, status: "Sent", expiresAt: { $gt: new Date() } }).select("jobTitle clientName interviewType location instructions timezone slots expiresAt").sort({ expiresAt: 1 }).lean(), OfferLetter.find({ candidateEmail: candidate.email, status: { $in: ["Sent", "Accepted", "Declined", "Withdrawn"] } }).select("offerNumber roleTitle department employmentType startDate startDateText workLocation salaryType salaryAmount hoursPerWeek probationPeriod offerExpiryDate offerExpiryText conditions benefits status sentAt acceptance.status acceptance.signedAt acceptance.declinedAt documentHash").sort({ sentAt: -1 }).lean()]);
      return res.json({ type: "Candidate", candidate, applications, interviews, schedulingRequests, offers, compliance: passport || { overallStatus: "Red", checks: [] } });
    }
    const client = await ClientAccount.findById(account.clientAccount).select("name domain website status primaryContact contacts address").lean();
    if (!client) return res.status(404).json({ message: "Client profile not found" });
    const jobs = await Job.find({ clientAccount: client._id }).select("reference title location vacancyStatus publicationStatus openings closingDate createdAt").sort({ createdAt: -1 }).lean();
    const jobIds = jobs.map((job) => job._id);
    const [submissions, invoices, terms] = await Promise.all([RecruitmentSubmission.find({ job: { $in: jobIds }, stage: { $nin: ["Pending admin review", "Changes requested", "Admin rejected"] } }).select("reference job candidateName location currentRole experienceYears recruiterSummary stage interview timeline createdAt updatedAt").populate("job", "reference title location").sort({ updatedAt: -1 }).lean(), Invoice.find({ clientAccount: client._id }).select("invoiceNumber issueDate dueDate status currency total amountPaid balanceDue").sort({ issueDate: -1 }).lean(), ClientTerms.find({ clientAccount: client._id }).select("reference status effectiveDate expiryDate clientName createdAt updatedAt").sort({ createdAt: -1 }).lean()]);
    res.json({ type: "Client", client, jobs, submissions, invoices, terms });
  } catch (error) { next(error); }
});

router.patch("/candidate/profile", protectPortal, async (req, res, next) => {
  try {
    if (req.portalAccount.type !== "Candidate") return res.status(403).json({ message: "Candidate portal required" });
    const candidate = await Candidate.findById(req.portalAccount.candidate);
    if (!candidate) return res.status(404).json({ message: "Candidate profile not found" });
    ["phone", "postcode", "city", "desiredRole", "experience", "availability", "shiftPreference"].forEach((field) => { if (req.body[field] !== undefined) candidate[field] = String(req.body[field] || "").trim(); });
    await candidate.save(); res.json({ message: "Your candidate profile has been updated" });
  } catch (error) { next(error); }
});

router.post("/candidate/scheduling/:id/book", protectPortal, async (req, res, next) => {
  let lockedRequest = null;
  try {
    if (req.portalAccount.type !== "Candidate") return res.status(403).json({ message: "Candidate portal required" });
    requireFields(req.body, ["slotId"]);
    const candidate = await Candidate.findById(req.portalAccount.candidate).select("name email phone postcode visaStatus").lean();
    if (!candidate) return res.status(404).json({ message: "Candidate profile not found" });
    const request = await SchedulingRequest.findOne({ _id: req.params.id, candidateEmail: candidate.email, status: "Sent", expiresAt: { $gt: new Date() }, slots: { $elemMatch: { _id: req.body.slotId, status: "Available", startsAt: { $gt: new Date() } } } });
    const slot = request?.slots.id(req.body.slotId);
    if (!request || !slot) return res.status(409).json({ message: "This interview slot is no longer available" });
    lockedRequest = await SchedulingRequest.findOneAndUpdate({ _id: request._id, status: "Sent", slots: { $elemMatch: { _id: slot._id, status: "Available" } } }, { $set: { status: "Booked", selectedSlot: slot._id, bookedAt: new Date(), "slots.$[selected].status": "Booked" } }, { new: true, arrayFilters: [{ "selected._id": slot._id }] });
    if (!lockedRequest) return res.status(409).json({ message: "This interview slot was just selected elsewhere" });
    const startsAt = new Date(slot.startsAt);
    const interviewTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: request.timezone || "Europe/London" }).format(startsAt);
    const interview = await Interview.create({ schedulingRequest: request._id, candidateName: candidate.name, candidateEmail: candidate.email, candidatePhone: candidate.phone || request.candidatePhone, candidatePostcode: candidate.postcode || "", visaStatus: candidate.visaStatus || "", jobTitle: request.jobTitle, clientName: request.clientName, careHomeAddress: request.location || "", interviewInstructions: request.instructions, interviewDate: startsAt, interviewTime, interviewType: request.interviewType, interviewStatus: "Pending", reminderEmailEnabled: true });
    lockedRequest.interview = interview._id; await lockedRequest.save();
    const delivery = await sendInterviewConfirmationEmail(interview).catch((error) => ({ sent: false, reason: error.message }));
    interview.confirmationEmailStatus = delivery.sent ? "Sent" : "Failed"; interview.confirmationEmailSentAt = delivery.sent ? new Date() : undefined; interview.confirmationEmailError = delivery.sent ? "" : delivery.reason || "Email delivery failed"; interview.confirmationEmailCount = delivery.sent ? 1 : 0; await interview.save();
    res.status(201).json({ message: "Interview time confirmed", interview: { id: interview._id, jobTitle: interview.jobTitle, clientName: interview.clientName, interviewDate: interview.interviewDate, interviewTime: interview.interviewTime, interviewType: interview.interviewType } });
  } catch (error) {
    if (lockedRequest && !lockedRequest.interview) await SchedulingRequest.updateOne({ _id: lockedRequest._id }, { $set: { status: "Sent", selectedSlot: null, bookedAt: null, "slots.$[selected].status": "Available" } }, { arrayFilters: [{ "selected._id": lockedRequest.selectedSlot }] }).catch(() => null);
    next(error);
  }
});

router.get("/candidate/offers/:id/pdf", protectPortal, async (req, res, next) => {
  try {
    if (req.portalAccount.type !== "Candidate") return res.status(403).json({ message: "Candidate portal required" });
    const offer = await OfferLetter.findOne({ _id: req.params.id, candidateEmail: req.portalAccount.email, status: { $in: ["Sent", "Accepted", "Declined", "Withdrawn"] } });
    if (!offer) return res.status(404).json({ message: "Offer letter not found" });
    const pdf = await generateOfferLetterPdf(offer);
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="Offer-${offer.offerNumber}.pdf"`, "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff", "X-Document-SHA256": offer.documentHash || "unavailable" });
    res.send(pdf);
  } catch (error) { next(error); }
});

router.post("/candidate/offers/:id/decision", protectPortal, async (req, res, next) => {
  try {
    if (req.portalAccount.type !== "Candidate") return res.status(403).json({ message: "Candidate portal required" });
    const decision = req.body.decision === "Accepted" ? "Accepted" : "Declined";
    const signerName = String(req.body.signerName || "").trim();
    if (decision === "Accepted" && (!req.body.declarationAccepted || signerName.length < 2)) return res.status(400).json({ message: "Type your full name and accept the declaration" });
    const offer = await OfferLetter.findOne({ _id: req.params.id, candidateEmail: req.portalAccount.email, status: "Sent" });
    if (!offer) return res.status(409).json({ message: "This offer is no longer awaiting a decision" });
    if (offer.offerExpiryDate && offer.offerExpiryDate < new Date()) return res.status(409).json({ message: "This offer has expired. Contact your recruitment consultant." });
    let documentHash = offer.documentHash;
    if (!documentHash) documentHash = crypto.createHash("sha256").update(await generateOfferLetterPdf(offer)).digest("hex");
    const now = new Date();
    const acceptance = { status: decision, signerName: decision === "Accepted" ? signerName : req.portalAccount.name, signerEmail: req.portalAccount.email, declarationVersion: "offer-acceptance-v1", signedAt: decision === "Accepted" ? now : null, declinedAt: decision === "Declined" ? now : null, ipHash: crypto.createHmac("sha256", process.env.JWT_SECRET).update(req.ip || "unknown").digest("hex"), userAgent: String(req.get("user-agent") || "").slice(0, 500), documentHash };
    const updated = await OfferLetter.findOneAndUpdate({ _id: offer._id, status: "Sent" }, { $set: { status: decision, acceptedAt: decision === "Accepted" ? now : null, documentHash, acceptance } }, { new: true, runValidators: true });
    if (!updated) return res.status(409).json({ message: "This offer decision has already been recorded" });
    await ActivityLog.create({ actor: { name: req.portalAccount.name, email: req.portalAccount.email, role: "Candidate portal" }, module: "Offer Letters", action: decision, entityType: "OfferLetter", entityId: offer._id, summary: `${offer.offerNumber} ${decision.toLowerCase()} through the secure candidate portal`, metadata: { documentHash, declarationVersion: "offer-acceptance-v1" }, ipAddress: req.ip, userAgent: req.get("user-agent") || "" });
    res.json({ message: decision === "Accepted" ? "Offer accepted successfully. Your recruitment consultant has been notified." : "Your decision has been recorded." });
  } catch (error) { next(error); }
});

router.patch("/client/submissions/:id", protectPortal, async (req, res, next) => {
  try {
    if (req.portalAccount.type !== "Client") return res.status(403).json({ message: "Client portal required" });
    const jobs = await Job.find({ clientAccount: req.portalAccount.clientAccount }).distinct("_id");
    const submission = await RecruitmentSubmission.findOne({ _id: req.params.id, job: { $in: jobs }, stage: { $in: ["Client review", "Interview requested"] } });
    if (!submission) return res.status(404).json({ message: "Candidate submission is not available for review" });
    const decision = req.body.decision === "Interview requested" ? "Interview requested" : "Client rejected";
    const note = String(req.body.note || "").trim(); if (decision === "Client rejected" && !note) return res.status(400).json({ message: "Please add a brief decision reason" });
    const previous = submission.stage; submission.stage = decision; submission.outcomeReason = note || submission.outcomeReason; submission.timeline.push({ type: "Client decision", fromStage: previous, toStage: decision, note, actor: { name: req.portalAccount.name, email: req.portalAccount.email, role: "Client portal" } }); await submission.save();
    res.json({ message: decision === "Interview requested" ? "Interview request sent to the recruitment team" : "Decision recorded securely" });
  } catch (error) { next(error); }
});

export default router;
