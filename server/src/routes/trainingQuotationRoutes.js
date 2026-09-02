import express from "express";
import Course from "../models/Course.js";
import EmailLog from "../models/EmailLog.js";
import FinanceCounter from "../models/FinanceCounter.js";
import TrainingQuotation from "../models/TrainingQuotation.js";
import { allowedSenderAccountsForUser, canUseSender } from "../config/emailAccounts.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { logActivity } from "../services/activityLogService.js";
import { sendTrainingQuotationEmail } from "../services/emailService.js";
import { generateTrainingQuotationPdf } from "../services/trainingQuotationPdfService.js";
import { pick, requireFields, validateEmail } from "../utils.js";

const router = express.Router();
const fields = [
  "status", "issueDate", "validDays", "clientName", "contactName", "contactJobTitle", "clientEmail", "clientPhone",
  "clientAddress", "trainingLocations", "deliverySummary", "programmeTitle", "programmeDescription", "lineItems", "inclusions",
  "paymentTerms", "timescaleTerms", "additionalTerms", "openingMessage", "closingMessage", "signatoryName", "signatoryTitle",
  "senderEmail", "cc", "customMessage"
];

function actor(user) {
  return { user: user._id, name: user.name, email: user.email, role: user.role };
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeEmails(value) {
  const values = Array.isArray(value) ? value : String(value || "").split(/[;,]/);
  return Array.from(new Set(values.map((email) => String(email || "").trim().toLowerCase()).filter(Boolean)));
}

function validateCc(cc) {
  cc.forEach(validateEmail);
}

function senderOrReject(req, value) {
  const requested = String(value || allowedSenderAccountsForUser(req.user)[0]?.address || "").trim().toLowerCase();
  if (!requested) {
    const error = new Error("No sender mailbox is configured or assigned to this account");
    error.statusCode = 400;
    throw error;
  }
  if (!canUseSender(req.user, requested)) {
    const error = new Error("This sender mailbox is not assigned to your account");
    error.statusCode = 403;
    throw error;
  }
  return requested;
}

async function nextQuotationNumber() {
  const counter = await FinanceCounter.findByIdAndUpdate("trainingQuotation", { $inc: { seq: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
  const year = new Date().getFullYear();
  return `IRG-TR-${year}-${String(counter.seq).padStart(4, "0")}`;
}

async function normalizeLineItems(items = []) {
  if (!Array.isArray(items) || !items.length) {
    const error = new Error("Add at least one course or training line");
    error.statusCode = 400;
    throw error;
  }
  const courseIds = items.map((item) => item.course).filter(Boolean);
  const courses = courseIds.length ? await Course.find({ _id: { $in: courseIds } }).select("title description") : [];
  const courseMap = new Map(courses.map((course) => [String(course._id), course]));
  return items.map((item) => {
    const course = courseMap.get(String(item.course || ""));
    const title = String(item.title || course?.title || "").trim();
    const unitPrice = Number(item.unitPrice);
    if (!title) {
      const error = new Error("Every quotation line needs a course title");
      error.statusCode = 400;
      throw error;
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      const error = new Error(`Enter a valid manual price for ${title}`);
      error.statusCode = 400;
      throw error;
    }
    return {
      course: course?._id,
      title,
      description: String(item.description || course?.description || "").trim(),
      delegates: Math.max(1, Number(item.delegates || 1)),
      sessions: Math.max(1, Number(item.sessions || 1)),
      unitPrice,
      discountPercent: Math.min(100, Math.max(0, Number(item.discountPercent || 0)))
    };
  });
}

async function payload(req) {
  const data = pick(req.body, fields);
  if (data.clientEmail) {
    validateEmail(data.clientEmail);
    data.clientEmail = String(data.clientEmail).trim().toLowerCase();
  }
  if (data.lineItems !== undefined) data.lineItems = await normalizeLineItems(data.lineItems);
  if (data.inclusions !== undefined) data.inclusions = (Array.isArray(data.inclusions) ? data.inclusions : []).map((item) => String(item || "").trim()).filter(Boolean);
  if (data.validDays !== undefined) data.validDays = Math.min(365, Math.max(1, Number(data.validDays || 14)));
  if (data.cc !== undefined) {
    data.cc = normalizeEmails(data.cc);
    validateCc(data.cc);
  }
  if (data.senderEmail !== undefined) data.senderEmail = senderOrReject(req, data.senderEmail);
  if (data.issueDate === "") delete data.issueDate;
  data.updatedBy = actor(req.user);
  return data;
}

router.use(protect, requirePermission("trainingQuotations.view"));

router.get("/options", async (req, res, next) => {
  try {
    const courses = await Course.find({ status: "Active" }).select("title category description duration").sort({ category: 1, title: 1 }).lean();
    res.json({ courses, senders: allowedSenderAccountsForUser(req.user) });
  } catch (error) { next(error); }
});

router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.search) {
      const regex = new RegExp(escapeRegex(req.query.search), "i");
      filter.$or = [{ quotationNumber: regex }, { clientName: regex }, { contactName: regex }, { clientEmail: regex }, { "lineItems.title": regex }];
    }
    const quotations = await TrainingQuotation.find(filter).sort({ issueDate: -1, createdAt: -1 }).limit(300).lean();
    res.json(quotations);
  } catch (error) { next(error); }
});

router.post("/", async (req, res, next) => {
  try {
    requireFields(req.body, ["clientName", "contactName", "clientEmail", "trainingLocations", "deliverySummary", "programmeDescription", "paymentTerms", "timescaleTerms", "openingMessage", "closingMessage", "signatoryName", "signatoryTitle"]);
    const quotation = await TrainingQuotation.create({ ...(await payload(req)), quotationNumber: await nextQuotationNumber(), status: "Draft", createdBy: actor(req.user) });
    await logActivity(req, { module: "Course Quotations", action: "Created", entityType: "TrainingQuotation", entityId: quotation._id, summary: `Created ${quotation.quotationNumber} for ${quotation.clientName}`, metadata: { total: quotation.total } });
    res.status(201).json(quotation);
  } catch (error) { next(error); }
});

router.put("/:id", async (req, res, next) => {
  try {
    const quotation = await TrainingQuotation.findById(req.params.id);
    if (!quotation) return res.status(404).json({ message: "Training quotation not found" });
    quotation.set(await payload(req));
    await quotation.save();
    await logActivity(req, { module: "Course Quotations", action: "Updated", entityType: "TrainingQuotation", entityId: quotation._id, summary: `Updated ${quotation.quotationNumber}`, metadata: { total: quotation.total, status: quotation.status } });
    res.json(quotation);
  } catch (error) { next(error); }
});

router.get("/:id/pdf", async (req, res, next) => {
  try {
    const quotation = await TrainingQuotation.findById(req.params.id);
    if (!quotation) return res.status(404).json({ message: "Training quotation not found" });
    const pdf = await generateTrainingQuotationPdf(quotation);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Innovex-Training-Quotation-${quotation.quotationNumber}.pdf"`);
    res.send(pdf);
  } catch (error) { next(error); }
});

router.post("/:id/send", async (req, res, next) => {
  try {
    const quotation = await TrainingQuotation.findById(req.params.id);
    if (!quotation) return res.status(404).json({ message: "Training quotation not found" });
    const fromEmail = senderOrReject(req, req.body.fromEmail || quotation.senderEmail);
    const cc = req.body.cc !== undefined ? normalizeEmails(req.body.cc) : quotation.cc || [];
    validateCc(cc);
    const delivery = await sendTrainingQuotationEmail({ quotation, pdfBuffer: await generateTrainingQuotationPdf(quotation), fromEmail, customMessage: req.body.customMessage || quotation.customMessage, cc });
    if (!delivery.sent) return res.status(503).json({ message: delivery.reason || "Quotation email could not be sent" });
    quotation.status = "Sent";
    quotation.senderEmail = delivery.fromEmail;
    quotation.cc = cc;
    quotation.customMessage = req.body.customMessage || quotation.customMessage || "";
    quotation.sentAt = new Date();
    quotation.sentFolderSaved = Boolean(delivery.sentFolderSaved);
    quotation.sentFolderError = delivery.sentFolderError || "";
    quotation.updatedBy = actor(req.user);
    await quotation.save();
    await EmailLog.create({ fromEmail: delivery.fromEmail, fromName: req.user.name, to: [quotation.clientEmail], cc, subject: delivery.subject, message: delivery.message, targetType: "TrainingQuotation", targetId: quotation._id, status: "Sent", error: delivery.sentFolderError || "", sentBy: actor(req.user) });
    await logActivity(req, { module: "Course Quotations", action: "Sent", entityType: "TrainingQuotation", entityId: quotation._id, summary: `Sent ${quotation.quotationNumber} to ${quotation.clientEmail}`, metadata: { total: quotation.total, fromEmail } });
    res.json({ message: `Quotation sent with PDF attachment.${delivery.sentFolderSaved ? " A copy was saved in Sent." : ""}`, quotation });
  } catch (error) { next(error); }
});

router.delete("/:id", requirePermission("trainingQuotations.manage"), async (req, res, next) => {
  try {
    const quotation = await TrainingQuotation.findById(req.params.id);
    if (!quotation) return res.status(404).json({ message: "Training quotation not found" });
    await quotation.archive(req.user._id, "Training quotation archived");
    await logActivity(req, { module: "Course Quotations", action: "Archived", entityType: "TrainingQuotation", entityId: quotation._id, summary: `Archived ${quotation.quotationNumber}` });
    res.json({ message: "Training quotation archived" });
  } catch (error) { next(error); }
});

export default router;
