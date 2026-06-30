import express from "express";
import rateLimit from "express-rate-limit";
import WebLeadCategory from "../models/WebLeadCategory.js";
import WebLeadNotification from "../models/WebLeadNotification.js";
import WebLeadProspect from "../models/WebLeadProspect.js";
import WebLeadTemplate from "../models/WebLeadTemplate.js";
import EmailLog from "../models/EmailLog.js";
import User from "../models/User.js";
import { allowedSenderAccountsForUser, canUseSender } from "../config/emailAccounts.js";
import { hasPermission } from "../config/permissions.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { logActivity } from "../services/activityLogService.js";
import { sendComposedEmail } from "../services/emailService.js";
import { pick, requireFields, validateEmail } from "../utils.js";

const router = express.Router();
router.use(protect, requirePermission("webLeads.view"));

export const WEB_LEAD_STATUSES = [
  "New Prospect", "Email Requested", "Follow-Up Required", "Interested", "Qualified",
  "Meeting Requested", "Meeting Booked", "Information Sent", "Existing Supplier",
  "Not Interested", "Do Not Contact", "Duplicate", "Under Review", "Accepted by Innovex",
  "Rejected by Innovex", "Proposal Required", "Proposal Sent", "Won", "Lost"
];

const AGENT_STATUSES = ["New Prospect", "Email Requested", "Follow-Up Required", "Interested", "Meeting Requested", "Existing Supplier", "Not Interested", "Do Not Contact", "Duplicate"];
const MANAGER_STATUSES = new Set(WEB_LEAD_STATUSES.slice(13));
const SERVICES = [
  "New Website", "Website Redesign", "Website Maintenance", "Search Engine Optimisation",
  "Local SEO", "Google Business Profile", "Social Media Management", "Website Hosting",
  "Domain and Business Email", "Booking System", "Recruitment or Careers Page",
  "E-commerce Website", "Custom Web Development", "Other"
];
const DEFAULT_CATEGORIES = ["Care Home", "Nursing Home", "Children's Home", "Supported Living", "Domiciliary Care", "Construction Company", "Taxi Company", "Hotel", "School", "Healthcare Provider", "Other"];
const DEFAULT_TEMPLATES = [
  ["Initial company introduction", "Introduction", "Introducing Innovex website services", "Hi {{contactName}},\n\nThank you for speaking with our team. Innovex Resource Group Limited supports organisations with professional websites, SEO and digital growth.\n\nPlease let us know a suitable time to discuss your requirements.\n\nKind regards,\nInnovex Resource Group Limited"],
  ["Website design service", "Website design", "Professional website support for {{businessName}}", "Hi {{contactName}},\n\nThank you for your interest in a professional website for {{businessName}}. Our team can help with a responsive, credible website designed around your services and enquiry goals.\n\nKind regards,\nInnovex Resource Group Limited"],
  ["Website redesign service", "Website redesign", "Website redesign support for {{businessName}}", "Hi {{contactName}},\n\nWe would be pleased to review the current website for {{businessName}} and discuss improvements to design, mobile usability, speed and enquiries.\n\nKind regards,\nInnovex Resource Group Limited"],
  ["SEO service", "SEO", "SEO and online visibility support", "Hi {{contactName}},\n\nInnovex can support {{businessName}} with local SEO, content and practical search visibility improvements.\n\nKind regards,\nInnovex Resource Group Limited"],
  ["Website maintenance", "Website maintenance", "Website maintenance support", "Hi {{contactName}},\n\nInnovex can provide ongoing website updates, maintenance and technical support for {{businessName}}.\n\nKind regards,\nInnovex Resource Group Limited"],
  ["Send me more information", "Information request", "Further information from Innovex", "Hi {{contactName}},\n\nAs requested, here is further information about the website and digital growth support available from Innovex Resource Group Limited.\n\nPlease reply with any questions or a suitable time to speak.\n\nKind regards,\nInnovex Resource Group Limited"],
  ["Follow-up after conversation", "Follow-up", "Following up on our recent conversation", "Hi {{contactName}},\n\nI am following up on our recent conversation regarding digital support for {{businessName}}. Please let us know if you would like further information or a meeting with our team.\n\nKind regards,\nInnovex Resource Group Limited"],
  ["Meeting confirmation", "Meeting", "Meeting confirmation with Innovex", "Hi {{contactName}},\n\nThank you for arranging a meeting with Innovex Resource Group Limited. We look forward to discussing the requirements for {{businessName}}.\n\nKind regards,\nInnovex Resource Group Limited"],
  ["Proposal follow-up", "Proposal", "Following up on the Innovex proposal", "Hi {{contactName}},\n\nI am following up on the proposal shared with {{businessName}}. Please let us know if you have questions or would like to discuss the next steps.\n\nKind regards,\nInnovex Resource Group Limited"],
  ["Final follow-up", "Final follow-up", "Final follow-up from Innovex", "Hi {{contactName}},\n\nI wanted to make one final follow-up regarding the website or digital support discussed for {{businessName}}. We would be happy to help whenever the timing is right.\n\nKind regards,\nInnovex Resource Group Limited"]
];

const prospectFields = [
  "businessName", "businessCategory", "contactPerson", "contactJobTitle", "telephone",
  "secondaryPhone", "email", "secondaryEmail", "websiteUrl", "townCity", "postcode",
  "fullAddress", "region", "decisionMakerName", "decisionMakerPosition", "existingSupplier",
  "websiteCondition", "budgetIndication", "expectedTimeline", "preferredContactMethod",
  "initialResponse", "status", "interestedServices", "notes", "assignedTo"
];

const emailLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 100, standardHeaders: true, legacyHeaders: false });
const escapeRegex = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isManager = (user) => ["admin", "super_admin", "sales_manager"].includes(user?.role) || hasPermission(user, "webLeads.manage");
const isSettingsManager = (user) => ["admin", "super_admin"].includes(user?.role);
const requireSettingsOwner = (req, res, next) => isSettingsManager(req.user) ? next() : res.status(403).json({ message: "Only the Innovex owner can manage CRM categories" });
const actor = (user) => ({ user: user._id, name: user.name, role: user.role });
const timeline = (user, type, details, privateEntry = false) => ({ type, details, private: privateEntry, actor: actor(user), createdAt: new Date() });

function ownerFilter(req, filter = {}) {
  return isManager(req.user) ? filter : { ...filter, createdBy: req.user._id };
}

function safeProspect(document, user) {
  const item = document?.toObject ? document.toObject() : { ...document };
  if (!isManager(user)) {
    delete item.internalNotes;
    item.timeline = (item.timeline || []).filter((entry) => !entry.private);
  }
  return item;
}

function cleanProspect(input, user, existing = null) {
  const data = pick(input, prospectFields);
  if (data.email) validateEmail(data.email);
  if (data.secondaryEmail) validateEmail(data.secondaryEmail);
  if (data.email) data.email = data.email.toLowerCase().trim();
  if (data.secondaryEmail) data.secondaryEmail = data.secondaryEmail.toLowerCase().trim();
  if (data.postcode) data.postcode = data.postcode.toUpperCase().replace(/\s+/g, " ").trim();
  if (data.interestedServices) data.interestedServices = [...new Set((Array.isArray(data.interestedServices) ? data.interestedServices : []).filter((item) => SERVICES.includes(item)))];
  if (data.status && !WEB_LEAD_STATUSES.includes(data.status)) data.status = "New Prospect";
  if (!isManager(user)) {
    delete data.assignedTo;
    if (MANAGER_STATUSES.has(data.status)) data.status = existing?.status || "Under Review";
    if (!AGENT_STATUSES.includes(data.status)) data.status = existing?.status || "New Prospect";
    if (existing?.qualification?.locked) {
      ["decisionMakerName", "decisionMakerPosition", "websiteCondition", "budgetIndication", "expectedTimeline"].forEach((key) => delete data[key]);
    }
  }
  return data;
}

async function ensureDefaults(user) {
  await Promise.all([
    ...DEFAULT_CATEGORIES.map((name) => WebLeadCategory.updateOne({ name }, { $setOnInsert: { name, isActive: true, createdBy: user._id } }, { upsert: true })),
    ...DEFAULT_TEMPLATES.map(([name, type, subject, body]) => WebLeadTemplate.updateOne({ name }, { $setOnInsert: { name, type, subject, body, isActive: true, createdBy: user._id, updatedBy: user._id } }, { upsert: true }))
  ]);
}

async function prospectForUser(req, id) {
  const prospect = await WebLeadProspect.findOne(ownerFilter(req, { _id: id }));
  if (!prospect) {
    const error = new Error("Prospect not found or not available to your account");
    error.statusCode = 404;
    throw error;
  }
  return prospect;
}

async function notifyManagers(prospect, type, title, message) {
  const managers = await User.find({ role: { $in: ["admin", "super_admin", "sales_manager"] }, isActive: true }).select("_id").lean();
  if (managers.length) await WebLeadNotification.insertMany(managers.map(({ _id }) => ({ user: _id, prospect: prospect._id, type, title, message })));
}

function buildListFilter(req) {
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.businessCategory = req.query.category;
  if (req.query.service) filter.interestedServices = req.query.service;
  if (req.query.agent && isManager(req.user)) filter.createdBy = req.query.agent;
  if (req.query.emailRequested === "true") filter.status = "Email Requested";
  if (req.query.qualified === "true") filter.status = { $in: ["Qualified", "Under Review", "Accepted by Innovex", "Rejected by Innovex"] };
  if (req.query.meetingRequested === "true") filter["meetingRequests.0"] = { $exists: true };
  if (req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search), "i");
    filter.$or = ["businessName", "contactPerson", "telephone", "email", "websiteUrl", "postcode"].map((key) => ({ [key]: regex }));
  }
  if (req.query.from || req.query.to) {
    filter.createdAt = {};
    if (req.query.from) filter.createdAt.$gte = new Date(`${req.query.from}T00:00:00`);
    if (req.query.to) filter.createdAt.$lte = new Date(`${req.query.to}T23:59:59.999`);
  }
  return ownerFilter(req, filter);
}

router.get("/meta", async (req, res, next) => {
  try {
    await ensureDefaults(req.user);
    const categories = await WebLeadCategory.find({ isActive: true }).sort({ name: 1 }).lean();
    const templates = await WebLeadTemplate.find(isManager(req.user) ? {} : { isActive: true }).sort({ name: 1 }).lean();
    const agents = isManager(req.user) ? await User.find({ role: "external_agent", isActive: true }).select("name email").sort({ name: 1 }).lean() : [];
    const internalStaff = isManager(req.user) ? await User.find({ role: { $ne: "external_agent" }, isActive: true }).select("name email role").sort({ name: 1 }).lean() : [];
    res.json({ categories: categories.length ? categories : DEFAULT_CATEGORIES.map((name) => ({ name, isActive: true })), services: SERVICES, statuses: isManager(req.user) ? WEB_LEAD_STATUSES : AGENT_STATUSES, templates, agents, internalStaff, senders: allowedSenderAccountsForUser(req.user), manager: isManager(req.user), settingsManager: isSettingsManager(req.user) });
  } catch (error) { next(error); }
});

router.get("/dashboard", async (req, res, next) => {
  try {
    const scope = buildListFilter(req);
    const now = new Date();
    const dayEnd = new Date(now); dayEnd.setHours(23, 59, 59, 999);
    const aggregation = await WebLeadProspect.aggregate([
      { $match: scope },
      { $group: { _id: null, total: { $sum: 1 }, emailRequests: { $sum: { $cond: [{ $eq: ["$status", "Email Requested"] }, 1, 0] } }, interested: { $sum: { $cond: [{ $eq: ["$status", "Interested"] }, 1, 0] } }, qualified: { $sum: { $cond: [{ $in: ["$status", ["Qualified", "Under Review", "Accepted by Innovex"]] }, 1, 0] } }, accepted: { $sum: { $cond: [{ $eq: ["$status", "Accepted by Innovex"] }, 1, 0] } }, rejected: { $sum: { $cond: [{ $eq: ["$status", "Rejected by Innovex"] }, 1, 0] } }, won: { $sum: { $cond: [{ $eq: ["$status", "Won"] }, 1, 0] } }, emailsSent: { $sum: { $size: { $filter: { input: "$emails", as: "email", cond: { $eq: ["$$email.status", "Sent"] } } } } }, meetings: { $sum: { $size: "$meetingRequests" } } } }
    ]);
    const prospects = await WebLeadProspect.find(scope).select("followUps meetingRequests").lean();
    let dueToday = 0, overdue = 0, meetingsBooked = 0;
    prospects.forEach((item) => {
      (item.followUps || []).filter((follow) => !follow.completed).forEach((follow) => {
        const due = new Date(follow.dueAt);
        if (due < now) overdue += 1; else if (due <= dayEnd) dueToday += 1;
      });
      meetingsBooked += (item.meetingRequests || []).filter((meeting) => ["Approved", "Confirmed"].includes(meeting.status)).length;
    });
    const recent = await WebLeadProspect.find(scope).select("businessName contactPerson status businessCategory interestedServices createdByName updatedAt").sort({ updatedAt: -1 }).limit(8).lean();
    const base = aggregation[0] || {};
    res.json({ stats: { ...base, dueToday, overdue, meetingsBooked }, recent });
  } catch (error) { next(error); }
});

router.get("/prospects", async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 20), 1), 100);
    const filter = buildListFilter(req);
    const [items, total] = await Promise.all([
      WebLeadProspect.find(filter).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      WebLeadProspect.countDocuments(filter)
    ]);
    res.json({ items: items.map((item) => safeProspect(item, req.user)), total, page, pages: Math.ceil(total / limit) || 1, limit });
  } catch (error) { next(error); }
});

router.post("/duplicates", async (req, res, next) => {
  try {
    const checks = [];
    if (req.body.telephone) checks.push({ telephone: req.body.telephone });
    if (req.body.email) checks.push({ email: String(req.body.email).toLowerCase() });
    if (req.body.websiteUrl) checks.push({ websiteUrl: String(req.body.websiteUrl).toLowerCase() });
    if (req.body.businessName && req.body.postcode) checks.push({ businessName: new RegExp(`^${escapeRegex(req.body.businessName)}$`, "i"), postcode: new RegExp(`^${escapeRegex(req.body.postcode)}$`, "i") });
    const items = checks.length ? await WebLeadProspect.find({ $or: checks }).select("businessName contactPerson telephone email websiteUrl postcode status createdByName").limit(10).lean() : [];
    res.json({
      duplicate: items.length > 0,
      items: isManager(req.user)
        ? items.map((item) => safeProspect(item, req.user))
        : items.map(() => ({ businessName: "Existing CRM prospect", status: "Potential duplicate" }))
    });
  } catch (error) { next(error); }
});

router.post("/prospects", async (req, res, next) => {
  try {
    requireFields(req.body, ["businessName", "businessCategory", "contactPerson", "contactJobTitle", "telephone", "email", "websiteUrl", "townCity", "postcode", "initialResponse", "status", "notes"]);
    if (!Array.isArray(req.body.interestedServices) || !req.body.interestedServices.length) {
      return res.status(400).json({ message: "Select at least one interested service" });
    }
    if (req.body.followUpRequired && !req.body.followUpAt) {
      return res.status(400).json({ message: "Select a follow-up date and time" });
    }
    const data = cleanProspect(req.body, req.user);
    const initialFollowUps = req.body.followUpRequired && req.body.followUpAt ? [{ dueAt: req.body.followUpAt, contactMethod: req.body.preferredContactMethod || "Telephone", priority: req.body.followUpPriority || "Normal", notes: req.body.followUpNotes || req.body.notes, createdBy: actor(req.user) }] : [];
    const prospect = await WebLeadProspect.create({ ...data, followUps: initialFollowUps, createdBy: req.user._id, createdByName: req.user.name, lastUpdatedBy: req.user._id, lastUpdatedByName: req.user.name, timeline: [timeline(req.user, "Prospect created", `${data.businessName} was added as ${data.status}.`), ...(initialFollowUps.length ? [timeline(req.user, "Follow-up created", `Initial follow-up scheduled for ${new Date(req.body.followUpAt).toLocaleString("en-GB")}.`)] : [])] });
    await logActivity(req, { module: "Web Leads CRM", action: "Created", entityType: "WebLeadProspect", entityId: prospect._id, summary: `Created prospect ${prospect.businessName}` });
    res.status(201).json(safeProspect(prospect, req.user));
  } catch (error) { next(error); }
});

router.get("/prospects/:id", async (req, res, next) => {
  try { res.json(safeProspect(await prospectForUser(req, req.params.id), req.user)); } catch (error) { next(error); }
});

router.get("/prospects/:id/duplicates", requirePermission("webLeads.manage"), async (req, res, next) => {
  try {
    const prospect = await WebLeadProspect.findById(req.params.id).lean();
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });
    const checks = [
      prospect.telephone && { telephone: prospect.telephone },
      prospect.email && { email: prospect.email },
      prospect.websiteUrl && { websiteUrl: prospect.websiteUrl },
      prospect.businessName && prospect.postcode && { businessName: new RegExp(`^${escapeRegex(prospect.businessName)}$`, "i"), postcode: prospect.postcode }
    ].filter(Boolean);
    const items = checks.length ? await WebLeadProspect.find({ _id: { $ne: prospect._id }, $or: checks }).select("businessName contactPerson telephone email websiteUrl postcode status createdByName updatedAt").limit(10).lean() : [];
    res.json(items);
  } catch (error) { next(error); }
});

router.post("/prospects/:id/merge", requirePermission("webLeads.manage"), async (req, res, next) => {
  try {
    requireFields(req.body, ["duplicateId"]);
    const [target, duplicate] = await Promise.all([
      WebLeadProspect.findById(req.params.id),
      WebLeadProspect.findById(req.body.duplicateId)
    ]);
    if (!target || !duplicate) return res.status(404).json({ message: "One of the prospect records no longer exists" });
    if (String(target._id) === String(duplicate._id)) return res.status(400).json({ message: "A prospect cannot be merged into itself" });
    const fillable = prospectFields.filter((field) => !["status", "assignedTo", "interestedServices"].includes(field));
    fillable.forEach((field) => { if (!target[field] && duplicate[field]) target[field] = duplicate[field]; });
    target.interestedServices = [...new Set([...(target.interestedServices || []), ...(duplicate.interestedServices || [])])];
    ["interactions", "followUps", "emails", "meetingRequests", "internalNotes", "timeline"].forEach((field) => {
      target[field].push(...(duplicate[field] || []));
    });
    if (!target.qualification?.locked && duplicate.qualification?.locked) target.qualification = duplicate.qualification;
    target.timeline.push(timeline(req.user, "Duplicate merged", `${duplicate.businessName} was merged into this prospect.`));
    target.lastUpdatedBy = req.user._id;
    target.lastUpdatedByName = req.user.name;
    await target.save();
    await WebLeadProspect.deleteOne({ _id: duplicate._id });
    await WebLeadNotification.deleteMany({ prospect: duplicate._id });
    await logActivity(req, { module: "Web Leads CRM", action: "Merged", entityType: "WebLeadProspect", entityId: target._id, summary: `Merged duplicate ${duplicate.businessName} into ${target.businessName}` });
    res.json(safeProspect(target, req.user));
  } catch (error) { next(error); }
});

router.put("/prospects/:id", async (req, res, next) => {
  try {
    const prospect = await prospectForUser(req, req.params.id);
    const previousStatus = prospect.status;
    const data = cleanProspect(req.body, req.user, prospect);
    prospect.set({ ...data, lastUpdatedBy: req.user._id, lastUpdatedByName: req.user.name });
    prospect.timeline.push(timeline(req.user, previousStatus !== prospect.status ? "Status changed" : "Prospect edited", previousStatus !== prospect.status ? `${previousStatus} changed to ${prospect.status}.` : "Prospect information was updated."));
    await prospect.save();
    await logActivity(req, { module: "Web Leads CRM", action: "Updated", entityType: "WebLeadProspect", entityId: prospect._id, summary: `Updated prospect ${prospect.businessName}` });
    res.json(safeProspect(prospect, req.user));
  } catch (error) { next(error); }
});

router.post("/prospects/:id/interactions", async (req, res, next) => {
  try {
    requireFields(req.body, ["interactionAt", "contactMethod", "prospectResponse"]);
    const prospect = await prospectForUser(req, req.params.id);
    prospect.interactions.push({ ...pick(req.body, ["interactionAt", "contactMethod", "personSpokenTo", "prospectResponse", "servicesDiscussed", "interestLevel", "followUpRequired", "followUpAt", "notes"]), createdBy: actor(req.user) });
    if (req.body.followUpRequired && req.body.followUpAt) prospect.followUps.push({ dueAt: req.body.followUpAt, contactMethod: req.body.contactMethod, priority: req.body.priority || "Normal", notes: req.body.notes, createdBy: actor(req.user) });
    prospect.timeline.push(timeline(req.user, "Interaction note added", `${req.body.contactMethod}: ${req.body.prospectResponse}`));
    await prospect.save();
    res.status(201).json(safeProspect(prospect, req.user));
  } catch (error) { next(error); }
});

router.post("/prospects/:id/follow-ups", async (req, res, next) => {
  try {
    requireFields(req.body, ["dueAt", "contactMethod"]);
    const prospect = await prospectForUser(req, req.params.id);
    prospect.followUps.push({ ...pick(req.body, ["dueAt", "contactMethod", "priority", "notes"]), createdBy: actor(req.user) });
    prospect.status = "Follow-Up Required";
    prospect.timeline.push(timeline(req.user, "Follow-up created", `Follow-up scheduled for ${new Date(req.body.dueAt).toLocaleString("en-GB")}.`));
    await prospect.save();
    res.status(201).json(safeProspect(prospect, req.user));
  } catch (error) { next(error); }
});

router.patch("/prospects/:id/follow-ups/:followUpId", async (req, res, next) => {
  try {
    const prospect = await prospectForUser(req, req.params.id);
    const followUp = prospect.followUps.id(req.params.followUpId);
    if (!followUp) return res.status(404).json({ message: "Follow-up not found" });
    if (req.body.completed !== undefined) { followUp.completed = Boolean(req.body.completed); followUp.completedAt = followUp.completed ? new Date() : null; }
    if (req.body.dueAt) followUp.dueAt = req.body.dueAt;
    if (req.body.priority) followUp.priority = req.body.priority;
    if (req.body.notes !== undefined) followUp.notes = req.body.notes;
    prospect.timeline.push(timeline(req.user, followUp.completed ? "Follow-up completed" : "Follow-up rescheduled", followUp.completed ? "Follow-up marked complete." : `Follow-up moved to ${new Date(followUp.dueAt).toLocaleString("en-GB")}.`));
    await prospect.save();
    res.json(safeProspect(prospect, req.user));
  } catch (error) { next(error); }
});

router.post("/prospects/:id/emails", emailLimiter, async (req, res, next) => {
  try {
    requireFields(req.body, ["templateId", "recipient", "subject", "message"]);
    validateEmail(req.body.recipient);
    const prospect = await prospectForUser(req, req.params.id);
    const template = await WebLeadTemplate.findOne({ _id: req.body.templateId, isActive: true });
    if (!template) return res.status(400).json({ message: "Select an active approved template" });
    const fromEmail = String(req.body.fromEmail || "").toLowerCase().trim();
    if (!canUseSender(req.user, fromEmail)) return res.status(403).json({ message: "You are not allowed to use this sender mailbox" });
    const cc = Array.isArray(req.body.cc) ? req.body.cc.filter(Boolean) : String(req.body.cc || "").split(/[;,]/).map((item) => item.trim()).filter(Boolean);
    cc.forEach(validateEmail);
    const draft = req.body.saveAsDraft === true;
    const email = { sender: fromEmail, recipient: req.body.recipient, cc, subject: req.body.subject, content: req.body.message, template: template._id, status: draft ? "Draft" : "Sent", sentAt: draft ? null : new Date(), createdBy: actor(req.user) };
    if (!draft) {
      const result = await sendComposedEmail({ fromEmail, to: [req.body.recipient], cc, subject: req.body.subject, message: req.body.message, replyTo: fromEmail });
      if (!result.sent) { email.status = "Failed"; email.deliveryMessage = result.reason || "Email failed"; }
      await EmailLog.create({ fromEmail, to: [req.body.recipient], cc, subject: req.body.subject, message: req.body.message, targetType: "WebLeadProspect", targetId: prospect._id, status: email.status === "Sent" ? "Sent" : "Failed", error: email.deliveryMessage, sentBy: { user: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role } });
    }
    prospect.emails.push(email);
    prospect.timeline.push(timeline(req.user, draft ? "Draft saved" : email.status === "Sent" ? "Email sent" : "Email failed", `${req.body.subject} to ${req.body.recipient}.`));
    if (!draft && email.status === "Sent") prospect.status = "Information Sent";
    await prospect.save();
    await logActivity(req, { module: "Web Leads CRM", action: draft ? "Draft saved" : email.status === "Sent" ? "Email sent" : "Email failed", entityType: "WebLeadProspect", entityId: prospect._id, summary: `${req.body.subject} · ${prospect.businessName}` });
    if (email.status === "Failed") return res.status(400).json({ message: email.deliveryMessage, prospect: safeProspect(prospect, req.user) });
    res.status(201).json({ message: draft ? "Draft saved." : "Email sent.", prospect: safeProspect(prospect, req.user) });
  } catch (error) { next(error); }
});

router.post("/prospects/:id/qualify", async (req, res, next) => {
  try {
    requireFields(req.body, ["decisionMakerName", "decisionMakerRole", "directPhone", "email", "websiteUrl", "mainBusinessProblem", "websiteCondition", "budgetIndication", "expectedTimeline", "preferredMeetingAt", "preferredContactMethod", "detailedNotes"]);
    validateEmail(req.body.email);
    if (!Array.isArray(req.body.requiredServices) || !req.body.requiredServices.length) {
      return res.status(400).json({ message: "Select at least one required website service" });
    }
    const prospect = await prospectForUser(req, req.params.id);
    prospect.qualification = { ...pick(req.body, ["decisionMakerName", "decisionMakerRole", "directPhone", "email", "websiteUrl", "mainBusinessProblem", "requiredServices", "websiteCondition", "budgetIndication", "expectedTimeline", "preferredMeetingAt", "preferredContactMethod", "detailedNotes"]), locked: true, submittedAt: new Date() };
    prospect.status = "Under Review";
    prospect.timeline.push(timeline(req.user, "Qualified lead submitted", "Qualification was submitted for Innovex review."));
    await prospect.save();
    await notifyManagers(prospect, "Qualified lead submitted", "New qualified web lead", `${prospect.businessName} was submitted by ${req.user.name}.`);
    await logActivity(req, { module: "Web Leads CRM", action: "Qualified", entityType: "WebLeadProspect", entityId: prospect._id, summary: `Qualified lead submitted: ${prospect.businessName}` });
    res.json(safeProspect(prospect, req.user));
  } catch (error) { next(error); }
});

router.post("/prospects/:id/review", requirePermission("webLeads.manage"), async (req, res, next) => {
  try {
    const actionMap = { accept: "Accepted by Innovex", reject: "Rejected by Innovex", more_info: "Under Review", reopen: "Interested" };
    if (!actionMap[req.body.action]) return res.status(400).json({ message: "Invalid review action" });
    const prospect = await WebLeadProspect.findById(req.params.id);
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });
    prospect.status = actionMap[req.body.action];
    if (req.body.assignedTo && String(prospect.assignedTo || "") !== String(req.body.assignedTo)) {
      prospect.assignedTo = req.body.assignedTo;
      const assignee = await User.findById(req.body.assignedTo).select("name").lean();
      prospect.timeline.push(timeline(req.user, "Lead assigned internally", `Assigned to ${assignee?.name || "an internal representative"}.`));
    }
    prospect.timeline.push(timeline(req.user, req.body.action === "accept" ? "Lead accepted" : req.body.action === "reject" ? "Lead rejected" : req.body.action === "more_info" ? "Manager requested information" : "Lead reopened", req.body.note || `Manager action: ${req.body.action}.`));
    await prospect.save();
    await WebLeadNotification.create({ user: prospect.createdBy, prospect: prospect._id, type: `lead_${req.body.action}`, title: `Lead ${req.body.action.replace("_", " ")}`, message: `${prospect.businessName}: ${req.body.note || prospect.status}` });
    await logActivity(req, { module: "Web Leads CRM", action: `Lead ${req.body.action}`, entityType: "WebLeadProspect", entityId: prospect._id, summary: `${prospect.businessName} · ${prospect.status}` });
    res.json(safeProspect(prospect, req.user));
  } catch (error) { next(error); }
});

router.post("/prospects/:id/internal-notes", requirePermission("webLeads.manage"), async (req, res, next) => {
  try {
    requireFields(req.body, ["note"]);
    const prospect = await WebLeadProspect.findById(req.params.id);
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });
    prospect.internalNotes.push({ note: req.body.note, actor: actor(req.user) });
    prospect.timeline.push(timeline(req.user, "Internal note added", "A private manager note was added.", true));
    await prospect.save();
    res.status(201).json(safeProspect(prospect, req.user));
  } catch (error) { next(error); }
});

router.post("/prospects/:id/meetings", async (req, res, next) => {
  try {
    requireFields(req.body, ["preferredAt", "meetingType", "prospectEmail", "prospectPhone"]);
    validateEmail(req.body.prospectEmail);
    const prospect = await prospectForUser(req, req.params.id);
    prospect.meetingRequests.push({ ...pick(req.body, ["preferredAt", "meetingType", "prospectEmail", "prospectPhone", "notes"]), createdBy: actor(req.user) });
    prospect.status = "Meeting Requested";
    prospect.timeline.push(timeline(req.user, "Meeting requested", `${req.body.meetingType} requested for ${new Date(req.body.preferredAt).toLocaleString("en-GB")}.`));
    await prospect.save();
    await notifyManagers(prospect, "Meeting requested", "New web lead meeting request", `${prospect.businessName} requested a ${req.body.meetingType} meeting.`);
    res.status(201).json(safeProspect(prospect, req.user));
  } catch (error) { next(error); }
});

router.patch("/prospects/:id/meetings/:meetingId", requirePermission("webLeads.manage"), async (req, res, next) => {
  try {
    const prospect = await WebLeadProspect.findById(req.params.id);
    const meeting = prospect?.meetingRequests.id(req.params.meetingId);
    if (!meeting) return res.status(404).json({ message: "Meeting request not found" });
    if (req.body.status) meeting.status = req.body.status;
    if (req.body.preferredAt) meeting.preferredAt = req.body.preferredAt;
    if (req.body.assignedTo) meeting.assignedTo = req.body.assignedTo;
    prospect.status = ["Approved", "Confirmed"].includes(meeting.status) ? "Meeting Booked" : meeting.status === "Rejected" ? "Interested" : prospect.status;
    prospect.timeline.push(timeline(req.user, meeting.status === "Confirmed" ? "Meeting confirmed" : "Meeting updated", `Meeting is now ${meeting.status}.`));
    await prospect.save();
    await WebLeadNotification.create({ user: prospect.createdBy, prospect: prospect._id, type: "meeting_updated", title: `Meeting ${meeting.status}`, message: `${prospect.businessName} meeting is ${meeting.status}.` });
    res.json(safeProspect(prospect, req.user));
  } catch (error) { next(error); }
});

router.get("/templates", async (req, res, next) => {
  try { res.json(await WebLeadTemplate.find(isManager(req.user) ? {} : { isActive: true }).sort({ name: 1 }).lean()); } catch (error) { next(error); }
});
router.post("/templates", requirePermission("webLeads.manage"), async (req, res, next) => {
  try { requireFields(req.body, ["name", "type", "subject", "body"]); res.status(201).json(await WebLeadTemplate.create({ ...pick(req.body, ["name", "type", "subject", "body", "isActive"]), createdBy: req.user._id, updatedBy: req.user._id })); } catch (error) { next(error); }
});
router.put("/templates/:id", requirePermission("webLeads.manage"), async (req, res, next) => {
  try { const item = await WebLeadTemplate.findByIdAndUpdate(req.params.id, { ...pick(req.body, ["name", "type", "subject", "body", "isActive"]), updatedBy: req.user._id }, { new: true, runValidators: true }); if (!item) return res.status(404).json({ message: "Template not found" }); res.json(item); } catch (error) { next(error); }
});

router.get("/categories", async (req, res, next) => {
  try { const items = await WebLeadCategory.find().sort({ name: 1 }).lean(); res.json(items.length ? items : DEFAULT_CATEGORIES.map((name) => ({ name, isActive: true }))); } catch (error) { next(error); }
});
router.post("/categories", requireSettingsOwner, async (req, res, next) => {
  try { requireFields(req.body, ["name"]); res.status(201).json(await WebLeadCategory.create({ name: req.body.name, isActive: req.body.isActive !== false, createdBy: req.user._id })); } catch (error) { next(error); }
});
router.patch("/categories/:id", requireSettingsOwner, async (req, res, next) => {
  try { const item = await WebLeadCategory.findByIdAndUpdate(req.params.id, pick(req.body, ["name", "isActive"]), { new: true, runValidators: true }); if (!item) return res.status(404).json({ message: "Category not found" }); res.json(item); } catch (error) { next(error); }
});

router.get("/notifications", async (req, res, next) => {
  try {
    if (!isManager(req.user)) {
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const prospects = await WebLeadProspect.find({ createdBy: req.user._id, followUps: { $elemMatch: { completed: false, dueAt: { $lte: tomorrow } } } }).select("businessName followUps").lean();
      const candidates = prospects.flatMap((prospect) => (prospect.followUps || []).filter((item) => !item.completed && new Date(item.dueAt) <= tomorrow).map((item) => ({
        user: req.user._id,
        prospect: prospect._id,
        type: new Date(item.dueAt) < now ? "follow_up_overdue" : "follow_up_due",
        title: new Date(item.dueAt) < now ? "Follow-up overdue" : "Follow-up due",
        message: `${prospect.businessName} · ${new Date(item.dueAt).toLocaleString("en-GB")}`
      })));
      for (const notice of candidates) {
        const exists = await WebLeadNotification.exists({ user: notice.user, prospect: notice.prospect, type: notice.type, message: notice.message });
        if (!exists) await WebLeadNotification.create(notice);
      }
    }
    res.json(await WebLeadNotification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(50).lean());
  } catch (error) { next(error); }
});
router.patch("/notifications/:id/read", async (req, res, next) => {
  try { const item = await WebLeadNotification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { read: true }, { new: true }); if (!item) return res.status(404).json({ message: "Notification not found" }); res.json(item); } catch (error) { next(error); }
});

router.get("/reports", async (req, res, next) => {
  try {
    const filter = buildListFilter(req);
    const byAgent = await WebLeadProspect.aggregate([
      { $match: filter },
      { $group: { _id: { user: "$createdBy", name: "$createdByName" }, prospects: { $sum: 1 }, interested: { $sum: { $cond: [{ $eq: ["$status", "Interested"] }, 1, 0] } }, qualified: { $sum: { $cond: [{ $in: ["$status", ["Qualified", "Under Review", "Accepted by Innovex"]] }, 1, 0] } }, accepted: { $sum: { $cond: [{ $eq: ["$status", "Accepted by Innovex"] }, 1, 0] } }, rejected: { $sum: { $cond: [{ $eq: ["$status", "Rejected by Innovex"] }, 1, 0] } }, won: { $sum: { $cond: [{ $eq: ["$status", "Won"] }, 1, 0] } }, emailsSent: { $sum: { $size: { $filter: { input: "$emails", as: "email", cond: { $eq: ["$$email.status", "Sent"] } } } } }, followUps: { $sum: { $size: "$followUps" } }, followUpsCompleted: { $sum: { $size: { $filter: { input: "$followUps", as: "follow", cond: { $eq: ["$$follow.completed", true] } } } } }, followUpsOverdue: { $sum: { $size: { $filter: { input: "$followUps", as: "follow", cond: { $and: [{ $eq: ["$$follow.completed", false] }, { $lt: ["$$follow.dueAt", new Date()] }] } } } } }, meetings: { $sum: { $size: "$meetingRequests" } }, meetingsBooked: { $sum: { $size: { $filter: { input: "$meetingRequests", as: "meeting", cond: { $in: ["$$meeting.status", ["Approved", "Confirmed"]] } } } } } } },
      { $sort: { prospects: -1 } }
    ]);
    res.json({ byAgent: byAgent.map((row) => ({ ...row, conversionRate: row.prospects ? Number(((row.accepted / row.prospects) * 100).toFixed(1)) : 0 })) });
  } catch (error) { next(error); }
});

export default router;
