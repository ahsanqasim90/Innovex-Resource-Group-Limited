import express from "express";
import EmailLog from "../models/EmailLog.js";
import HrCounter from "../models/HrCounter.js";
import OfferLetter from "../models/OfferLetter.js";
import SalarySlip from "../models/SalarySlip.js";
import { allowedSenderAccountsForUser, canUseSender } from "../config/emailAccounts.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { generateOfferLetterPdf, generateSalarySlipPdf } from "../services/hrPdfService.js";
import { logActivity } from "../services/activityLogService.js";
import { sendOfferLetterEmail, sendSalarySlipEmail } from "../services/emailService.js";
import { pick, requireFields, validateEmail } from "../utils.js";

const router = express.Router();

const salaryFields = [
  "employeeName",
  "employeeEmail",
  "employeePhone",
  "employeeId",
  "jobTitle",
  "department",
  "payPeriodStart",
  "payPeriodEnd",
  "paymentDate",
  "paymentMethod",
  "basicSalary",
  "overtime",
  "bonus",
  "commission",
  "otherAllowance",
  "tax",
  "nationalInsurance",
  "pension",
  "otherDeduction",
  "notes",
  "senderEmail",
  "cc",
  "customMessage",
  "status"
];

const offerFields = [
  "candidateName",
  "candidateEmail",
  "candidatePhone",
  "roleTitle",
  "department",
  "employmentType",
  "startDate",
  "workLocation",
  "salaryType",
  "salaryAmount",
  "hoursPerWeek",
  "reportingTo",
  "probationPeriod",
  "offerExpiryDate",
  "conditions",
  "benefits",
  "notes",
  "senderEmail",
  "cc",
  "customMessage",
  "status"
];

function actor(req) {
  return {
    user: req.user?._id,
    name: req.user?.name || "",
    email: req.user?.email || "",
    role: req.user?.role || ""
  };
}

function normalizeCc(value) {
  const items = Array.isArray(value) ? value : String(value || "").split(",");
  return items.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean);
}

function validateCc(items) {
  items.forEach(validateEmail);
}

async function nextDocumentNumber(key, prefix) {
  const counter = await HrCounter.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return `${prefix}-${String(counter.seq).padStart(6, "0")}`;
}

function senderOrReject(req, fromEmail) {
  const requestedSender = String(fromEmail || "").trim().toLowerCase();
  if (!requestedSender) {
    return allowedSenderAccountsForUser(req.user)[0]?.address || "";
  }
  if (!canUseSender(req.user, requestedSender)) {
    const error = new Error("You do not have permission to send from this mailbox");
    error.statusCode = 403;
    throw error;
  }
  return requestedSender;
}

function pdfResponse(res, filename, buffer) {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
}

router.use(protect);

router.get("/senders", (req, res) => {
  res.json(allowedSenderAccountsForUser(req.user));
});

router.get("/salary-slips", requirePermission("salarySlips.view"), async (req, res, next) => {
  try {
    const { search = "", status = "" } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { employeeName: new RegExp(search, "i") },
        { employeeEmail: new RegExp(search, "i") },
        { jobTitle: new RegExp(search, "i") },
        { slipNumber: new RegExp(search, "i") }
      ];
    }
    const slips = await SalarySlip.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json(slips);
  } catch (error) {
    next(error);
  }
});

router.post("/salary-slips", requirePermission("salarySlips.view"), async (req, res, next) => {
  try {
    requireFields(req.body, ["employeeName", "employeeEmail", "payPeriodStart", "payPeriodEnd", "paymentDate"]);
    validateEmail(req.body.employeeEmail);
    const cc = normalizeCc(req.body.cc);
    validateCc(cc);
    const senderEmail = senderOrReject(req, req.body.senderEmail);
    const slip = await SalarySlip.create({
      ...pick(req.body, salaryFields),
      slipNumber: await nextDocumentNumber("salarySlip", "PAY"),
      employeeEmail: String(req.body.employeeEmail).trim().toLowerCase(),
      senderEmail,
      cc,
      status: "Draft",
      createdBy: actor(req),
      updatedBy: actor(req)
    });
    await logActivity(req, { module: "HR Documents", action: "Created", entityType: "SalarySlip", entityId: slip._id, summary: `Created salary slip ${slip.slipNumber} for ${slip.employeeName}` });
    res.status(201).json(slip);
  } catch (error) {
    next(error);
  }
});

router.put("/salary-slips/:id", requirePermission("salarySlips.view"), async (req, res, next) => {
  try {
    if (req.body.employeeEmail) validateEmail(req.body.employeeEmail);
    const updates = pick(req.body, salaryFields);
    if (updates.cc !== undefined) {
      updates.cc = normalizeCc(updates.cc);
      validateCc(updates.cc);
    }
    if (updates.senderEmail !== undefined) updates.senderEmail = senderOrReject(req, updates.senderEmail);
    updates.updatedBy = actor(req);
    const slip = await SalarySlip.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!slip) return res.status(404).json({ message: "Salary slip not found" });
    await logActivity(req, { module: "HR Documents", action: "Updated", entityType: "SalarySlip", entityId: slip._id, summary: `Updated salary slip ${slip.slipNumber}` });
    res.json(slip);
  } catch (error) {
    next(error);
  }
});

router.get("/salary-slips/:id/pdf", requirePermission("salarySlips.view"), async (req, res, next) => {
  try {
    const slip = await SalarySlip.findById(req.params.id);
    if (!slip) return res.status(404).json({ message: "Salary slip not found" });
    const pdf = await generateSalarySlipPdf(slip);
    pdfResponse(res, `Innovex-Salary-Slip-${slip.slipNumber}.pdf`, pdf);
  } catch (error) {
    next(error);
  }
});

router.post("/salary-slips/:id/send", requirePermission("salarySlips.view"), async (req, res, next) => {
  try {
    const slip = await SalarySlip.findById(req.params.id);
    if (!slip) return res.status(404).json({ message: "Salary slip not found" });
    const cc = req.body.cc !== undefined ? normalizeCc(req.body.cc) : slip.cc;
    validateCc(cc);
    const fromEmail = senderOrReject(req, req.body.fromEmail || slip.senderEmail);
    const pdf = await generateSalarySlipPdf(slip);
    const result = await sendSalarySlipEmail({ salarySlip: slip, pdfBuffer: pdf, fromEmail, customMessage: req.body.customMessage || slip.customMessage, cc });
    if (!result.sent) return res.status(400).json({ message: result.reason || "Salary slip email could not be sent" });
    slip.status = "Sent";
    slip.senderEmail = result.fromEmail;
    slip.cc = cc;
    slip.sentAt = new Date();
    slip.sentFolderSaved = Boolean(result.sentFolderSaved);
    slip.sentFolderError = result.sentFolderError || "";
    slip.updatedBy = actor(req);
    await slip.save();
    await EmailLog.create({ fromEmail: result.fromEmail, fromName: "Innovex Resource Group Limited", to: [slip.employeeEmail], cc, subject: result.subject, message: result.message, targetType: "SalarySlip", targetId: slip._id, status: "Sent", sentBy: actor(req) });
    await logActivity(req, { module: "HR Documents", action: "Sent", entityType: "SalarySlip", entityId: slip._id, summary: `Sent salary slip ${slip.slipNumber} to ${slip.employeeEmail}`, metadata: { fromEmail: result.fromEmail } });
    res.json({ slip, result });
  } catch (error) {
    next(error);
  }
});

router.delete("/salary-slips/:id", requirePermission("salarySlips.view"), async (req, res, next) => {
  try {
    const slip = await SalarySlip.findByIdAndDelete(req.params.id);
    if (!slip) return res.status(404).json({ message: "Salary slip not found" });
    await logActivity(req, { module: "HR Documents", action: "Deleted", entityType: "SalarySlip", entityId: slip._id, summary: `Deleted salary slip ${slip.slipNumber}` });
    res.json({ message: "Salary slip deleted" });
  } catch (error) {
    next(error);
  }
});

router.get("/offer-letters", requirePermission("offerLetters.view"), async (req, res, next) => {
  try {
    const { search = "", status = "" } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) {
      filter.$or = [
        { candidateName: new RegExp(search, "i") },
        { candidateEmail: new RegExp(search, "i") },
        { roleTitle: new RegExp(search, "i") },
        { offerNumber: new RegExp(search, "i") }
      ];
    }
    const offers = await OfferLetter.find(filter).sort({ createdAt: -1 }).limit(200);
    res.json(offers);
  } catch (error) {
    next(error);
  }
});

router.post("/offer-letters", requirePermission("offerLetters.view"), async (req, res, next) => {
  try {
    requireFields(req.body, ["candidateName", "candidateEmail", "roleTitle"]);
    validateEmail(req.body.candidateEmail);
    const cc = normalizeCc(req.body.cc);
    validateCc(cc);
    const senderEmail = senderOrReject(req, req.body.senderEmail);
    const offer = await OfferLetter.create({
      ...pick(req.body, offerFields),
      offerNumber: await nextDocumentNumber("offerLetter", "OFFER"),
      candidateEmail: String(req.body.candidateEmail).trim().toLowerCase(),
      senderEmail,
      cc,
      status: "Draft",
      createdBy: actor(req),
      updatedBy: actor(req)
    });
    await logActivity(req, { module: "HR Documents", action: "Created", entityType: "OfferLetter", entityId: offer._id, summary: `Created offer letter ${offer.offerNumber} for ${offer.candidateName}` });
    res.status(201).json(offer);
  } catch (error) {
    next(error);
  }
});

router.put("/offer-letters/:id", requirePermission("offerLetters.view"), async (req, res, next) => {
  try {
    if (req.body.candidateEmail) validateEmail(req.body.candidateEmail);
    const updates = pick(req.body, offerFields);
    if (updates.cc !== undefined) {
      updates.cc = normalizeCc(updates.cc);
      validateCc(updates.cc);
    }
    if (updates.senderEmail !== undefined) updates.senderEmail = senderOrReject(req, updates.senderEmail);
    updates.updatedBy = actor(req);
    const offer = await OfferLetter.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!offer) return res.status(404).json({ message: "Offer letter not found" });
    await logActivity(req, { module: "HR Documents", action: "Updated", entityType: "OfferLetter", entityId: offer._id, summary: `Updated offer letter ${offer.offerNumber}` });
    res.json(offer);
  } catch (error) {
    next(error);
  }
});

router.get("/offer-letters/:id/pdf", requirePermission("offerLetters.view"), async (req, res, next) => {
  try {
    const offer = await OfferLetter.findById(req.params.id);
    if (!offer) return res.status(404).json({ message: "Offer letter not found" });
    const pdf = await generateOfferLetterPdf(offer);
    pdfResponse(res, `Innovex-Offer-Letter-${offer.offerNumber}.pdf`, pdf);
  } catch (error) {
    next(error);
  }
});

router.post("/offer-letters/:id/send", requirePermission("offerLetters.view"), async (req, res, next) => {
  try {
    const offer = await OfferLetter.findById(req.params.id);
    if (!offer) return res.status(404).json({ message: "Offer letter not found" });
    const cc = req.body.cc !== undefined ? normalizeCc(req.body.cc) : offer.cc;
    validateCc(cc);
    const fromEmail = senderOrReject(req, req.body.fromEmail || offer.senderEmail);
    const pdf = await generateOfferLetterPdf(offer);
    const result = await sendOfferLetterEmail({ offerLetter: offer, pdfBuffer: pdf, fromEmail, customMessage: req.body.customMessage || offer.customMessage, cc });
    if (!result.sent) return res.status(400).json({ message: result.reason || "Offer letter email could not be sent" });
    offer.status = "Sent";
    offer.senderEmail = result.fromEmail;
    offer.cc = cc;
    offer.sentAt = new Date();
    offer.sentFolderSaved = Boolean(result.sentFolderSaved);
    offer.sentFolderError = result.sentFolderError || "";
    offer.updatedBy = actor(req);
    await offer.save();
    await EmailLog.create({ fromEmail: result.fromEmail, fromName: "Innovex Resource Group Limited", to: [offer.candidateEmail], cc, subject: result.subject, message: result.message, targetType: "OfferLetter", targetId: offer._id, status: "Sent", sentBy: actor(req) });
    await logActivity(req, { module: "HR Documents", action: "Sent", entityType: "OfferLetter", entityId: offer._id, summary: `Sent offer letter ${offer.offerNumber} to ${offer.candidateEmail}`, metadata: { fromEmail: result.fromEmail } });
    res.json({ offer, result });
  } catch (error) {
    next(error);
  }
});

router.delete("/offer-letters/:id", requirePermission("offerLetters.view"), async (req, res, next) => {
  try {
    const offer = await OfferLetter.findByIdAndDelete(req.params.id);
    if (!offer) return res.status(404).json({ message: "Offer letter not found" });
    await logActivity(req, { module: "HR Documents", action: "Deleted", entityType: "OfferLetter", entityId: offer._id, summary: `Deleted offer letter ${offer.offerNumber}` });
    res.json({ message: "Offer letter deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
