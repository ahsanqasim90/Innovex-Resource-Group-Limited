import crypto from "node:crypto";
import express from "express";
import Candidate from "../models/Candidate.js";
import ClientAccount from "../models/ClientAccount.js";
import PortalAccount from "../models/PortalAccount.js";
import PortalSession from "../models/PortalSession.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { sendSystemEmail } from "../services/emailService.js";
import { logActivity } from "../services/activityLogService.js";
import { tokenHash } from "../utils/authSecurity.js";
import { requireFields, validateEmail } from "../utils.js";

const router = express.Router();
router.use(protect, requirePermission("portals.manage"));

router.get("/", async (req, res, next) => {
  try {
    const [accounts, candidates, clients] = await Promise.all([PortalAccount.find().populate("candidate", "name email desiredRole").populate("clientAccount", "name primaryContact").sort({ createdAt: -1 }).lean(), Candidate.find({ email: { $exists: true, $ne: "" } }).select("name email desiredRole").sort({ name: 1 }).limit(500).lean(), ClientAccount.find().select("name primaryContact contacts").sort({ name: 1 }).limit(500).lean()]);
    res.json({ accounts: accounts.map(({ invitationTokenHash, password, ...account }) => account), candidates, clients });
  } catch (error) { next(error); }
});

router.post("/invite", async (req, res, next) => {
  try {
    requireFields(req.body, ["type", "subjectId", "email"]); validateEmail(req.body.email);
    const type = req.body.type === "Client" ? "Client" : "Candidate";
    const subject = type === "Client" ? await ClientAccount.findById(req.body.subjectId) : await Candidate.findById(req.body.subjectId);
    if (!subject) return res.status(404).json({ message: `${type} record not found` });
    const token = crypto.randomBytes(32).toString("hex");
    let account = await PortalAccount.findOne({ type, email: String(req.body.email).toLowerCase() }).select("+invitationTokenHash");
    if (!account) account = new PortalAccount({ type, name: req.body.name || subject.name, email: req.body.email, candidate: type === "Candidate" ? subject._id : undefined, clientAccount: type === "Client" ? subject._id : undefined });
    account.name = req.body.name || account.name; account.status = "Invited"; account.invitationTokenHash = tokenHash(token); account.invitationExpiresAt = new Date(Date.now() + 7 * 86400000); account.invitedBy = req.user._id; account.sessionVersion += 1;
    await account.save(); await PortalSession.updateMany({ account: account._id, revokedAt: null }, { revokedAt: new Date() });
    const url = `${process.env.CLIENT_URL || "http://localhost:5173"}/portal/activate?workspace=${encodeURIComponent(req.organization.slug)}&token=${token}`;
    const delivery = await sendSystemEmail({ to: account.email, subject: `Your ${req.organization.name} ${type.toLowerCase()} portal`, text: `Activate your secure portal within 7 days: ${url}`, html: `<p>Hello ${account.name},</p><p>You have been invited to a secure ${type.toLowerCase()} portal.</p><p><a href="${url}">Activate secure portal</a></p><p>This link expires in 7 days.</p>` }).then(() => "Sent").catch(() => "Link created");
    await logActivity(req, { module: "Portals", action: "Portal invitation created", entityType: "PortalAccount", entityId: account._id, summary: `${type} portal invitation created for ${account.email}` });
    res.status(201).json({ message: delivery === "Sent" ? "Secure invitation emailed" : "Invitation created; copy the secure link", invitationUrl: url, delivery, account: { id: account._id, type, email: account.email, status: account.status, invitationExpiresAt: account.invitationExpiresAt } });
  } catch (error) { next(error); }
});

router.patch("/:id/status", async (req, res, next) => {
  try {
    const account = await PortalAccount.findById(req.params.id);
    if (!account) return res.status(404).json({ message: "Portal account not found" });
    account.status = req.body.status === "Active" ? "Active" : "Suspended"; account.sessionVersion += 1; await account.save();
    await PortalSession.updateMany({ account: account._id, revokedAt: null }, { revokedAt: new Date() });
    res.json({ message: `Portal account ${account.status.toLowerCase()}` });
  } catch (error) { next(error); }
});

export default router;
