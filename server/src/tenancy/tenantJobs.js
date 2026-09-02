import Organization from "../models/Organization.js";
import { runWithTenant } from "./tenantContext.js";

export async function forEachActiveOrganization(callback) {
  const organizations = await Organization.find({ status: { $in: ["Trial", "Active"] } }).lean();
  const results = [];
  for (const organization of organizations) {
    results.push(await runWithTenant({ organizationId: String(organization._id), organizationSlug: organization.slug }, () => callback(organization)));
  }
  return results;
}

