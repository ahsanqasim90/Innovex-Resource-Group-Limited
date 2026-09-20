import assert from "node:assert/strict";
import test from "node:test";
import { buildDashboard } from "../src/services/dashboardService.js";
import { validateTaskInput } from "../src/utils/workspaceTasks.js";

function fakeModels() {
  const calls = [];
  const models = new Proxy({}, { get: (_, name) => ({
    countDocuments(filter) { calls.push({ name, kind: "count", filter }); return Promise.resolve(3); },
    aggregate(pipeline) { calls.push({ name, kind: "aggregate", pipeline }); return Promise.resolve([{ invoiced: 3000, received: 1000, outstanding: 2000 }]); },
    find(filter) {
      const call = { name, kind: "find", filter }; calls.push(call);
      const query = { select(fields) { call.fields = fields; return query; }, sort(sort) { call.sort = sort; return query; }, limit(limit) { call.limit = limit; return query; }, lean() { return Promise.resolve([]); } };
      return query;
    }
  }) });
  return { models, calls };
}
const now = new Date("2026-09-09T12:00:00.000Z");
test("dashboard-only users cannot read counts, financials or records from other modules", async () => {
  const { models, calls } = fakeModels();
  const result = await buildDashboard({ role: "viewer", permissions: ["dashboard.view"] }, models, now);
  assert.deepEqual(calls, []);
  assert.deepEqual(result, { stats: {}, attention: [], agenda: [], updatedAt: now.toISOString() });
});
test("sales dashboard executes only permitted queries and omits finance and candidate records", async () => {
  const { models, calls } = fakeModels();
  const result = await buildDashboard({ role: "sales", permissions: ["dashboard.view", "businessLeads.view", "calls.view", "meetings.view"] }, models, now);
  assert.ok(calls.length);
  assert.ok(calls.every((call) => ["BusinessLead", "CallLog", "Meeting"].includes(call.name)));
  assert.equal(result.stats.followUpsDue, 3);
  assert.equal(result.stats.outstanding, undefined);
  assert.equal(result.recentApplications, undefined);
  const followUp = calls.find((call) => call.filter?.followUpAt);
  assert.deepEqual(followUp.filter.followUpAt, { $lte: now });
});
test("recruitment dashboard uses explicit record projections and includes overdue interviews", async () => {
  const { models, calls } = fakeModels();
  const result = await buildDashboard({ role: "employee", permissions: ["interviews.view", "applications.view"] }, models, now);
  assert.equal(result.stats.interviewsToClose, 3);
  assert.ok(calls.filter((x) => x.kind === "find").every((x) => x.fields && !/visaStatus|revenue|notes|phone|file/i.test(x.fields)));
  assert.ok(result.attention.some((x) => x.id === "interviewsToClose" && x.href === "/admin/interviews"));
});
test("owner finance excludes draft and cancelled invoices and uses outstanding balances", async () => {
  const { models, calls } = fakeModels();
  const result = await buildDashboard({ role: "admin" }, models, now);
  assert.equal(result.stats.outstanding, 2000);
  const finance = calls.find((x) => x.name === "Invoice" && x.kind === "aggregate");
  assert.deepEqual(finance.pipeline[0], { $match: { status: { $nin: ["Draft", "Cancelled"] } } });
  const overdue = calls.find((x) => x.name === "Invoice" && x.kind === "count");
  assert.deepEqual(overdue.filter.balanceDue, { $gt: 0 });
  assert.ok(overdue.filter.status.$nin.includes("Paid"));
});
test("dashboard query failures are surfaced rather than producing false zero counts", async () => {
  await assert.rejects(() => buildDashboard({ role: "viewer", permissions: ["jobs.view"] }, { Job: { countDocuments: () => Promise.reject(new Error("Unavailable")) } }, now), /Unavailable/);
});
test("task validation rejects empty titles, invalid dates, priorities and foreign-looking identifiers", () => {
  for (const body of [{ title: " " }, { title: "x".repeat(181) }, { title: "Task", dueAt: "tomorrow" }, { title: "Task", priority: "Critical" }, { title: "Task", assignedTo: "not-an-id" }, { title: "Task", description: {} }]) {
    assert.throws(() => validateTaskInput(body), (error) => error.statusCode === 400);
  }
  const task = validateTaskInput({ title: "  Follow up  ", description: " Details ", assignedTo: "507f1f77bcf86cd799439011", dueAt: "2026-09-10T09:00:00Z", status: "Completed", rule: "ignored" });
  assert.equal(task.title, "Follow up");
  assert.equal(task.priority, "Normal");
  assert.equal(task.description, "Details");
  assert.equal(task.status, undefined);
  assert.equal(task.rule, undefined);
  assert.equal(task.dueAt.toISOString(), "2026-09-10T09:00:00.000Z");
});
