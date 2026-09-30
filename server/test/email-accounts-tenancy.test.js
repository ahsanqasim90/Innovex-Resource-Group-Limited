import assert from "node:assert/strict";
import test from "node:test";
import { setDefaultOrganizationId, runWithTenant } from "../src/tenancy/tenantContext.js";
import { configuredEmailAccounts } from "../src/config/emailAccounts.js";

process.env.SMTP_HOST = "smtp.hostinger.com";
process.env.SMTP_USER = "info@innovexresourcegroup.co.uk";
process.env.SMTP_PASS = "secret";
process.env.SMTP_INFO_ADDRESS = "info@innovexresourcegroup.co.uk";

setDefaultOrganizationId("default-org-id");

test("a non-default organisation never sees Innovex's own env-configured mailboxes", () => {
  runWithTenant({ organizationId: "other-org-id", emailAccounts: [] }, () => {
    const accounts = configuredEmailAccounts();
    assert.equal(accounts.length, 0, "a brand-new tenant with no connected mailbox should see none, not Innovex's");
  });
});

test("a non-default organisation sees only its own connected mailbox", () => {
  const ownAccount = { key: "hello@theiragency.com", address: "hello@theiragency.com", host: "smtp.theiragency.com" };
  runWithTenant({ organizationId: "other-org-id", emailAccounts: [ownAccount] }, () => {
    const accounts = configuredEmailAccounts();
    assert.equal(accounts.length, 1);
    assert.equal(accounts[0].address, "hello@theiragency.com");
  });
});

test("the default organisation (Innovex) still gets the legacy env mailboxes", () => {
  runWithTenant({ organizationId: "default-org-id", emailAccounts: [] }, () => {
    const accounts = configuredEmailAccounts();
    assert.ok(accounts.some((account) => account.address === "info@innovexresourcegroup.co.uk"), "legacy env mailbox should still work for the default org");
  });
});

test("a DB-connected mailbox overrides an env one at the same address", () => {
  const override = { key: "info@innovexresourcegroup.co.uk", address: "info@innovexresourcegroup.co.uk", host: "smtp.newprovider.com", label: "Updated via settings UI" };
  runWithTenant({ organizationId: "default-org-id", emailAccounts: [override] }, () => {
    const accounts = configuredEmailAccounts();
    const match = accounts.find((account) => account.address === "info@innovexresourcegroup.co.uk");
    assert.equal(match.host, "smtp.newprovider.com");
  });
});
