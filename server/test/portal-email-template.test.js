import assert from "node:assert/strict";
import test from "node:test";
import { portalInvitationEmail } from "../src/services/portalEmailTemplates.js";

test("partner portal invitations are branded, useful and safely escaped", () => {
  const email = portalInvitationEmail({
    accountName: "Talent & Found <Team>",
    organizationName: "Innovex Resource Group Limited",
    type: "Partner",
    activationUrl: "https://example.com/portal/activate?token=abc&workspace=innovex"
  });

  assert.match(email.subject, /Recruitment Partner Portal invitation/);
  assert.match(email.text, /Submit candidate details and CVs securely/);
  assert.match(email.html, /Track review decisions, progress and feedback/);
  assert.match(email.html, /Talent &amp; Found &lt;Team&gt;/);
  assert.match(email.html, /token=abc&amp;workspace=innovex/);
  assert.doesNotMatch(email.html, /Talent & Found <Team>/);
});
