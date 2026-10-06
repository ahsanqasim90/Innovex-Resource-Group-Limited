import assert from "node:assert/strict";
import test from "node:test";
import Job from "../src/models/Job.js";
import PortalAccount from "../src/models/PortalAccount.js";
import RecruitmentSubmission from "../src/models/RecruitmentSubmission.js";

test("portal accounts support recruitment partners as a separate external role", () => {
  assert.ok(PortalAccount.schema.path("type").enumValues.includes("Partner"));
  assert.equal(PortalAccount.schema.path("partner").options.ref, "Partner");
});

test("vacancies carry an explicit partner share allowlist", () => {
  const shareSchema = Job.schema.path("partnerShares").schema;
  assert.equal(shareSchema.path("partner").options.ref, "Partner");
  assert.equal(shareSchema.path("partner").isRequired, true);
});

test("partner submissions retain ownership and an explicit client-accepted outcome", () => {
  assert.equal(RecruitmentSubmission.schema.path("partner").options.ref, "Partner");
  assert.equal(RecruitmentSubmission.schema.path("portalAccount").options.ref, "PortalAccount");
  assert.ok(RecruitmentSubmission.schema.path("stage").enumValues.includes("Client accepted"));
});
