import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";
import WebhookDelivery from "../models/WebhookDelivery.js";
import WebhookEndpoint from "../models/WebhookEndpoint.js";
import { forEachActiveOrganization } from "../tenancy/tenantJobs.js";
import { decryptSecret } from "../utils/authSecurity.js";

const retryMinutes = [1, 5, 30, 120, 1440];

function privateAddress(address) {
  const value = String(address).toLowerCase();
  if (value === "::1" || value === "0.0.0.0" || value.startsWith("fe80:") || value.startsWith("fc") || value.startsWith("fd")) return true;
  if (!net.isIPv4(value)) return false;
  const [a, b] = value.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

export async function validateWebhookUrl(input) {
  let url;
  try { url = new URL(String(input)); } catch { throw Object.assign(new Error("Enter a valid webhook URL"), { statusCode: 400 }); }
  if (url.protocol !== "https:" && !(process.env.NODE_ENV !== "production" && url.protocol === "http:")) throw Object.assign(new Error("Webhook endpoints must use HTTPS"), { statusCode: 400 });
  if (url.username || url.password || ["localhost", "metadata.google.internal"].includes(url.hostname) || url.hostname.endsWith(".local")) throw Object.assign(new Error("Private or credentialed webhook URLs are not allowed"), { statusCode: 400 });
  const addresses = net.isIP(url.hostname) ? [{ address: url.hostname }] : await dns.lookup(url.hostname, { all: true }).catch(() => []);
  if (!addresses.length || addresses.some(({ address }) => privateAddress(address))) throw Object.assign(new Error("Webhook hostname must resolve to a public address"), { statusCode: 400 });
  return url.toString();
}

export async function queueWebhook(event, data) {
  const endpoints = await WebhookEndpoint.find({ status: "Active", events: event }).lean();
  if (!endpoints.length) return 0;
  const eventId = crypto.randomUUID();
  const payload = { id: eventId, event, createdAt: new Date().toISOString(), data };
  await WebhookDelivery.insertMany(endpoints.map((endpoint) => ({ endpoint: endpoint._id, eventId, event, payload })), { ordered: false });
  return endpoints.length;
}

export async function deliverWebhook(delivery) {
  const endpoint = await WebhookEndpoint.findOne({ _id: delivery.endpoint, status: "Active" }).select("+secretEncrypted");
  if (!endpoint) { delivery.status = "Failed"; delivery.lastError = "Endpoint is no longer active"; await delivery.save(); return; }
  try {
    await validateWebhookUrl(endpoint.url);
    const body = JSON.stringify(delivery.payload);
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = crypto.createHmac("sha256", decryptSecret(endpoint.secretEncrypted)).update(`${timestamp}.${body}`).digest("hex");
    const response = await fetch(endpoint.url, { method: "POST", redirect: "manual", signal: AbortSignal.timeout(10000), headers: { "content-type": "application/json", "user-agent": "Innovex-Webhooks/1.0", "x-innovex-event": delivery.event, "x-innovex-event-id": delivery.eventId, "x-innovex-timestamp": timestamp, "x-innovex-signature": `v1=${signature}` }, body });
    delivery.attempts += 1; delivery.responseStatus = response.status; delivery.responseExcerpt = (await response.text()).slice(0, 1000);
    endpoint.lastDeliveryAt = new Date();
    if (response.ok) { delivery.status = "Delivered"; delivery.deliveredAt = new Date(); delivery.lastError = ""; endpoint.lastSuccessAt = new Date(); endpoint.failureCount = 0; }
    else throw new Error(`Endpoint returned HTTP ${response.status}`);
  } catch (error) {
    if (!delivery.attempts) delivery.attempts = 1;
    delivery.lastError = error.message;
    endpoint.failureCount += 1; endpoint.lastDeliveryAt = new Date();
    if (delivery.attempts >= retryMinutes.length) delivery.status = "Failed";
    else { delivery.status = "Retrying"; delivery.nextAttemptAt = new Date(Date.now() + retryMinutes[delivery.attempts - 1] * 60000); }
  }
  await Promise.all([delivery.save(), endpoint.save()]);
}

export async function processWebhookOutbox() {
  return forEachActiveOrganization(async () => {
    const deliveries = await WebhookDelivery.find({ status: { $in: ["Pending", "Retrying"] }, nextAttemptAt: { $lte: new Date() } }).sort({ nextAttemptAt: 1 }).limit(20);
    for (const delivery of deliveries) await deliverWebhook(delivery);
    return deliveries.length;
  });
}

export function startWebhookScheduler() {
  const run = () => processWebhookOutbox().catch((error) => console.error("Webhook outbox failed", error));
  setTimeout(run, 15000);
  const timer = setInterval(run, 60000);
  timer.unref?.();
}
