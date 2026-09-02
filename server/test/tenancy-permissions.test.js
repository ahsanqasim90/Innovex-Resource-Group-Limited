import assert from "node:assert/strict";
import test from "node:test";
import { allPermissions, hasPermission } from "../src/config/permissions.js";
import { currentOrganizationId, runWithTenant, runWithoutTenant, setDefaultOrganizationId } from "../src/tenancy/tenantContext.js";

test("tenant context stays isolated across concurrent work", async () => {
  setDefaultOrganizationId("default-org");
  const [first, second] = await Promise.all([
    runWithTenant({ organizationId: "org-a" }, async () => { await Promise.resolve(); return currentOrganizationId(); }),
    runWithTenant({ organizationId: "org-b" }, async () => { await Promise.resolve(); return currentOrganizationId(); })
  ]);
  assert.deepEqual([first, second], ["org-a", "org-b"]);
  assert.equal(currentOrganizationId(), "default-org");
  await runWithoutTenant(async () => assert.equal(currentOrganizationId(), "default-org"));
});

test("granular permissions enforce actions while manage implies module access", () => {
  const recruiter = { role: "recruitment", permissions: ["jobs.view", "jobs.edit"] };
  assert.equal(hasPermission(recruiter, "jobs.view"), true);
  assert.equal(hasPermission(recruiter, "jobs.edit"), true);
  assert.equal(hasPermission(recruiter, "jobs.delete"), false);
  assert.equal(hasPermission({ role: "sales", permissions: ["clients.manage"] }, "clients.view"), true);
  assert.equal(hasPermission({ role: "admin", permissions: [] }, "organization.manage"), true);
  assert.equal(new Set(allPermissions).size, allPermissions.length);
});
