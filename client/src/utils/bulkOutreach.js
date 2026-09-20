import { api } from "../api/client.js";

// Serverless requests are cut off after about a minute, and every email takes a few
// seconds. Sending a whole selection in one request used to be killed part-way, leaving
// staff unsure what had gone out and tempting them to press Send again (duplicate emails).
// This helper sends in small batches, follows the server's `remaining` list, and reports
// exactly what was sent, skipped, failed and still unsent.
const BATCH_SIZE = 10;
const MAX_STALLED_BATCHES = 2;

export async function sendOutreachInBatches({ path, idsKey, ids, body = {}, onProgress, batchSize = BATCH_SIZE }) {
  const total = ids.length;
  let queue = [...ids];
  let stalled = 0;
  const totals = { total, sent: 0, archived: 0, failed: [], archiveFailed: [], skipped: [], stopReason: "", error: "", unsent: [] };

  while (queue.length) {
    const batch = queue.slice(0, batchSize);
    let result;
    try {
      result = await api(path, { method: "POST", body: { ...body, [idsKey]: batch } });
    } catch (error) {
      totals.error = error.status === 504 || error.status === 502
        ? "The server took too long to answer. Some emails in the last batch may already have been sent; check Email Centre history, then press Send again. Anyone already emailed is skipped automatically."
        : error.message;
      break;
    }

    totals.sent += Number(result.sent || 0);
    totals.archived += Number(result.archived || 0);
    totals.failed.push(...(result.failed || []));
    totals.archiveFailed.push(...(result.archiveFailed || []));
    totals.skipped.push(...(result.skipped || []));

    const remaining = Array.isArray(result.remaining) ? result.remaining : [];
    const handled = batch.length - remaining.length;
    queue = [...remaining, ...queue.slice(batch.length)];

    if (result.stopReason) {
      totals.stopReason = result.stopReason;
      break;
    }
    if (handled <= 0) {
      stalled += 1;
      if (stalled >= MAX_STALLED_BATCHES) {
        totals.stopReason = "The server made no progress on the last batches. Please try again in a moment.";
        break;
      }
    } else {
      stalled = 0;
    }
    onProgress?.({ done: total - queue.length, total, sent: totals.sent });
  }

  // Anything not confirmed, plus anything that failed, stays selected so it can be retried safely.
  const failedIds = totals.failed.map((item) => String(item.id)).filter(Boolean);
  totals.unsent = [...new Set([...queue, ...failedIds])];
  return totals;
}

export function summariseOutreach(result, noun = "email") {
  const parts = [];
  parts.push(result.sent ? `Sent ${result.sent} of ${result.total} ${noun}${result.total === 1 ? "" : "s"}.` : `No ${noun}s were sent.`);
  if (result.sent && result.archiveFailed.length) parts.push(`${result.archived} of ${result.sent} were saved to the Sent folder; ${result.archiveFailed.length} need attention.`);
  if (result.skipped.length) parts.push(`${result.skipped.length} skipped (already emailed recently, no email address, or Do Not Contact).`);
  if (result.failed.length) parts.push(`${result.failed.length} failed: ${result.failed[0].reason}${result.failed.length > 1 ? " (see Email Centre history for each one)" : ""}.`);
  if (result.stopReason) parts.push(`Stopped early: ${result.stopReason}`);
  if (result.error) parts.push(result.error);
  if (result.unsent.length) parts.push(`${result.unsent.length} remain selected so you can retry them.`);
  return parts.join(" ");
}

export function outreachHadProblems(result) {
  return Boolean(result.failed.length || result.archiveFailed.length || result.stopReason || result.error);
}
