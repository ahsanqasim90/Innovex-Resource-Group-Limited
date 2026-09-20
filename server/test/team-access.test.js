import assert from "node:assert/strict";
import test from "node:test";
import { displayedTeamPermissions, requiredTeamPermissions, memberForm, moduleCount, samePermissions, teamRoleLabel, isAdministrator } from "../../client/src/utils/teamAccess.js";

test("editing member access preserves the existing custom permissions and sender assignments", () => {
  const member = { role: "sales", name: "Example", email: "example@example.test", permissions: ["calls.view", "custom.future"], assignedOutboundCallerIds: ["+441234"], outboundCallerIds: ["+449999"], assignedSenderEmails: ["sales@example.test"], canCopyData: false, isActive: true };
  const form = memberForm(member, { permissions: ["dashboard.view"], password: "default" });
  assert.deepEqual(form.permissions, member.permissions);
  assert.deepEqual(form.outboundCallerIds, ["+441234"]);
  assert.equal(form.password, "");
  form.permissions.push("calls.edit");
  assert.equal(member.permissions.includes("calls.edit"), false);
});
test("role defaults are compared as sets and module counts count areas rather than actions", () => {
  assert.equal(samePermissions(["calls.view", "calls.edit"], ["calls.edit", "calls.view", "calls.edit"]), true);
  assert.equal(samePermissions(["calls.view"], ["calls.view", "calls.send"]), false);
  assert.equal(moduleCount(["calls.view", "calls.edit", "jobs.view"]), 2);
});
test("primary administrator is represented accurately without changing its role", () => {
  assert.equal(teamRoleLabel("admin"), "Primary administrator");
  assert.equal(isAdministrator("admin"), true);
  assert.equal(isAdministrator("super_admin"), true);
  assert.equal(isAdministrator("sales_manager"), false);
  assert.equal(memberForm({ role: "admin", permissions: [] }, {}).role, "admin");
});

test("access preview reflects permissions enforced by the server", () => {
  assert.deepEqual(displayedTeamPermissions({ role: "sales", permissions: ["calls.view"] }), ["attendance.view", "calls.view"]);
  assert.equal(requiredTeamPermissions("recruitment").includes("recruitmentPipeline.submit"), true);
  assert.equal(displayedTeamPermissions({ role: "viewer", permissions: ["attendance.view"] }).length, 1);
});
