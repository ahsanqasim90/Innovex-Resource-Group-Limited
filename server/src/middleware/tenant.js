import Organization from "../models/Organization.js";
import { workspaceAccessState } from "../services/subscriptionService.js";
import { getDefaultOrganizationId, runWithTenant } from "../tenancy/tenantContext.js";

function requestedWorkspace(req) {
  const explicit = String(req.get("x-workspace-slug") || "").trim().toLowerCase();
  if (explicit) return explicit;
  const baseDomain = String(process.env.BASE_DOMAIN || "").trim().toLowerCase();
  const host = String(req.hostname || "").toLowerCase();
  if (baseDomain && host.endsWith(`.${baseDomain}`)) return host.slice(0, -(baseDomain.length + 1));
  return "";
}

export async function resolveTenant(req, res, next) {
  try {
    const slug = requestedWorkspace(req);
    let organization = null;
    if (slug) organization = await Organization.findOne({ slug });
    if (!slug && getDefaultOrganizationId()) {
      organization = await Organization.findById(getDefaultOrganizationId());
    }
    if (!organization) return res.status(503).json({ message: "Workspace is not available" });
    const access = workspaceAccessState(organization);
    if (!access.allowed) return res.status(access.statusCode).json({ message: access.message, workspaceStatus: organization.status, subscriptionStatus: organization.subscription?.status });
    req.organization = organization;
    return runWithTenant({ organizationId: String(organization._id), organizationSlug: organization.slug }, next);
  } catch (error) {
    next(error);
  }
}
