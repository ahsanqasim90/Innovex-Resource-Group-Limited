import express from "express";
import nodemailer from "nodemailer";
import { ImapFlow } from "imapflow";
import EmailAccount from "../models/EmailAccount.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { logActivity } from "../services/activityLogService.js";
import { describeMailError } from "../services/emailService.js";
import { requireFields } from "../utils.js";

const router = express.Router();

router.use(protect, requirePermission("organization.manage"));

function safeAccount(account) {
  return {
    id: account._id,
    address: account.address,
    label: account.label,
    name: account.name,
    host: account.host,
    port: account.port,
    secure: account.secure,
    user: account.user,
    imapHost: account.imapHost,
    imapPort: account.imapPort,
    imapSecure: account.imapSecure,
    isDefault: account.isDefault,
    verifiedAt: account.verifiedAt,
    lastError: account.lastError,
    createdAt: account.createdAt
  };
}

function readCredentials(body = {}) {
  const address = String(body.address || "").trim().toLowerCase();
  const host = String(body.host || "").trim();
  const port = Number(body.port || (body.secure ? 465 : 587));
  const secure = Boolean(body.secure);
  const user = String(body.user || address).trim();
  const pass = String(body.pass || "");
  const imapHost = String(body.imapHost || host).trim();
  const imapPort = Number(body.imapPort || 993);
  const imapSecure = body.imapSecure !== false;
  return { address, host, port, secure, user, pass, imapHost, imapPort, imapSecure, label: String(body.label || "").trim(), name: String(body.name || "").trim() };
}

// Verifies both the outgoing (SMTP) and incoming (IMAP) sides of a mailbox before
// it is ever saved, so an admin finds out about a typo'd password or port right
// away instead of discovering it the first time a candidate email fails to send.
async function testMailboxConnection(credentials) {
  const result = { smtp: { ok: false, message: "" }, imap: { ok: false, message: "" } };

  try {
    const transporter = nodemailer.createTransport({
      host: credentials.host,
      port: credentials.port,
      secure: credentials.secure,
      auth: { user: credentials.user, pass: credentials.pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000
    });
    await transporter.verify();
    transporter.close();
    result.smtp.ok = true;
  } catch (error) {
    result.smtp.message = describeMailError(error);
  }

  try {
    const client = new ImapFlow({
      host: credentials.imapHost,
      port: credentials.imapPort,
      secure: credentials.imapSecure,
      auth: { user: credentials.user, pass: credentials.pass },
      logger: false
    });
    await client.connect();
    await client.logout();
    result.imap.ok = true;
  } catch (error) {
    result.imap.message = describeMailError(error);
  }

  return result;
}

// Dry-run check: try the credentials without saving anything.
router.post("/test", async (req, res, next) => {
  try {
    requireFields(req.body, ["address", "host", "user", "pass"]);
    const credentials = readCredentials(req.body);
    const result = await testMailboxConnection(credentials);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const accounts = await EmailAccount.find({}).sort({ isDefault: -1, createdAt: -1 }).lean();
    res.json({ accounts: accounts.map(safeAccount) });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    requireFields(req.body, ["address", "host", "user", "pass"]);
    const credentials = readCredentials(req.body);
    if (!credentials.address.includes("@")) return res.status(400).json({ message: "Enter a valid email address" });

    const check = await testMailboxConnection(credentials);
    if (!check.smtp.ok) return res.status(400).json({ message: `Could not sign in to send mail: ${check.smtp.message}`, check });

    const existing = await EmailAccount.findOne({ address: credentials.address });
    const account = existing || new EmailAccount({ address: credentials.address, createdBy: req.user._id });
    account.label = credentials.label || credentials.address;
    account.name = credentials.name || credentials.label || account.name;
    account.host = credentials.host;
    account.port = credentials.port;
    account.secure = credentials.secure;
    account.user = credentials.user;
    account.setPassword(credentials.pass);
    account.imapHost = credentials.imapHost;
    account.imapPort = credentials.imapPort;
    account.imapSecure = credentials.imapSecure;
    account.verifiedAt = new Date();
    account.lastError = check.imap.ok ? "" : `Sending works, but receiving (IMAP) could not be verified: ${check.imap.message}`;
    if (req.body.isDefault || !(await EmailAccount.countDocuments({}))) {
      await EmailAccount.updateMany({ _id: { $ne: account._id } }, { $set: { isDefault: false } });
      account.isDefault = true;
    }
    await account.save();
    await logActivity(req, { module: "Email accounts", action: existing ? "Mailbox updated" : "Mailbox connected", entityType: "EmailAccount", entityId: account._id, summary: `${req.user.name} ${existing ? "updated" : "connected"} the mailbox ${account.address}` });
    res.status(existing ? 200 : 201).json({ account: safeAccount(account), check });
  } catch (error) {
    if (error?.code === 11000) return res.status(409).json({ message: "This mailbox is already connected" });
    next(error);
  }
});

router.patch("/:id/default", async (req, res, next) => {
  try {
    const account = await EmailAccount.findById(req.params.id);
    if (!account) return res.status(404).json({ message: "Mailbox not found" });
    await EmailAccount.updateMany({ _id: { $ne: account._id } }, { $set: { isDefault: false } });
    account.isDefault = true;
    await account.save();
    await logActivity(req, { module: "Email accounts", action: "Default mailbox changed", entityType: "EmailAccount", entityId: account._id, summary: `${req.user.name} set ${account.address} as the default sender` });
    res.json({ account: safeAccount(account) });
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const account = await EmailAccount.findById(req.params.id);
    if (!account) return res.status(404).json({ message: "Mailbox not found" });
    await account.deleteOne();
    await logActivity(req, { module: "Email accounts", action: "Mailbox disconnected", entityType: "EmailAccount", entityId: account._id, summary: `${req.user.name} disconnected the mailbox ${account.address}` });
    res.json({ message: "Mailbox disconnected" });
  } catch (error) {
    next(error);
  }
});

export default router;
