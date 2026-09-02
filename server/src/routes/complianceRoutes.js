import express from "express";
import Candidate from "../models/Candidate.js";
import CompliancePassport, { REQUIRED_COMPLIANCE_TYPES } from "../models/CompliancePassport.js";
import User from "../models/User.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { uploadComplianceDocument } from "../middleware/upload.js";
import { secureComplianceDocumentMeta } from "../services/complianceDocumentService.js";
import { assertDocumentReleased, scanRecruitmentDocument } from "../services/malwareScanService.js";
import { runAutomations } from "../services/automationService.js";
import { logActivity } from "../services/activityLogService.js";

const router = express.Router();
router.use(protect, requirePermission("compliance.view"));
const actor = (user) => ({ user: user._id, name: user.name, email: user.email });
const escaped = (value = "") => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function requiredTypesFor(candidate) {
  const nursingRole = /\b(nurse|nursing|rgn|rmn|rnld|nmc)\b/i.test(String(candidate?.desiredRole || ""));
  return REQUIRED_COMPLIANCE_TYPES.filter((type) => type !== "NMC Registration" || nursingRole);
}

function ensureRequired(passport, candidate) {
  const requiredTypes = requiredTypesFor(candidate);
  for (const type of REQUIRED_COMPLIANCE_TYPES) {
    let check = passport.checks.find((item) => item.type === type);
    if (!check) { passport.checks.push({ type, status: "Missing", required: requiredTypes.includes(type) }); check = passport.checks.at(-1); }
    check.required = requiredTypes.includes(type);
  }
  return passport;
}

function passportSummary(candidate, passport) {
  const checks = passport?.checks || [];
  const requiredTypes = requiredTypesFor(candidate);
  const requiredVerified = requiredTypes.filter((type) => checks.some((check) => check.type === type && check.status === "Verified")).length;
  const expiring = checks.filter((check) => check.expiresAt && new Date(check.expiresAt) >= new Date() && new Date(check.expiresAt) <= new Date(Date.now() + 30 * 86400000)).length;
  const expired = checks.filter((check) => check.status === "Expired" || (check.expiresAt && new Date(check.expiresAt) < new Date())).length;
  const overallStatus = requiredVerified === requiredTypes.length ? "Green" : requiredVerified > 0 ? "Amber" : "Red";
  return { candidate: { _id: candidate._id, name: candidate.name, email: candidate.email, phone: candidate.phone, desiredRole: candidate.desiredRole, status: candidate.status }, passportId: passport?._id, overallStatus, requiredVerified, requiredTotal: requiredTypes.length, expiring, expired, consentCapturedAt: passport?.consentCapturedAt, updatedAt: passport?.updatedAt || candidate.updatedAt };
}

router.get("/overview", async (req, res, next) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(10, Number(req.query.limit || 40)));
    const candidateFilter = {};
    if (req.query.search) { const search = new RegExp(escaped(req.query.search), "i"); candidateFilter.$or = [{ name: search }, { email: search }, { desiredRole: search }]; }
    const [candidates, total, team, statusCounts, expiringDocuments] = await Promise.all([
      Candidate.find(candidateFilter).select("name email phone desiredRole status updatedAt").sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Candidate.countDocuments(candidateFilter),
      User.find({ isActive: true }).select("name email role").sort({ name: 1 }).lean(),
      CompliancePassport.aggregate([{ $group: { _id: "$overallStatus", count: { $sum: 1 } } }]),
      CompliancePassport.countDocuments({ checks: { $elemMatch: { expiresAt: { $gte: new Date(), $lte: new Date(Date.now() + 30 * 86400000) }, status: "Verified" } } })
    ]);
    const passports = await CompliancePassport.find({ candidate: { $in: candidates.map((item) => item._id) } }).lean();
    const passportByCandidate = new Map(passports.map((item) => [String(item.candidate), item]));
    const items = candidates.map((candidate) => passportSummary(candidate, passportByCandidate.get(String(candidate._id))));
    const counts = Object.fromEntries(statusCounts.map((item) => [item._id, item.count]));
    res.json({ items, team, total, page, pages: Math.max(1, Math.ceil(total / limit)), metrics: { green: counts.Green || 0, amber: counts.Amber || 0, red: Math.max(counts.Red || 0, total - (counts.Green || 0) - (counts.Amber || 0)), expiringDocuments } });
  } catch (error) { next(error); }
});

router.get("/:candidateId", async (req, res, next) => {
  try {
    const candidate = await Candidate.findById(req.params.candidateId).select("name email phone desiredRole status lawfulBasis").lean();
    if (!candidate) return res.status(404).json({ message: "Candidate not found" });
    let passport = await CompliancePassport.findOne({ candidate: candidate._id }).populate("assignedTo", "name email role");
    if (!passport) passport = await CompliancePassport.create({ candidate: candidate._id, checks: REQUIRED_COMPLIANCE_TYPES.map((type) => ({ type, status: "Missing", required: requiredTypesFor(candidate).includes(type) })), history: [{ action: "Passport created", actor: actor(req.user) }] });
    ensureRequired(passport, candidate);
    await passport.save();
    res.json({ candidate, passport });
  } catch (error) { next(error); }
});

router.patch("/:candidateId", requirePermission("compliance.manage"), async (req, res, next) => {
  try {
    let passport = await CompliancePassport.findOne({ candidate: req.params.candidateId });
    if (!passport) { const candidate = await Candidate.findById(req.params.candidateId).select("desiredRole").lean(); passport = new CompliancePassport({ candidate: req.params.candidateId, checks: REQUIRED_COMPLIANCE_TYPES.map((type) => ({ type, status: "Missing", required: requiredTypesFor(candidate).includes(type) })) }); }
    if (req.body.captureConsent) { passport.consentCapturedAt = new Date(); passport.consentMethod = String(req.body.consentMethod || "Recorded by recruiter"); passport.consentCapturedBy = actor(req.user); passport.history.push({ action: "Consent captured", note: passport.consentMethod, actor: actor(req.user) }); }
    if (req.body.assignedTo !== undefined) passport.assignedTo = req.body.assignedTo || undefined;
    if (req.body.riskNotes !== undefined) passport.riskNotes = String(req.body.riskNotes || "");
    passport.lastReviewedAt = new Date();
    await passport.save();
    res.json(passport);
  } catch (error) { next(error); }
});

router.post("/:candidateId/checks", requirePermission("compliance.manage"), async (req, res, next) => {
  try {
    let passport = await CompliancePassport.findOne({ candidate: req.params.candidateId });
    if (!passport) { const candidate = await Candidate.findById(req.params.candidateId).select("desiredRole").lean(); passport = new CompliancePassport({ candidate: req.params.candidateId, checks: REQUIRED_COMPLIANCE_TYPES.map((type) => ({ type, status: "Missing", required: requiredTypesFor(candidate).includes(type) })) }); }
    let check = req.body.checkId ? passport.checks.id(req.body.checkId) : passport.checks.find((item) => item.type === req.body.type);
    if (!check) { passport.checks.push({ type: req.body.type || "Other" }); check = passport.checks.at(-1); }
    ["type", "label", "reference", "issuer", "notes"].forEach((field) => { if (req.body[field] !== undefined) check[field] = req.body[field]; });
    ["issuedAt", "expiresAt"].forEach((field) => { if (req.body[field] !== undefined) check[field] = req.body[field] || undefined; });
    if (req.body.status && ["Missing", "Pending review", "Verified", "Rejected", "Expired"].includes(req.body.status)) check.status = req.body.status;
    passport.history.push({ action: "Check updated", note: `${check.type}: ${check.status}`, actor: actor(req.user) });
    await passport.save();
    const withinThirtyDays = check.expiresAt && check.expiresAt <= new Date(Date.now() + 30 * 86400000);
    if (withinThirtyDays) await runAutomations({ entityType: "Compliance", event: "document_expiring", record: { _id: check._id, name: check.type, candidateId: req.params.candidateId, expiresAt: check.expiresAt }, actor: req.user }).catch(() => null);
    res.json(passport);
  } catch (error) { next(error); }
});

router.post("/:candidateId/checks/:checkId/document", requirePermission("compliance.manage"), uploadComplianceDocument.single("document"), async (req, res, next) => {
  try {
    const passport = await CompliancePassport.findOne({ candidate: req.params.candidateId }).select("+checks.file.data");
    const check = passport?.checks.id(req.params.checkId);
    if (!check) return res.status(404).json({ message: "Compliance check not found" });
    check.file = await secureComplianceDocumentMeta(req.file, req.user);
    check.status = "Pending review";
    passport.history.push({ action: "Evidence uploaded", note: `${check.type}: ${check.file.scanStatus}`, actor: actor(req.user) });
    await passport.save();
    await logActivity(req, { module: "Compliance", action: "Evidence uploaded", entityType: "CompliancePassport", entityId: passport._id, summary: `${check.type} evidence uploaded for security review` });
    res.json({ message: check.file.scanStatus === "Clean" ? "Evidence uploaded and antivirus cleared; verification is required" : "Evidence quarantined until antivirus scanning is available", passport });
  } catch (error) { next(error); }
});

router.patch("/:candidateId/checks/:checkId/verify", requirePermission("compliance.manage"), async (req, res, next) => {
  try {
    const passport = await CompliancePassport.findOne({ candidate: req.params.candidateId }).select("+checks.file.data");
    const check = passport?.checks.id(req.params.checkId);
    if (!check) return res.status(404).json({ message: "Compliance check not found" });
    if (req.body.status === "Verified" && check.file?.data) assertDocumentReleased(check.file);
    check.status = req.body.status === "Rejected" ? "Rejected" : "Verified";
    check.verifiedAt = check.status === "Verified" ? new Date() : undefined;
    check.verifiedBy = check.status === "Verified" ? actor(req.user) : undefined;
    check.rejectionReason = check.status === "Rejected" ? String(req.body.reason || "Evidence did not meet verification requirements") : "";
    passport.lastReviewedAt = new Date();
    passport.history.push({ action: `Check ${check.status.toLowerCase()}`, note: `${check.type}${check.rejectionReason ? `: ${check.rejectionReason}` : ""}`, actor: actor(req.user) });
    await passport.save();
    await logActivity(req, { module: "Compliance", action: `Check ${check.status.toLowerCase()}`, entityType: "CompliancePassport", entityId: passport._id, summary: `${check.type} marked ${check.status.toLowerCase()}` });
    res.json(passport);
  } catch (error) { next(error); }
});

router.post("/:candidateId/checks/:checkId/security-scan", requirePermission("compliance.manage"), async (req, res, next) => {
  try {
    const passport = await CompliancePassport.findOne({ candidate: req.params.candidateId }).select("+checks.file.data");
    const check = passport?.checks.id(req.params.checkId);
    if (!check?.file?.data) return res.status(404).json({ message: "Compliance evidence not found" });
    const result = await scanRecruitmentDocument(check.file.data);
    check.file.scanStatus = result.status; check.file.scanEngine = result.engine; check.file.scannedAt = result.status === "Clean" ? new Date() : undefined; check.file.quarantineReason = result.reason;
    await passport.save();
    res.status(result.status === "Clean" ? 200 : 423).json({ message: result.status === "Clean" ? "Evidence passed antivirus scanning" : result.reason, scanStatus: result.status });
  } catch (error) { next(error); }
});

router.get("/:candidateId/checks/:checkId/document", async (req, res, next) => {
  try {
    const passport = await CompliancePassport.findOne({ candidate: req.params.candidateId }).select("+checks.file.data");
    const check = passport?.checks.id(req.params.checkId);
    if (!check?.file?.data) return res.status(404).json({ message: "Compliance evidence not found" });
    assertDocumentReleased(check.file);
    await logActivity(req, { module: "Compliance", action: "Evidence viewed", entityType: "CompliancePassport", entityId: passport._id, summary: `${req.user.name} opened ${check.type} evidence` });
    res.set({ "Content-Type": check.file.mimetype, "Content-Disposition": `inline; filename="${String(check.file.originalName).replace(/[\r\n"]/g, "-")}"`, "Cache-Control": "private, no-store, max-age=0", "X-Content-Type-Options": "nosniff" });
    res.send(check.file.data);
  } catch (error) { next(error); }
});

export default router;
