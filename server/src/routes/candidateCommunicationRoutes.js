import express from "express";
import mongoose from "mongoose";
import CallLog from "../models/CallLog.js";
import Candidate from "../models/Candidate.js";
import CandidateActivity from "../models/CandidateActivity.js";
import CandidateFollowUp from "../models/CandidateFollowUp.js";
import EmailLog from "../models/EmailLog.js";
import MailboxMessage from "../models/MailboxMessage.js";
import { allowedSenderAccountsForUser, canUseSender, findEmailAccount } from "../config/emailAccounts.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { sendComposedEmail } from "../services/emailService.js";
import { syncMailboxInbox } from "../services/mailboxSyncService.js";
import { requireFields } from "../utils.js";

const router = express.Router();
router.use(protect, requirePermission("talentPool.view"));

function actor(req) {
  return {
    user: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role
  };
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function validId(value) {
  return mongoose.Types.ObjectId.isValid(value);
}

function permittedMailboxAccounts(req) {
  const recruitmentAddress = String(process.env.SMTP_RECRUITMENT_ADDRESS || "recruitment@innovexresourcegroup.co.uk").toLowerCase().trim();
  return allowedSenderAccountsForUser(req.user).filter((account) => account.address === recruitmentAddress);
}

function permittedMailboxAddresses(req) {
  return permittedMailboxAccounts(req).map((account) => account.address);
}

function followUpViewFilter(view, now = new Date()) {
  if (view === "completed") return { status: "Completed" };
  if (view === "cancelled") return { status: "Cancelled" };
  if (view === "overdue") return { status: "Open", dueAt: { $lt: now } };
  if (view === "today") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { status: "Open", dueAt: { $gte: start, $lt: end } };
  }
  if (view === "upcoming") return { status: "Open", dueAt: { $gte: now } };
  return { status: "Open" };
}

async function refreshCandidateNextFollowUp(candidateId) {
  const next = await CandidateFollowUp.findOne({ candidate: candidateId, status: "Open" }).sort({ dueAt: 1 }).select("dueAt assignedTo").lean();
  await Candidate.findByIdAndUpdate(candidateId, {
    $set: {
      nextFollowUpAt: next?.dueAt || null,
      ...(next?.assignedTo ? { assignedRecruiter: next.assignedTo } : {})
    }
  });
}

router.get("/summary", async (req, res, next) => {
  try {
    const mailboxes = permittedMailboxAddresses(req);
    const now = new Date();
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const [unread, unlinked, overdue, dueToday, open, linkedCandidates] = await Promise.all([
      MailboxMessage.countDocuments({ mailbox: { $in: mailboxes }, isRead: false }),
      MailboxMessage.countDocuments({ mailbox: { $in: mailboxes }, candidate: { $exists: false } }),
      CandidateFollowUp.countDocuments({ status: "Open", dueAt: { $lt: now } }),
      CandidateFollowUp.countDocuments({ status: "Open", dueAt: { $gte: start, $lt: end } }),
      CandidateFollowUp.countDocuments({ status: "Open" }),
      MailboxMessage.distinct("candidate", { mailbox: { $in: mailboxes }, candidate: { $exists: true } })
    ]);
    res.json({ unread, unlinked, overdue, dueToday, open, linkedCandidates: linkedCandidates.length, mailboxes: permittedMailboxAccounts(req) });
  } catch (error) {
    next(error);
  }
});

router.post("/sync", async (req, res, next) => {
  try {
    const allowed = permittedMailboxAddresses(req);
    const requested = String(req.body.mailbox || "").toLowerCase().trim();
    const targets = requested ? allowed.filter((address) => address === requested) : allowed;
    if (requested && !targets.length) return res.status(403).json({ message: "This mailbox is not assigned to your account" });
    if (!targets.length) return res.status(400).json({ message: "No mailbox is assigned to your account" });

    const results = [];
    for (const address of targets.slice(0, 5)) {
      const account = findEmailAccount(address);
      if (!account) continue;
      try {
        results.push(await syncMailboxInbox(account, { limit: req.body.limit || 30 }));
      } catch (error) {
        results.push({ mailbox: address, synced: 0, linked: 0, error: error.message || "Mailbox sync failed" });
      }
    }
    const synced = results.reduce((sum, result) => sum + Number(result.synced || 0), 0);
    const linked = results.reduce((sum, result) => sum + Number(result.linked || 0), 0);
    res.json({ results, synced, linked, message: `${synced} recent email${synced === 1 ? "" : "s"} synchronised; ${linked} linked to candidate profiles.` });
  } catch (error) {
    next(error);
  }
});

router.get("/inbox", async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 30), 1), 100);
    const view = String(req.query.view || "all").toLowerCase();
    const filter = { mailbox: { $in: permittedMailboxAddresses(req) } };
    if (req.query.mailbox) filter.mailbox = String(req.query.mailbox).toLowerCase().trim();
    if (!permittedMailboxAddresses(req).includes(filter.mailbox) && typeof filter.mailbox === "string") return res.status(403).json({ message: "This mailbox is not assigned to your account" });
    if (view === "unread") filter.isRead = false;
    if (view === "linked") filter.candidate = { $exists: true };
    if (view === "unlinked") filter.candidate = { $exists: false };
    if (req.query.search) {
      const regex = new RegExp(escapeRegex(req.query.search), "i");
      filter.$or = [{ subject: regex }, { text: regex }, { "from.address": regex }, { "from.name": regex }, { candidateName: regex }];
    }
    const includeInbound = view !== "sent";
    const includeSent = ["all", "sent", "linked"].includes(view);
    const sentFilter = { fromEmail: { $in: permittedMailboxAddresses(req) }, targetType: "Candidate" };
    if (req.query.search) {
      const regex = new RegExp(escapeRegex(req.query.search), "i");
      sentFilter.$or = [{ subject: regex }, { message: regex }, { to: regex }, { fromEmail: regex }];
    }
    const [inboundItems, inboundTotal, sentLogs, sentTotal] = await Promise.all([
      includeInbound ? MailboxMessage.find(filter).sort({ receivedAt: -1 }).skip((page - 1) * limit).limit(limit).lean() : [],
      includeInbound ? MailboxMessage.countDocuments(filter) : 0,
      includeSent ? EmailLog.find(sentFilter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean() : [],
      includeSent ? EmailLog.countDocuments(sentFilter) : 0
    ]);
    const candidateIds = sentLogs.map((item) => item.targetId).filter(Boolean);
    const sentCandidates = candidateIds.length ? await Candidate.find({ _id: { $in: candidateIds } }).select("name").lean() : [];
    const candidateNames = new Map(sentCandidates.map((candidate) => [String(candidate._id), candidate.name]));
    const mappedSent = sentLogs.map((item) => ({
      _id: item._id,
      recordType: "EmailLog",
      mailbox: item.fromEmail,
      direction: "Outbound",
      from: { name: item.fromName || item.sentBy?.name || "Innovex", address: item.fromEmail },
      to: (item.to || []).map((address) => ({ address })),
      subject: item.subject,
      text: item.message,
      snippet: String(item.message || "").replace(/\s+/g, " ").slice(0, 280),
      receivedAt: item.createdAt,
      isRead: true,
      candidate: item.targetId,
      candidateName: candidateNames.get(String(item.targetId)) || "Candidate",
      status: item.status
    }));
    const items = [...inboundItems, ...mappedSent].sort((a, b) => new Date(b.receivedAt) - new Date(a.receivedAt)).slice(0, limit);
    const total = inboundTotal + sentTotal;
    res.json({ items, total, page, pages: Math.ceil(total / limit) || 1, limit });
  } catch (error) {
    next(error);
  }
});

router.patch("/inbox/:id/read", async (req, res, next) => {
  try {
    const message = await MailboxMessage.findOneAndUpdate(
      { _id: req.params.id, mailbox: { $in: permittedMailboxAddresses(req) } },
      { $set: { isRead: req.body.isRead !== false } },
      { new: true }
    );
    if (!message) return res.status(404).json({ message: "Email not found" });
    res.json(message);
  } catch (error) {
    next(error);
  }
});

router.patch("/inbox/:id/link", async (req, res, next) => {
  try {
    if (!validId(req.body.candidateId)) return res.status(400).json({ message: "Select a valid candidate" });
    const candidate = await Candidate.findById(req.body.candidateId).select("name email");
    if (!candidate) return res.status(404).json({ message: "Candidate not found" });
    const message = await MailboxMessage.findOneAndUpdate(
      { _id: req.params.id, mailbox: { $in: permittedMailboxAddresses(req) } },
      { $set: { candidate: candidate._id, candidateName: candidate.name } },
      { new: true }
    );
    if (!message) return res.status(404).json({ message: "Email not found" });
    await Candidate.findByIdAndUpdate(candidate._id, { $max: { lastCommunicationAt: message.receivedAt || new Date() } });
    res.json({ message, candidate, notice: `Email linked to ${candidate.name}.` });
  } catch (error) {
    next(error);
  }
});

router.get("/follow-ups", async (req, res, next) => {
  try {
    const filter = followUpViewFilter(String(req.query.view || "open").toLowerCase());
    if (req.query.mine === "true") filter["assignedTo.user"] = req.user._id;
    if (req.query.candidateId && validId(req.query.candidateId)) filter.candidate = req.query.candidateId;
    const items = await CandidateFollowUp.find(filter)
      .populate("candidate", "name email phone desiredRole postcode city status")
      .sort({ status: 1, dueAt: 1 })
      .limit(250)
      .lean();
    res.json({ items, total: items.length, view: req.query.view || "open" });
  } catch (error) {
    next(error);
  }
});

router.post("/follow-ups", async (req, res, next) => {
  try {
    requireFields(req.body, ["candidateId", "dueAt", "purpose"]);
    if (!validId(req.body.candidateId)) return res.status(400).json({ message: "Invalid candidate" });
    const candidate = await Candidate.findById(req.body.candidateId).select("name");
    if (!candidate) return res.status(404).json({ message: "Candidate not found" });
    const dueAt = new Date(req.body.dueAt);
    if (Number.isNaN(dueAt.getTime())) return res.status(400).json({ message: "Enter a valid follow-up date and time" });
    const item = await CandidateFollowUp.create({
      candidate: candidate._id,
      dueAt,
      purpose: req.body.purpose,
      notes: req.body.notes,
      channel: req.body.channel || "Phone",
      priority: req.body.priority || "Normal",
      assignedTo: actor(req),
      createdBy: actor(req)
    });
    await Promise.all([
      refreshCandidateNextFollowUp(candidate._id),
      CandidateActivity.create({ candidate: candidate._id, type: "Follow-up update", channel: "CRM", summary: `Follow-up scheduled for ${candidate.name}`, details: `${req.body.channel || "Phone"}: ${req.body.purpose}`, createdBy: actor(req) })
    ]);
    res.status(201).json({ item, message: "Candidate follow-up scheduled." });
  } catch (error) {
    next(error);
  }
});

router.patch("/follow-ups/:id", async (req, res, next) => {
  try {
    const item = await CandidateFollowUp.findById(req.params.id);
    if (!item) return res.status(404).json({ message: "Follow-up not found" });
    if (req.body.status === "Completed" && !String(req.body.outcome || "").trim()) return res.status(400).json({ message: "Record an outcome before completing the follow-up" });
    ["dueAt", "channel", "priority", "purpose", "notes", "status", "outcome"].forEach((field) => {
      if (req.body[field] !== undefined) item[field] = req.body[field];
    });
    if (item.status === "Completed") {
      item.completedAt = new Date();
      item.completedBy = actor(req);
    }
    await item.save();
    await Promise.all([
      refreshCandidateNextFollowUp(item.candidate),
      CandidateActivity.create({ candidate: item.candidate, type: "Follow-up update", channel: "CRM", summary: `Follow-up ${item.status.toLowerCase()}`, details: item.outcome || item.purpose, createdBy: actor(req) })
    ]);
    res.json({ item, message: `Follow-up ${item.status.toLowerCase()}.` });
  } catch (error) {
    next(error);
  }
});

router.post("/:candidateId/notes", async (req, res, next) => {
  try {
    requireFields(req.body, ["summary"]);
    const candidate = await Candidate.findById(req.params.candidateId).select("name");
    if (!candidate) return res.status(404).json({ message: "Candidate not found" });
    const activity = await CandidateActivity.create({
      candidate: candidate._id,
      type: req.body.type || "Note",
      channel: req.body.channel || "CRM",
      summary: req.body.summary,
      details: req.body.details,
      createdBy: actor(req)
    });
    if (activity.type === "Message") await Candidate.findByIdAndUpdate(candidate._id, { $max: { lastCommunicationAt: activity.createdAt } });
    res.status(201).json({ activity, message: "Communication note added." });
  } catch (error) {
    next(error);
  }
});

router.post("/:candidateId/email", async (req, res, next) => {
  try {
    requireFields(req.body, ["fromEmail", "subject", "message"]);
    const fromEmail = String(req.body.fromEmail).toLowerCase().trim();
    if (!canUseSender(req.user, fromEmail) || !permittedMailboxAddresses(req).includes(fromEmail)) return res.status(403).json({ message: "Only the assigned recruitment mailbox can be used in Candidate Communications" });
    const candidate = await Candidate.findById(req.params.candidateId);
    if (!candidate) return res.status(404).json({ message: "Candidate not found" });
    if (!candidate.email) return res.status(400).json({ message: "Candidate email is missing" });
    if (candidate.status === "Do Not Contact") return res.status(409).json({ message: "This candidate is marked Do Not Contact" });
    const result = await sendComposedEmail({ fromEmail, to: [candidate.email], subject: req.body.subject, message: req.body.message, replyTo: fromEmail });
    const log = await EmailLog.create({
      fromEmail,
      fromName: findEmailAccount(fromEmail)?.name || "Innovex Resource Group Limited",
      to: [candidate.email],
      subject: req.body.subject,
      message: req.body.message,
      targetType: "Candidate",
      targetId: candidate._id,
      status: result.sent ? "Sent" : "Failed",
      error: result.reason || result.sentFolderError || "",
      sentBy: actor(req)
    });
    if (!result.sent) return res.status(400).json({ message: result.reason || "Email was not sent", log });
    const now = new Date();
    candidate.lastContactedAt = now;
    candidate.lastCommunicationAt = now;
    if (candidate.status === "Available") candidate.status = "Contacted";
    await candidate.save();
    res.status(201).json({ log, message: `Email sent to ${candidate.name} and recorded in their timeline.` });
  } catch (error) {
    next(error);
  }
});

router.get("/:candidateId/timeline", async (req, res, next) => {
  try {
    if (!validId(req.params.candidateId)) return res.status(400).json({ message: "Invalid candidate" });
    const candidate = await Candidate.findById(req.params.candidateId).select("-cv.data -cv.extractedText").lean();
    if (!candidate) return res.status(404).json({ message: "Candidate not found" });
    const mailboxes = permittedMailboxAddresses(req);
    const [inbound, outbound, calls, followUps, activities] = await Promise.all([
      MailboxMessage.find({ candidate: candidate._id, mailbox: { $in: mailboxes } }).sort({ receivedAt: -1 }).limit(100).lean(),
      EmailLog.find({ targetType: "Candidate", targetId: candidate._id }).sort({ createdAt: -1 }).limit(100).lean(),
      CallLog.find({ targetType: "Candidate", targetId: candidate._id }).sort({ createdAt: -1 }).limit(100).lean(),
      CandidateFollowUp.find({ candidate: candidate._id }).sort({ dueAt: -1 }).limit(100).lean(),
      CandidateActivity.find({ candidate: candidate._id }).sort({ createdAt: -1 }).limit(100).lean()
    ]);

    const timeline = [
      ...inbound.map((item) => ({ id: item._id, kind: "email-in", at: item.receivedAt, title: item.subject, detail: item.snippet || item.text, meta: `${item.from?.name || item.from?.address || "Sender"} → ${item.mailbox}`, status: item.isRead ? "Read" : "Unread" })),
      ...outbound.map((item) => ({ id: item._id, kind: "email-out", at: item.createdAt, title: item.subject, detail: item.message, meta: `${item.fromEmail} → ${candidate.email}`, status: item.status, actor: item.sentBy?.name })),
      ...calls.map((item) => ({ id: item._id, kind: "call", at: item.createdAt, title: `${item.direction} call · ${item.outcome}`, detail: item.notes, meta: item.targetPhone, status: item.status, actor: item.initiatedBy?.name })),
      ...followUps.map((item) => ({ id: item._id, kind: "follow-up", at: item.dueAt, title: `${item.channel} follow-up · ${item.status}`, detail: item.outcome || item.notes || item.purpose, meta: item.purpose, status: item.priority, actor: item.assignedTo?.name })),
      ...activities.map((item) => ({ id: item._id, kind: "activity", at: item.createdAt, title: item.summary, detail: item.details, meta: `${item.type} · ${item.channel}`, actor: item.createdBy?.name }))
    ].sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 250);
    res.json({ candidate, timeline, counts: { inbound: inbound.length, outbound: outbound.length, calls: calls.length, followUps: followUps.length, notes: activities.length } });
  } catch (error) {
    next(error);
  }
});

export default router;
