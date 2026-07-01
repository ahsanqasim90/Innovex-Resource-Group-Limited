import FinanceCounter from "../models/FinanceCounter.js";
export { financialYearFor } from "../utils/financialYear.js";

export function actorFrom(user) {
  return { user: user?._id, name: user?.name || "System", email: user?.email || "" };
}

async function nextSequence(key, startingAt) {
  await FinanceCounter.updateOne({ _id: key }, { $setOnInsert: { seq: startingAt - 1 } }, { upsert: true });
  const counter = await FinanceCounter.findByIdAndUpdate(key, { $inc: { seq: 1 } }, { new: true });
  return counter.seq;
}

export async function nextInvoiceNumber() {
  const sequence = await nextSequence("invoice", Number(process.env.INVOICE_START_NUMBER || 115));
  return String(sequence).padStart(6, "0");
}

export async function nextExpenseNumber() {
  const sequence = await nextSequence("expense", Number(process.env.EXPENSE_START_NUMBER || 1));
  return `EXP-${String(sequence).padStart(6, "0")}`;
}

export function addDays(value, days) {
  const date = new Date(value || Date.now());
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date;
}

export function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}
