import crypto from "node:crypto";
import express from "express";
import Organization from "../models/Organization.js";
import OrganizationInvitation from "../models/OrganizationInvitation.js";
import User from "../models/User.js";
import { allPermissions, rolePresets, safeUser } from "../config/permissions.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { logActivity } from "../services/activityLogService.js";
import { pick, requireFields, validateEmail } from "../utils.js";
import { runWithTenant } from "../tenancy/tenantContext.js";
import { assertActiveSeatAvailable, assertSeatAvailable, subscriptionUsage } from "../services/subscriptionService.js";

const router = express.Router();

function publicOrganization(organization, usage = null) {
  return {
    id: organization._id,
    name: organization.name,
    slug: organization.slug,
    legalName: organization.legalName,
    companyNumber: organization.companyNumber,
    status: organization.status,
    branding: organization.branding,
    locale: organization.locale,
    contact: organization.contact,
    communication: organization.communication,
    subscription: organization.subscription,
    features: organization.features,
    onboarding: organization.onboarding,
    dataRetentionDays: organization.dataRetentionDays,
    usage
  };
}

router.get("/public/current", (req, res) => {
  res.json({ id: req.organization._id, name: req.organization.name, slug: req.organization.slug, branding: req.organization.branding });
});

router.get("/invitations/verify/:token", async (req, res, next) => {
  try {
    const tokenHash = crypto.createHash("sha256").update(String(req.params.token)).digest("hex");
    const invitation = await OrganizationInvitation.findOne({ tokenHash, status: "Pending" });
    if (!invitation || invitation.expiresAt < new Date()) return res.status(404).json({ message: "Invitation is invalid or has expired" });
    res.json({ email: invitation.email, name: invitation.name, role: invitation.role, organization: { name: req.organization.name, slug: req.organization.slug }, expiresAt: invitation.expiresAt });
  } catch (error) {
    next(error);
  }
});

router.post("/invitations/accept/:token", async (req, res, next) => {
  try {
    requireFields(req.body, ["name", "password"]);
    if (String(req.body.password).length < 12) return res.status(400).json({ message: "Password must be at least 12 characters" });
    const tokenHash = crypto.createHash("sha256").update(String(req.params.token)).digest("hex");
    const invitation = await OrganizationInvitation.findOne({ tokenHash, status: "Pending" });
    if (!invitation || invitation.expiresAt < new Date()) return res.status(404).json({ message: "Invitation is invalid or has expired" });
    const existing = await User.findOne({ email: invitation.email });
    if (existing) return res.status(409).json({ message: "A member with this email already exists in the workspace" });
    await assertActiveSeatAvailable(req.organization);
    const user = await User.create({
      name: req.body.name,
      email: invitation.email,
      password: req.body.password,
      role: invitation.role,
      permissions: invitation.permissions,
      organization: invitation.organization
    });
    invitation.status = "Accepted";
    invitation.acceptedAt = new Date();
    await invitation.save();
    res.status(201).json({ message: "Workspace account created", user: safeUser(user) });
  } catch (error) {
    next(error);
  }
});

router.use(protect);

router.get("/current", async (req, res, next) => {
  try {
    const organization = await Organization.findById(req.organizationId || req.organization?._id);
    if (!organization) return res.status(404).json({ message: "Organisation not found" });
    res.json(publicOrganization(organization, await subscriptionUsage(organization)));
  } catch (error) {
    next(error);
  }
});

router.patch("/current", requirePermission("organization.manage"), async (req, res, next) => {
  try {
    const organization = await Organization.findById(req.organizationId || req.organization?._id);
    if (!organization) return res.status(404).json({ message: "Organisation not found" });
    const data = pick(req.body, ["name", "legalName", "companyNumber", "branding", "locale", "contact", "communication", "dataRetentionDays"]);
    organization.set(data);
    await organization.save();
    await logActivity(req, { module: "Organisation", action: "Settings updated", entityType: "Organization", entityId: organization._id, summary: `${organization.name} workspace settings updated` });
    res.json(publicOrganization(organization, await subscriptionUsage(organization)));
  } catch (error) {
    next(error);
  }
});

router.post("/onboarding/:step", requirePermission("organization.manage"), async (req, res, next) => {
  try {
    const organization = await Organization.findById(req.organizationId || req.organization?._id);
    if (!organization) return res.status(404).json({ message: "Organisation not found" });
    const step = String(req.params.step || "").replace(/[^a-z0-9_-]/gi, "").slice(0, 40);
    if (!step) return res.status(400).json({ message: "A valid onboarding step is required" });
    organization.onboarding.completedSteps = Array.from(new Set([...(organization.onboarding.completedSteps || []), step]));
    organization.onboarding.status = req.body.complete ? "Complete" : "In Progress";
    if (req.body.complete) organization.onboarding.completedAt = new Date();
    await organization.save();
    res.json(organization.onboarding);
  } catch (error) {
    next(error);
  }
});

router.get("/invitations", requirePermission("team.manage"), async (req, res, next) => {
  try {
    const invitations = await OrganizationInvitation.find().sort({ createdAt: -1 }).populate("invitedBy", "name email");
    res.json(invitations.map((invitation) => ({ id: invitation._id, email: invitation.email, name: invitation.name, role: invitation.role, status: invitation.status, expiresAt: invitation.expiresAt, invitedBy: invitation.invitedBy, createdAt: invitation.createdAt })));
  } catch (error) {
    next(error);
  }
});

router.post("/invitations", requirePermission("team.manage"), async (req, res, next) => {
  try {
    requireFields(req.body, ["email", "role"]);
    validateEmail(req.body.email);
    const email = String(req.body.email).toLowerCase();
    if (await User.exists({ email })) return res.status(409).json({ message: "This person is already a workspace member" });
    await assertSeatAvailable(req.organization, { excludeInvitationEmail: email });
    await OrganizationInvitation.updateMany({ email, status: "Pending" }, { status: "Cancelled" });
    const token = crypto.randomBytes(32).toString("hex");
    const permissions = Array.isArray(req.body.permissions)
      ? Array.from(new Set(req.body.permissions.filter((permission) => allPermissions.includes(permission))))
      : (rolePresets[req.body.role] || []);
    const invitation = await OrganizationInvitation.create({
      email,
      name: String(req.body.name || "").trim(),
      role: req.body.role,
      permissions,
      tokenHash: crypto.createHash("sha256").update(token).digest("hex"),
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      invitedBy: req.user._id,
      invitedByName: req.user.name
    });
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const invitationUrl = `${clientUrl}/accept-invitation?workspace=${encodeURIComponent(req.organization.slug)}&token=${token}`;
    await logActivity(req, { module: "Team", action: "Invitation created", entityType: "OrganizationInvitation", entityId: invitation._id, summary: `Invited ${email} as ${invitation.role}` });
    res.status(201).json({ id: invitation._id, email, status: invitation.status, expiresAt: invitation.expiresAt, invitationUrl });
  } catch (error) {
    next(error);
  }
});

router.delete("/invitations/:id", requirePermission("team.manage"), async (req, res, next) => {
  try {
    const invitation = await OrganizationInvitation.findById(req.params.id);
    if (!invitation) return res.status(404).json({ message: "Invitation not found" });
    invitation.status = "Cancelled";
    await invitation.save();
    res.json({ message: "Invitation cancelled" });
  } catch (error) {
    next(error);
  }
});

router.post("/", requirePermission("organization.manage"), async (req, res, next) => {
  try {
    if (req.user.role !== "super_admin") return res.status(403).json({ message: "Only a platform owner can create workspaces" });
    requireFields(req.body, ["name", "slug"]);
    const organization = await Organization.create({ ...pick(req.body, ["name", "slug", "legalName", "companyNumber", "branding", "locale", "contact", "subscription", "features", "dataRetentionDays"]), createdBy: req.user._id });
    await runWithTenant({ organizationId: String(organization._id), organizationSlug: organization.slug }, async () => {});
    res.status(201).json(publicOrganization(organization));
  } catch (error) {
    next(error);
  }
});

export default router;
