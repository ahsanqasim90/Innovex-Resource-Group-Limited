import crypto from "node:crypto";
import express from "express";
import Candidate from "../models/Candidate.js";
import ClientAccount from "../models/ClientAccount.js";
import Job from "../models/Job.js";
import Partner from "../models/Partner.js";
import PortalAccount from "../models/PortalAccount.js";
import PortalSession from "../models/PortalSession.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { sendSystemEmail } from "../services/emailService.js";
import { portalInvitationEmail } from "../services/portalEmailTemplates.js";
import { logActivity } from "../services/activityLogService.js";
import { tokenHash } from "../utils/authSecurity.js";
import { requireFields, validateEmail } from "../utils.js";

const router = express.Router();
router.use(protect, requirePermission("portals.manage"));

router.get("/", async (req, res, next) => {
  try {
    const [accounts, candidates, clients, partners, jobs] = await Promise.all([
      PortalAccount.find().populate("candidate", "name email desiredRole").populate("clientAccount", "name primaryContact").populate("partner", "name contactEmail serviceProvided").sort({ createdAt: -1 }).lean(),
      Candidate.find({ email: { $exists: true, $ne: "" } }).select("name email desiredRole").sort({ name: 1 }).limit(500).lean(),
      ClientAccount.find().select("name primaryContact contacts").sort({ name: 1 }).limit(500).lean(),
      Partner.find({ isActive: true }).select("name contactEmail serviceProvided location").sort({ name: 1 }).limit(500).lean(),
      Job.find({ isActive: true, publicationStatus: "Approved", vacancyStatus: "Open", $or: [{ closingDate: null }, { closingDate: { $exists: false } }, { closingDate: { $gte: new Date() } }] })
        .select("reference title location openings closingDate partnerShares")
        .sort({ createdAt: -1 })
        .limit(500)
        .lean()
    ]);
    res.json({ accounts: accounts.map(({ invitationTokenHash, password, ...account }) => account), candidates, clients, partners, jobs });
  } catch (error) { next(error); }
});

router.post("/invite", async (req, res, next) => {
  try {
    requireFields(req.body, ["type", "subjectId", "email"]); validateEmail(req.body.email);
    const type = ["Candidate", "Client", "Partner"].includes(req.body.type) ? req.body.type : "Candidate";
    const subject = type === "Client"
      ? await ClientAccount.findById(req.body.subjectId)
      : type === "Partner"
        ? await Partner.findById(req.body.subjectId)
        : await Candidate.findById(req.body.subjectId);
    if (!subject) return res.status(404).json({ message: `${type} record not found` });
    const token = crypto.randomBytes(32).toString("hex");
    let account = await PortalAccount.findOne({ type, email: String(req.body.email).toLowerCase() }).select("+invitationTokenHash");
    if (!account) account = new PortalAccount({ type, name: req.body.name || subject.name, email: req.body.email });
    account.candidate = type === "Candidate" ? subject._id : undefined;
    account.clientAccount = type === "Client" ? subject._id : undefined;
    account.partner = type === "Partner" ? subject._id : undefined;
    account.name = req.body.name || account.name; account.status = "Invited"; account.invitationTokenHash = tokenHash(token); account.invitationExpiresAt = new Date(Date.now() + 7 * 86400000); account.invitedBy = req.user._id; account.sessionVersion += 1;
    await account.save(); await PortalSession.updateMany({ account: account._id, revokedAt: null }, { revokedAt: new Date() });
    const url = `${process.env.CLIENT_URL || "http://localhost:5173"}/portal/activate?workspace=${encodeURIComponent(req.organization.slug)}&token=${token}`;
    const invitationEmail = portalInvitationEmail({ accountName: account.name, organizationName: req.organization.name, type, activationUrl: url });
    const delivery = await sendSystemEmail({ to: account.email, ...invitationEmail }).then(() => "Sent").catch(() => "Link created");
    await logActivity(req, { module: "Portals", action: "Portal invitation created", entityType: "PortalAccount", entityId: account._id, summary: `${type} portal invitation created for ${account.email}` });
    res.status(201).json({ message: delivery === "Sent" ? "Secure invitation emailed" : "Invitation created; copy the secure link", invitationUrl: url, delivery, account: { id: account._id, type, email: account.email, status: account.status, invitationExpiresAt: account.invitationExpiresAt } });
  } catch (error) { next(error); }
});

router.patch("/partners/:partnerId/vacancies", async (req, res, next) => {
  try {
    const partner = await Partner.findById(req.params.partnerId);
    if (!partner?.isActive) return res.status(404).json({ message: "Active partner not found" });
    const requestedIds = [...new Set((Array.isArray(req.body.jobIds) ? req.body.jobIds : []).map(String))].slice(0, 500);
    const eligibleJobs = requestedIds.length
      ? await Job.find({ _id: { $in: requestedIds }, isActive: true, publicationStatus: "Approved", vacancyStatus: "Open", $or: [{ closingDate: null }, { closingDate: { $exists: false } }, { closingDate: { $gte: new Date() } }] }).select("_id")
      : [];
    const eligibleIds = eligibleJobs.map((job) => job._id);
    await Job.updateMany({ "partnerShares.partner": partner._id }, { $pull: { partnerShares: { partner: partner._id } } });
    if (eligibleIds.length) {
      const sharedBy = { user: req.user._id, name: req.user.name, email: req.user.email };
      await Job.updateMany({ _id: { $in: eligibleIds } }, { $push: { partnerShares: { partner: partner._id, sharedAt: new Date(), sharedBy } } });
    }
    await logActivity(req, { module: "Portals", action: "Partner vacancies updated", entityType: "Partner", entityId: partner._id, summary: `${eligibleIds.length} vacancies shared with ${partner.name}` });
    res.json({ message: `${eligibleIds.length} ${eligibleIds.length === 1 ? "vacancy" : "vacancies"} shared with ${partner.name}`, sharedJobIds: eligibleIds });
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
