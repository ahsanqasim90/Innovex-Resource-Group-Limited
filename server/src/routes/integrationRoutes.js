import crypto from "node:crypto";
import express from "express";
import ApiCredential from "../models/ApiCredential.js";
import WebhookDelivery from "../models/WebhookDelivery.js";
import WebhookEndpoint from "../models/WebhookEndpoint.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { logActivity } from "../services/activityLogService.js";
import { deliverWebhook, validateWebhookUrl } from "../services/webhookService.js";
import { encryptSecret, tokenHash } from "../utils/authSecurity.js";
import { requireFields } from "../utils.js";

const router = express.Router();
const scopes = ["jobs:read", "candidates:read", "clients:read"];
const events = ["candidate.created", "candidate.status_changed", "job.created", "job.approved", "application.created", "compliance.document_expiring"];

router.use(protect, requirePermission("integrations.manage"));

function safeKey(key) { return { id: key._id, name: key.name, prefix: key.prefix, scopes: key.scopes, status: key.status, expiresAt: key.expiresAt, lastUsedAt: key.lastUsedAt, lastUsedIp: key.lastUsedIp, createdAt: key.createdAt }; }
function safeEndpoint(endpoint) { return { id: endpoint._id, name: endpoint.name, url: endpoint.url, events: endpoint.events, secretPrefix: endpoint.secretPrefix, status: endpoint.status, lastDeliveryAt: endpoint.lastDeliveryAt, lastSuccessAt: endpoint.lastSuccessAt, failureCount: endpoint.failureCount, createdAt: endpoint.createdAt }; }

router.get("/", async (req, res, next) => {
  try {
    const [keys, endpoints, deliveries] = await Promise.all([
      ApiCredential.find().sort({ createdAt: -1 }).lean(),
      WebhookEndpoint.find().sort({ createdAt: -1 }).lean(),
      WebhookDelivery.find().sort({ createdAt: -1 }).limit(60).populate("endpoint", "name url").lean()
    ]);
    res.json({
      keys: keys.map(safeKey), endpoints: endpoints.map(safeEndpoint), deliveries,
      options: { scopes, events },
      metrics: { activeKeys: keys.filter((key) => key.status === "Active").length, activeEndpoints: endpoints.filter((endpoint) => endpoint.status === "Active").length, delivered: deliveries.filter((delivery) => delivery.status === "Delivered").length, attention: deliveries.filter((delivery) => ["Retrying", "Failed"].includes(delivery.status)).length }
    });
  } catch (error) { next(error); }
});

router.post("/api-keys", async (req, res, next) => {
  try {
    requireFields(req.body, ["name"]);
    const selectedScopes = Array.from(new Set((Array.isArray(req.body.scopes) ? req.body.scopes : []).filter((scope) => scopes.includes(scope))));
    if (!selectedScopes.length) return res.status(400).json({ message: "Select at least one API scope" });
    const prefix = crypto.randomBytes(6).toString("base64url");
    const rawKey = `irg_live_${prefix}.${crypto.randomBytes(32).toString("base64url")}`;
    const key = await ApiCredential.create({ name: req.body.name, prefix: `irg_live_${prefix}`, keyHash: tokenHash(rawKey), scopes: selectedScopes, expiresAt: req.body.expiresAt || undefined, createdBy: req.user._id });
    await logActivity(req, { module: "Integrations", action: "API key created", entityType: "ApiCredential", entityId: key._id, summary: `Created scoped API key ${key.name}` });
    res.status(201).json({ ...safeKey(key), apiKey: rawKey, warning: "Copy this key now. It cannot be shown again." });
  } catch (error) { next(error); }
});

router.delete("/api-keys/:id", async (req, res, next) => {
  try {
    const key = await ApiCredential.findById(req.params.id);
    if (!key) return res.status(404).json({ message: "API key not found" });
    key.status = "Revoked"; key.revokedAt = new Date(); key.revokedBy = req.user._id; await key.save();
    await logActivity(req, { module: "Integrations", action: "API key revoked", entityType: "ApiCredential", entityId: key._id, summary: `Revoked API key ${key.name}` });
    res.json({ message: "API key revoked" });
  } catch (error) { next(error); }
});

router.post("/webhooks", async (req, res, next) => {
  try {
    requireFields(req.body, ["name", "url"]);
    const selectedEvents = Array.from(new Set((Array.isArray(req.body.events) ? req.body.events : []).filter((event) => events.includes(event))));
    if (!selectedEvents.length) return res.status(400).json({ message: "Select at least one webhook event" });
    const url = await validateWebhookUrl(req.body.url);
    const secret = `whsec_${crypto.randomBytes(32).toString("base64url")}`;
    const endpoint = await WebhookEndpoint.create({ name: req.body.name, url, events: selectedEvents, secretEncrypted: encryptSecret(secret), secretPrefix: `${secret.slice(0, 12)}…`, createdBy: req.user._id });
    await logActivity(req, { module: "Integrations", action: "Webhook created", entityType: "WebhookEndpoint", entityId: endpoint._id, summary: `Created webhook ${endpoint.name}` });
    res.status(201).json({ ...safeEndpoint(endpoint), signingSecret: secret, warning: "Copy this signing secret now. It cannot be shown again." });
  } catch (error) { next(error); }
});

router.patch("/webhooks/:id", async (req, res, next) => {
  try {
    const endpoint = await WebhookEndpoint.findById(req.params.id);
    if (!endpoint) return res.status(404).json({ message: "Webhook endpoint not found" });
    if (req.body.status && ["Active", "Paused", "Revoked"].includes(req.body.status)) endpoint.status = req.body.status;
    if (Array.isArray(req.body.events)) endpoint.events = Array.from(new Set(req.body.events.filter((event) => events.includes(event))));
    await endpoint.save(); res.json(safeEndpoint(endpoint));
  } catch (error) { next(error); }
});

router.post("/webhooks/:id/rotate-secret", async (req, res, next) => {
  try {
    const endpoint = await WebhookEndpoint.findById(req.params.id).select("+secretEncrypted");
    if (!endpoint) return res.status(404).json({ message: "Webhook endpoint not found" });
    const secret = `whsec_${crypto.randomBytes(32).toString("base64url")}`;
    endpoint.secretEncrypted = encryptSecret(secret); endpoint.secretPrefix = `${secret.slice(0, 12)}…`; await endpoint.save();
    res.json({ signingSecret: secret, warning: "Update the receiving system now. This secret cannot be shown again." });
  } catch (error) { next(error); }
});

router.post("/deliveries/:id/retry", async (req, res, next) => {
  try {
    const delivery = await WebhookDelivery.findById(req.params.id);
    if (!delivery) return res.status(404).json({ message: "Webhook delivery not found" });
    delivery.status = "Pending"; delivery.nextAttemptAt = new Date(); delivery.attempts = 0; await delivery.save();
    await deliverWebhook(delivery);
    res.json({ message: delivery.status === "Delivered" ? "Webhook delivered" : "Delivery attempt recorded", status: delivery.status });
  } catch (error) { next(error); }
});

export default router;
