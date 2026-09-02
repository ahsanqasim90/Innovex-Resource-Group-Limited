import CompliancePassport from "../models/CompliancePassport.js";
import SystemEvent from "../models/SystemEvent.js";
import { runAutomations } from "./automationService.js";
import { forEachActiveOrganization } from "../tenancy/tenantJobs.js";

const dayMs = 24 * 60 * 60 * 1000;

export async function runComplianceExpiryChecks() {
  const now = new Date();
  const alertBefore = new Date(Date.now() + 30 * dayMs);
  const passports = await CompliancePassport.find({ checks: { $elemMatch: { expiresAt: { $lte: alertBefore } } } });
  let expiring = 0;
  let expired = 0;
  for (const passport of passports) {
    let changed = false;
    for (const check of passport.checks) {
      if (!check.expiresAt || check.expiresAt > alertBefore) continue;
      if (check.expiresAt < now && check.status === "Verified") { check.status = "Expired"; changed = true; expired += 1; }
      else if (check.expiresAt >= now && check.status === "Verified") expiring += 1;
      await runAutomations({ entityType: "Compliance", event: "document_expiring", record: { _id: check._id, name: check.type, candidateId: passport.candidate, expiresAt: check.expiresAt } }).catch(() => null);
    }
    if (changed) await passport.save();
  }
  return { passports: passports.length, expiring, expired };
}

export function startComplianceExpiryScheduler() {
  if (process.env.DISABLE_COMPLIANCE_EXPIRY_CHECKS === "true") return;
  const run = async () => {
    try {
      await forEachActiveOrganization(async (organization) => {
        const result = await runComplianceExpiryChecks();
        await SystemEvent.create({ type: "Queue", severity: result.expired ? "Warning" : "Info", status: result.expired ? "Open" : "Resolved", title: "Compliance expiry check completed", message: `${result.expiring} expiring and ${result.expired} expired checks in ${organization.name}`, lastSeenAt: new Date(), resolvedAt: result.expired ? undefined : new Date(), metadata: result });
      });
    } catch (error) { console.error("Compliance expiry check failed", error); }
  };
  setTimeout(() => { run(); setInterval(run, dayMs); }, 60_000);
}
