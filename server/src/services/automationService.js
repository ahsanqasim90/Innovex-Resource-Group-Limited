import AutomationRule from "../models/AutomationRule.js";
import AutomationRun from "../models/AutomationRun.js";
import AutomationTask from "../models/AutomationTask.js";
import PortalNotification from "../models/PortalNotification.js";
import User from "../models/User.js";
import { queueWebhook } from "./webhookService.js";

function readField(record, path = "") {
  return String(path).split(".").filter(Boolean).reduce((value, key) => value?.[key], record);
}

function normal(value) { return String(value ?? "").trim().toLowerCase(); }

export function conditionsMatch(conditions = [], record = {}, changes = {}) {
  return conditions.every((condition) => {
    const actual = readField(record, condition.field);
    const expected = condition.value;
    if (condition.operator === "exists") return actual !== undefined && actual !== null && actual !== "";
    if (condition.operator === "contains") return normal(actual).includes(normal(expected));
    if (condition.operator === "not_equals") return normal(actual) !== normal(expected);
    if (condition.operator === "changes_to") return normal(changes?.[condition.field]?.to ?? actual) === normal(expected) && normal(changes?.[condition.field]?.from) !== normal(expected);
    return normal(actual) === normal(expected);
  });
}

function renderTemplate(template, record) {
  return String(template || "").replace(/{{\s*([\w.]+)\s*}}/g, (_, field) => String(readField(record, field) ?? ""));
}

function safeWebhookRecord(entityType, record = {}) {
  const fields = {
    Candidate: ["_id", "name", "email", "phone", "postcode", "city", "desiredRole", "status", "source", "tags", "assignedRecruiter", "createdAt", "updatedAt"],
    Job: ["_id", "reference", "title", "location", "salary", "type", "shift", "priority", "openings", "vacancyStatus", "publicationStatus", "closingDate", "createdAt", "updatedAt"],
    Application: ["_id", "job", "name", "email", "phone", "status", "attribution", "privacyAcknowledgedAt", "createdAt", "updatedAt"],
    ClientAccount: ["_id", "name", "tradingName", "accountType", "status", "industry", "companyNumber", "website", "email", "phone", "owner", "tags", "createdAt", "updatedAt"],
    Compliance: ["_id", "name", "candidateId", "expiresAt", "status"]
  }[entityType] || ["_id", "name", "status", "createdAt", "updatedAt"];
  return Object.fromEntries(fields.filter((field) => record[field] !== undefined).map((field) => [field === "_id" ? "id" : field, record[field]]));
}

async function recipientsFor(action, actor) {
  if (action.targetUser) return [action.targetUser];
  if (action.targetRole) return (await User.find({ role: action.targetRole, isActive: true }).select("_id").lean()).map((user) => user._id);
  return actor?._id ? [actor._id] : [];
}

export async function runAutomations({ entityType, event, record, actor, changes = {} }) {
  const webhookEntity = entityType === "Compliance" ? "compliance" : String(entityType || "").toLowerCase();
  queueWebhook(`${webhookEntity}.${event}`, { entityType, record: safeWebhookRecord(entityType, record), changes }).catch(() => null);
  const rules = await AutomationRule.find({ enabled: true, "trigger.entity": entityType, "trigger.event": event });
  for (const rule of rules) {
    const startedAt = Date.now();
    if (event === "document_expiring") {
      const recentlyRun = await AutomationRun.exists({ rule: rule._id, entityId: record._id, status: "Succeeded", createdAt: { $gte: new Date(Date.now() - 20 * 60 * 60 * 1000) } });
      if (recentlyRun) continue;
    }
    const matched = conditionsMatch(rule.conditions, record, changes);
    let actionsCreated = 0;
    let status = matched ? "Succeeded" : "Skipped";
    let message = matched ? "Rule completed" : "Conditions did not match";
    try {
      if (matched) for (const action of rule.actions) {
        const recipients = await recipientsFor(action, actor);
        const title = renderTemplate(action.title, record);
        const body = renderTemplate(action.message, record);
        if (["Create task", "SLA reminder"].includes(action.type)) {
          const assignedTo = recipients[0];
          const existingTask = await AutomationTask.exists({ rule: rule._id, entityId: record._id, status: "Open" });
          if (!existingTask) {
            await AutomationTask.create({ title, description: body, priority: action.priority, dueAt: new Date(Date.now() + Number(action.dueMinutes || 0) * 60000), assignedTo, rule: rule._id, entityType, entityId: record._id, entityLabel: record.name || record.title || record.reference || "Record" });
            actionsCreated += 1;
          }
        }
        if (["In-app notification", "SLA reminder"].includes(action.type) && recipients.length) {
          await PortalNotification.insertMany(recipients.map((user) => ({ user, type: "automation", title, message: body || `Automation: ${rule.name}`, link: "/admin/automations", entityType, entityId: record._id, actor: actor ? { user: actor._id, name: actor.name } : undefined })));
          actionsCreated += recipients.length;
        }
      }
    } catch (error) {
      status = "Failed";
      message = error.message;
    }
    await AutomationRun.create({ rule: rule._id, ruleName: rule.name, trigger: rule.trigger, entityType, entityId: record._id, matched, status, actionsCreated, message, durationMs: Date.now() - startedAt });
    rule.metrics.runs += 1;
    rule.metrics[status === "Failed" ? "failed" : "succeeded"] += status === "Skipped" ? 0 : 1;
    rule.metrics.lastRunAt = new Date();
    await rule.save();
  }
  return rules.length;
}
