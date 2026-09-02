import assert from "node:assert/strict";
import test from "node:test";
import { conditionsMatch } from "../src/services/automationService.js";
import { workspaceAccessState } from "../src/services/subscriptionService.js";
import { validateWebhookUrl } from "../src/services/webhookService.js";

test("workflow conditions handle nested values and real state transitions", () => {
  const record = { status: "Placed", profile: { source: "Referral Partner" } };
  assert.equal(conditionsMatch([{ field: "profile.source", operator: "contains", value: "referral" }], record), true);
  assert.equal(conditionsMatch([{ field: "status", operator: "changes_to", value: "Placed" }], record, { status: { from: "Submitted", to: "Placed" } }), true);
  assert.equal(conditionsMatch([{ field: "status", operator: "changes_to", value: "Placed" }], record, { status: { from: "Placed", to: "Placed" } }), false);
});

test("subscription access blocks suspended, past-due and expired trial workspaces", () => {
  assert.equal(workspaceAccessState({ status: "Active", subscription: { status: "Active" } }).allowed, true);
  assert.equal(workspaceAccessState({ status: "Suspended", subscription: { status: "Active" } }).statusCode, 403);
  assert.equal(workspaceAccessState({ status: "Active", subscription: { status: "Past Due" } }).statusCode, 402);
  assert.equal(workspaceAccessState({ status: "Trial", subscription: { status: "Trial", trialEndsAt: new Date("2024-01-01") } }, new Date("2024-01-02")).allowed, false);
});

test("webhooks reject local and credentialed destinations before delivery", async () => {
  await assert.rejects(() => validateWebhookUrl("https://localhost/hooks"), /Private or credentialed/);
  await assert.rejects(() => validateWebhookUrl("https://user:password@example.com/hooks"), /Private or credentialed/);
});

test("tenant-owned unique indexes include organisation in their key", async () => {
  await import("../src/tenancy/tenantPlugin.js");
  const modules = await Promise.all([
    import("../src/models/User.js"), import("../src/models/Attendance.js"), import("../src/models/Blog.js"), import("../src/models/Invoice.js"),
    import("../src/models/ClientTerms.js"), import("../src/models/Expense.js"), import("../src/models/OfferLetter.js"), import("../src/models/SalarySlip.js"),
    import("../src/models/TrainingQuotation.js"), import("../src/models/NewsletterSubscriber.js"), import("../src/models/PortalAccount.js")
  ]);
  for (const { default: Model } of modules) {
    const uniqueIndexes = Model.schema.indexes().filter(([, options]) => options.unique);
    assert.ok(uniqueIndexes.length, `${Model.modelName} should define a unique business key`);
    for (const [key] of uniqueIndexes) assert.equal(Object.hasOwn(key, "organization"), true, `${Model.modelName} unique index must be tenant-aware`);
  }
});

test("offer records retain the issued-document fingerprint and e-sign audit evidence", async () => {
  const { default: OfferLetter } = await import("../src/models/OfferLetter.js");
  const offer = new OfferLetter({
    offerNumber: "OFF-TEST-001",
    candidateName: "Test Candidate",
    candidateEmail: "candidate@example.com",
    roleTitle: "Registered Nurse",
    employmentType: "Permanent",
    issueDate: new Date("2026-09-01"),
    startDate: new Date("2026-10-01"),
    salaryType: "Annual",
    status: "Accepted",
    documentHash: "a".repeat(64),
    acceptance: {
      status: "Accepted",
      signerName: "Test Candidate",
      signerEmail: "candidate@example.com",
      declarationVersion: "offer-esign-v1",
      signedAt: new Date("2026-09-02"),
      ipHash: "b".repeat(64),
      documentHash: "a".repeat(64)
    }
  });

  assert.equal(offer.documentHash, offer.acceptance.documentHash);
  assert.equal(offer.acceptance.status, "Accepted");
  assert.equal(offer.acceptance.declarationVersion, "offer-esign-v1");
});
