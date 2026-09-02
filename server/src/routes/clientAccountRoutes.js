import express from "express";
import mongoose from "mongoose";
import ActivityLog from "../models/ActivityLog.js";
import BusinessLead from "../models/BusinessLead.js";
import CallLog from "../models/CallLog.js";
import ClientAccount, { domainFromWebsite, normaliseName } from "../models/ClientAccount.js";
import ClientTerms from "../models/ClientTerms.js";
import ContactMessage from "../models/ContactMessage.js";
import EmailLog from "../models/EmailLog.js";
import Invoice from "../models/Invoice.js";
import Job from "../models/Job.js";
import Meeting from "../models/Meeting.js";
import TrainingBooking from "../models/TrainingBooking.js";
import WebLeadProspect from "../models/WebLeadProspect.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { logActivity } from "../services/activityLogService.js";
import { runAutomations } from "../services/automationService.js";
import { pick, requireFields, validateEmail } from "../utils.js";

const router = express.Router();
const linkedModels = {
  businessLead: BusinessLead,
  call: CallLog,
  contactMessage: ContactMessage,
  email: EmailLog,
  invoice: Invoice,
  job: Job,
  meeting: Meeting,
  terms: ClientTerms,
  trainingBooking: TrainingBooking,
  webLead: WebLeadProspect
};
const editableFields = ["name", "tradingName", "accountType", "status", "industry", "companyNumber", "vatNumber", "website", "email", "phone", "address", "contacts", "owner", "tags", "source", "notes"];

router.use(protect, requirePermission("clients.view"));

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function timelineItem(type, title, detail, at, id, metadata = {}) {
  return { type, title, detail, at, id, metadata };
}

async function duplicateCandidates(data, excludeId = null) {
  const clauses = [];
  const normalizedName = normaliseName(data.name);
  const websiteDomain = domainFromWebsite(data.website);
  if (normalizedName) clauses.push({ normalizedName });
  if (websiteDomain) clauses.push({ websiteDomain });
  if (data.companyNumber) clauses.push({ companyNumber: String(data.companyNumber).trim().toUpperCase() });
  const emails = [data.email, ...(data.contacts || []).map((contact) => contact.email)].filter(Boolean).map((email) => String(email).toLowerCase());
  if (emails.length) clauses.push({ $or: [{ email: { $in: emails } }, { "contacts.email": { $in: emails } }] });
  if (!clauses.length) return [];
  const filter = { $or: clauses };
  if (excludeId) filter._id = { $ne: excludeId };
  return ClientAccount.find(filter).select("name website email companyNumber status").limit(8).lean();
}

router.get("/summary", async (req, res, next) => {
  try {
    const [total, active, prospects, atRisk, duplicateCount] = await Promise.all([
      ClientAccount.countDocuments(),
      ClientAccount.countDocuments({ status: "Active" }),
      ClientAccount.countDocuments({ accountType: "Prospect", status: { $nin: ["Closed", "Dormant"] } }),
      ClientAccount.countDocuments({ status: "At Risk" }),
      ClientAccount.countDocuments({ "potentialDuplicateOf.0": { $exists: true } })
    ]);
    res.json({ total, active, prospects, atRisk, duplicateCount });
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(50, Math.max(10, Number(req.query.limit || 20)));
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.accountType) filter.accountType = req.query.accountType;
    if (req.query.owner && mongoose.isValidObjectId(req.query.owner)) filter.owner = req.query.owner;
    if (req.query.search) {
      const search = new RegExp(escapeRegex(req.query.search), "i");
      filter.$or = [{ name: search }, { tradingName: search }, { email: search }, { phone: search }, { companyNumber: search }, { websiteDomain: search }, { "contacts.name": search }, { "contacts.email": search }];
    }
    const [items, total] = await Promise.all([
      ClientAccount.find(filter).populate("owner", "name email").sort({ lastActivityAt: -1, updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ClientAccount.countDocuments(filter)
    ]);
    res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)), limit });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const account = await ClientAccount.findById(req.params.id).populate("owner", "name email").populate("potentialDuplicateOf", "name status website email");
    if (!account) return res.status(404).json({ message: "Organisation record not found" });
    const filter = { clientAccount: account._id };
    const [businessLeads, webLeads, jobs, meetings, terms, invoices, trainingBookings, calls, emails, enquiries, audit] = await Promise.all([
      BusinessLead.find(filter).select("companyName status category updatedAt").sort({ updatedAt: -1 }).limit(20).lean(),
      WebLeadProspect.find(filter).select("businessName status interestedServices updatedAt").sort({ updatedAt: -1 }).limit(20).lean(),
      Job.find(filter).select("title status clientName updatedAt createdAt").sort({ updatedAt: -1 }).limit(20).lean(),
      Meeting.find(filter).select("meetingTitle meetingStatus meetingDate meetingTime updatedAt").sort({ meetingDate: -1 }).limit(20).lean(),
      ClientTerms.find(filter).select("documentNumber title status updatedAt sentAt signedAt").sort({ updatedAt: -1 }).limit(20).lean(),
      Invoice.find(filter).select("invoiceNumber status total balanceDue currency issueDate updatedAt").sort({ issueDate: -1 }).limit(30).lean(),
      TrainingBooking.find(filter).select("bookingStatus trainingDate quotedPrice paymentStatus updatedAt").sort({ updatedAt: -1 }).limit(20).lean(),
      CallLog.find(filter).select("direction status startedAt durationSeconds createdAt").sort({ createdAt: -1 }).limit(30).lean(),
      EmailLog.find(filter).select("subject status sentAt createdAt to").sort({ createdAt: -1 }).limit(30).lean(),
      ContactMessage.find(filter).select("subject status priority createdAt updatedAt").sort({ updatedAt: -1 }).limit(20).lean(),
      ActivityLog.find({ entityId: account._id }).select("module action summary createdAt actor").sort({ createdAt: -1 }).limit(30).lean()
    ]);
    const timeline = [
      ...businessLeads.map((item) => timelineItem("lead", "Business lead", `${item.category} · ${item.status}`, item.updatedAt, item._id)),
      ...webLeads.map((item) => timelineItem("lead", "Web lead", `${item.businessName} · ${item.status}`, item.updatedAt, item._id)),
      ...jobs.map((item) => timelineItem("vacancy", item.title, item.status || "Vacancy", item.updatedAt || item.createdAt, item._id)),
      ...meetings.map((item) => timelineItem("meeting", item.meetingTitle, item.meetingStatus, item.meetingDate || item.updatedAt, item._id)),
      ...terms.map((item) => timelineItem("terms", item.title, `${item.documentNumber} · ${item.status}`, item.signedAt || item.sentAt || item.updatedAt, item._id)),
      ...invoices.map((item) => timelineItem("invoice", `Invoice ${item.invoiceNumber}`, `${item.status} · ${item.currency || "GBP"} ${Number(item.total || 0).toFixed(2)}`, item.issueDate || item.updatedAt, item._id, { total: item.total, balanceDue: item.balanceDue })),
      ...trainingBookings.map((item) => timelineItem("training", "Training booking", `${item.bookingStatus} · ${item.paymentStatus}`, item.trainingDate || item.updatedAt, item._id)),
      ...calls.map((item) => timelineItem("call", `${item.direction || "CRM"} call`, item.status || "Logged", item.startedAt || item.createdAt, item._id)),
      ...emails.map((item) => timelineItem("email", item.subject || "Email", item.status || "Logged", item.sentAt || item.createdAt, item._id)),
      ...enquiries.map((item) => timelineItem("enquiry", item.subject, `${item.status} · ${item.priority}`, item.updatedAt || item.createdAt, item._id)),
      ...audit.map((item) => timelineItem("audit", item.action, item.summary, item.createdAt, item._id))
    ].filter((item) => item.at).sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 100);
    const revenue = invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0);
    const outstanding = invoices.reduce((sum, invoice) => sum + Number(invoice.balanceDue || 0), 0);
    res.json({ account, metrics: { leads: businessLeads.length + webLeads.length, vacancies: jobs.length, meetings: meetings.length, invoices: invoices.length, revenue, outstanding, trainingBookings: trainingBookings.length }, timeline });
  } catch (error) {
    next(error);
  }
});

router.post("/", requirePermission("clients.manage"), async (req, res, next) => {
  try {
    requireFields(req.body, ["name"]);
    if (req.body.email) validateEmail(req.body.email);
    const payload = pick(req.body, editableFields);
    const duplicates = await duplicateCandidates(payload);
    const account = await ClientAccount.create({ ...payload, potentialDuplicateOf: duplicates.map((item) => item._id), createdBy: req.user._id, updatedBy: req.user._id });
    await runAutomations({ entityType: "ClientAccount", event: "created", record: account.toObject(), actor: req.user }).catch(() => null);
    await logActivity(req, { module: "Organisation 360", action: "Organisation created", entityType: "ClientAccount", entityId: account._id, summary: `Created ${account.name}` });
    res.status(201).json({ account, duplicates });
  } catch (error) {
    next(error);
  }
});

router.put("/:id", requirePermission("clients.manage"), async (req, res, next) => {
  try {
    const account = await ClientAccount.findById(req.params.id);
    if (!account) return res.status(404).json({ message: "Organisation record not found" });
    const previousStatus = account.status;
    const payload = pick(req.body, editableFields);
    if (payload.email) validateEmail(payload.email);
    const duplicates = await duplicateCandidates({ ...account.toObject(), ...payload }, account._id);
    account.set({ ...payload, potentialDuplicateOf: duplicates.map((item) => item._id), updatedBy: req.user._id, lastActivityAt: new Date() });
    await account.save();
    if (previousStatus !== account.status) await runAutomations({ entityType: "ClientAccount", event: "status_changed", record: account.toObject(), actor: req.user, changes: { status: { from: previousStatus, to: account.status } } }).catch(() => null);
    await logActivity(req, { module: "Organisation 360", action: "Organisation updated", entityType: "ClientAccount", entityId: account._id, summary: `Updated ${account.name}` });
    res.json({ account, duplicates });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/link", requirePermission("clients.manage"), async (req, res, next) => {
  try {
    const Model = linkedModels[req.body.entityType];
    if (!Model || !mongoose.isValidObjectId(req.body.entityId)) return res.status(400).json({ message: "A valid CRM record is required" });
    const account = await ClientAccount.findById(req.params.id);
    if (!account) return res.status(404).json({ message: "Organisation record not found" });
    const record = await Model.findByIdAndUpdate(req.body.entityId, { clientAccount: account._id }, { new: true });
    if (!record) return res.status(404).json({ message: "CRM record not found" });
    account.lastActivityAt = new Date();
    await account.save();
    await logActivity(req, { module: "Organisation 360", action: "Record linked", entityType: "ClientAccount", entityId: account._id, summary: `Linked ${req.body.entityType} record to ${account.name}` });
    res.json({ message: "Record linked", recordId: record._id });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/merge", requirePermission("clients.manage"), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.body.sourceId) || String(req.body.sourceId) === String(req.params.id)) return res.status(400).json({ message: "Select a different duplicate record to merge" });
    const [target, source] = await Promise.all([ClientAccount.findById(req.params.id), ClientAccount.findById(req.body.sourceId)]);
    if (!target || !source) return res.status(404).json({ message: "One of the organisation records was not found" });
    for (const Model of Object.values(linkedModels)) await Model.updateMany({ clientAccount: source._id }, { clientAccount: target._id });
    const contactKeys = new Set((target.contacts || []).map((contact) => `${contact.email}|${contact.phone}|${contact.name}`.toLowerCase()));
    for (const contact of source.contacts || []) {
      const key = `${contact.email}|${contact.phone}|${contact.name}`.toLowerCase();
      if (!contactKeys.has(key)) target.contacts.push(contact);
    }
    target.tags = Array.from(new Set([...(target.tags || []), ...(source.tags || [])]));
    target.notes = [target.notes, source.notes && `Merged from ${source.name}: ${source.notes}`].filter(Boolean).join("\n\n");
    target.updatedBy = req.user._id;
    target.lastActivityAt = new Date();
    await target.save();
    source.mergedInto = target._id;
    await source.archive(req.user._id, `Merged into ${target.name}`);
    await logActivity(req, { module: "Organisation 360", action: "Duplicate merged", entityType: "ClientAccount", entityId: target._id, summary: `Merged ${source.name} into ${target.name}`, metadata: { sourceId: source._id } });
    res.json({ message: "Organisation records merged", account: target });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requirePermission("clients.manage"), async (req, res, next) => {
  try {
    const account = await ClientAccount.findById(req.params.id);
    if (!account) return res.status(404).json({ message: "Organisation record not found" });
    await account.archive(req.user._id, String(req.body?.reason || "Archived from Organisation 360"));
    await logActivity(req, { module: "Organisation 360", action: "Organisation archived", entityType: "ClientAccount", entityId: account._id, summary: `Archived ${account.name}` });
    res.json({ message: "Organisation archived" });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/restore", requirePermission("clients.manage"), async (req, res, next) => {
  try {
    const account = await ClientAccount.findOne({ _id: req.params.id }).setOptions({ withArchived: true });
    if (!account) return res.status(404).json({ message: "Archived organisation record not found" });
    await account.restore();
    await logActivity(req, { module: "Organisation 360", action: "Organisation restored", entityType: "ClientAccount", entityId: account._id, summary: `Restored ${account.name}` });
    res.json({ message: "Organisation restored", account });
  } catch (error) {
    next(error);
  }
});

export default router;
