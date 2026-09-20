import EmailLog from "../models/EmailLog.js";

// Hostinger caps how many emails one mailbox may send per day; Innovex's plan allows 3,000.
// Going over gets the mailbox throttled or blocked, which stops every employee using it.
// Override with MAILBOX_DAILY_LIMIT in the environment if the plan ever changes.
export function mailboxDailyLimit() {
  const configured = Number(process.env.MAILBOX_DAILY_LIMIT);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 3000;
}

export function startOfUtcDay(date = new Date()) {
  const start = new Date(date);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

// Counts recipients (to + cc + bcc) sent from this mailbox since midnight UTC.
export async function mailboxSentToday(fromEmail, date = new Date()) {
  const rows = await EmailLog.aggregate([
    { $match: { fromEmail: String(fromEmail || "").toLowerCase().trim(), status: "Sent", createdAt: { $gte: startOfUtcDay(date) } } },
    { $group: { _id: null, total: { $sum: { $add: [{ $size: { $ifNull: ["$to", []] } }, { $size: { $ifNull: ["$cc", []] } }, { $size: { $ifNull: ["$bcc", []] } }] } } } }
  ]);
  return rows[0]?.total || 0;
}

export function dailyLimitReason(fromEmail, used, limit = mailboxDailyLimit()) {
  return `Today's sending limit for ${fromEmail} has been reached (${used} of ${limit}). Please continue tomorrow, or send from a different mailbox.`;
}

export function hasReachedDailyLimit(used, sentThisRun, limit = mailboxDailyLimit()) {
  return used + sentThisRun >= limit;
}
