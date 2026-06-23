import express from "express";
import EmailLog from "../models/EmailLog.js";
import { allowedSenderAccountsForUser, canUseSender } from "../config/emailAccounts.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { sendComposedEmail } from "../services/emailService.js";
import { requireFields, validateEmail } from "../utils.js";

const router = express.Router();
router.use(protect, requirePermission("emails.view"));

function splitRecipients(value = []) {
  const input = Array.isArray(value) ? value : String(value || "").split(/[;,\n]/);
  return input.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean);
}

function validateRecipients(emails = [], field = "recipient") {
  emails.forEach((email) => {
    try {
      validateEmail(email);
    } catch {
      const error = new Error(`Invalid ${field}: ${email}`);
      error.statusCode = 400;
      throw error;
    }
  });
}

function actor(req) {
  return {
    user: req.user._id,
    name: req.user.name,
    email: req.user.email,
    role: req.user.role
  };
}

router.get("/senders", (req, res) => {
  res.json({ senders: allowedSenderAccountsForUser(req.user) });
});

router.get("/logs", async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);
    const skip = (page - 1) * limit;
    const filter = {};

    if (!["admin", "super_admin"].includes(req.user.role)) filter["sentBy.user"] = req.user._id;
    if (req.query.search) {
      const regex = new RegExp(String(req.query.search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ fromEmail: regex }, { to: regex }, { subject: regex }, { message: regex }];
    }

    const [items, total] = await Promise.all([
      EmailLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      EmailLog.countDocuments(filter)
    ]);

    res.json({ items, total, page, pages: Math.ceil(total / limit) || 1, limit });
  } catch (error) {
    next(error);
  }
});

router.post("/send", async (req, res, next) => {
  try {
    requireFields(req.body, ["fromEmail", "to", "subject", "message"]);

    const fromEmail = String(req.body.fromEmail || "").toLowerCase().trim();
    if (!canUseSender(req.user, fromEmail)) {
      return res.status(403).json({ message: "You are not allowed to send from this mailbox" });
    }

    const to = splitRecipients(req.body.to);
    const cc = splitRecipients(req.body.cc);
    const bcc = splitRecipients(req.body.bcc);
    validateRecipients(to, "recipient");
    validateRecipients(cc, "CC recipient");
    validateRecipients(bcc, "BCC recipient");

    if (!to.length) return res.status(400).json({ message: "At least one recipient is required" });

    const payload = {
      fromEmail,
      to,
      cc,
      bcc,
      subject: req.body.subject,
      message: req.body.message,
      replyTo: fromEmail
    };

    const result = await sendComposedEmail(payload);
    const log = await EmailLog.create({
      ...payload,
      status: result.sent ? "Sent" : "Failed",
      error: result.reason || "",
      sentBy: actor(req)
    });

    if (!result.sent) return res.status(400).json({ message: result.reason || "Email was not sent", log });
    res.status(201).json({ message: "Email sent successfully.", log });
  } catch (error) {
    next(error);
  }
});

export default router;
