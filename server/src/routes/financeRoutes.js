import express from "express";
import Invoice from "../models/Invoice.js";
import Expense from "../models/Expense.js";
import EmailLog from "../models/EmailLog.js";
import { protect } from "../middleware/auth.js";
import { uploadExpenseReceipt } from "../middleware/upload.js";
import { canViewFinance } from "../config/permissions.js";
import { allowedSenderAccountsForUser, canUseSender } from "../config/emailAccounts.js";
import { logActivity } from "../services/activityLogService.js";
import { generateInvoicePdf } from "../services/invoicePdfService.js";
import { generateExpenseLedgerPdf } from "../services/expenseLedgerPdfService.js";
import { sendInvoiceEmail, sendInvoiceReminderEmail } from "../services/emailService.js";
import { processInvoiceReminders } from "../services/invoiceReminderService.js";
import { processScheduledInvoices } from "../services/invoiceScheduleService.js";
import { actorFrom, addDays, csvEscape, financialYearFor, nextExpenseNumber, nextInvoiceNumber } from "../services/financeService.js";
import { pick, requireFields, validateEmail } from "../utils.js";

const router = express.Router();
const invoiceFields = ["invoiceType", "issueDate", "dueDate", "status", "clientName", "contactName", "billingEmail", "billingAddress", "salesPerson", "orderNumber", "lineItems", "vatRate", "amountPaid", "notes", "paymentTerms", "bankDetails", "senderEmail", "reminderEnabled", "reminderFrequencyDays", "cancelReason", "paymentReference"];
const expenseFields = ["expenseDate", "supplier", "category", "description", "reference", "netAmount", "vatRate", "paymentStatus", "paymentMethod", "notes"];

function ownerOnly(req, res, next) {
  if (canViewFinance(req.user)) return next();
  return res.status(403).json({ message: "Finance Centre is restricted to owner accounts" });
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function dateRange(from, to) {
  const range = {};
  if (from) range.$gte = new Date(`${from}T00:00:00.000Z`);
  if (to) range.$lte = new Date(`${to}T23:59:59.999Z`);
  return Object.keys(range).length ? range : null;
}

function emailList(value) {
  const items = (Array.isArray(value) ? value : String(value || "").split(","))
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);
  items.forEach(validateEmail);
  return Array.from(new Set(items));
}

function invoicePayload(body, user) {
  const payload = pick(body, invoiceFields);
  ["vatRate", "amountPaid", "reminderFrequencyDays"].forEach((field) => {
    if (payload[field] !== undefined) payload[field] = Number(payload[field] || 0);
  });
  if (payload.reminderEnabled !== undefined) payload.reminderEnabled = payload.reminderEnabled === true || payload.reminderEnabled === "true";
  if (payload.lineItems !== undefined) {
    payload.lineItems = (Array.isArray(payload.lineItems) ? payload.lineItems : []).map((item) => ({
      ...item,
      hourlyRate: Number(item.hourlyRate || 0),
      hoursPerWeek: Number(item.hoursPerWeek || 0),
      weeksPerYear: Number(item.weeksPerYear || 52),
      annualGrossSalary: Number(item.annualGrossSalary || 0),
      serviceFeePercent: Number(item.serviceFeePercent || 0),
      quantity: Number(item.quantity || 1),
      unitPrice: Number(item.unitPrice || 0)
    }));
  }
  payload.updatedBy = actorFrom(user);
  return payload;
}

function expensePayload(body, user) {
  const payload = pick(body, expenseFields);
  ["netAmount", "vatRate"].forEach((field) => {
    if (payload[field] !== undefined) payload[field] = Number(payload[field] || 0);
  });
  payload.updatedBy = actorFrom(user);
  return payload;
}

function expenseSummary(expense) {
  const item = expense?.toObject ? expense.toObject() : { ...expense };
  if (item.receipt) {
    item.hasReceipt = Boolean(item.receipt.hasFile || item.receipt.data);
    item.receipt = { originalName: item.receipt.originalName, mimetype: item.receipt.mimetype, size: item.receipt.size };
  }
  return item;
}

function ledgerNumberFor(expense, index) {
  const year = String(expense.financialYear || financialYearFor(expense.expenseDate)).replace("/", "-");
  return `LED-${year}-${String(index + 1).padStart(4, "0")}`;
}

function attachLedgerNumbers(expenses) {
  const sorted = [...expenses].sort((a, b) => {
    const dateDiff = new Date(a.expenseDate || 0) - new Date(b.expenseDate || 0);
    if (dateDiff) return dateDiff;
    return new Date(a.createdAt || 0) - new Date(b.createdAt || 0);
  });
  const ledgerMap = new Map(sorted.map((expense, index) => [String(expense._id), ledgerNumberFor(expense, index)]));
  return expenses.map((expense) => ({
    ...expenseSummary(expense),
    ledgerNumber: ledgerMap.get(String(expense._id)) || expense.expenseNumber
  }));
}

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function moneyCell(value) {
  return Number(value || 0).toFixed(2);
}

async function refreshOverdueInvoices() {
  await Invoice.updateMany({ status: "Sent", balanceDue: { $gt: 0 }, dueDate: { $lt: new Date() } }, { $set: { status: "Overdue" } });
}

router.get("/reminders/run", async (req, res, next) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ message: "Invalid cron authorization" });
    const [reminders, scheduled] = await Promise.all([processInvoiceReminders(), processScheduledInvoices()]);
    res.json({ reminders, scheduled });
  } catch (error) { next(error); }
});

router.get("/scheduled/run", async (req, res, next) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ message: "Invalid cron authorization" });
    res.json(await processScheduledInvoices());
  } catch (error) { next(error); }
});

router.use(protect, ownerOnly);

router.get("/senders", (req, res) => res.json(allowedSenderAccountsForUser(req.user)));

router.get("/dashboard", async (req, res, next) => {
  try {
    await refreshOverdueInvoices();
    const financialYear = req.query.financialYear || financialYearFor(new Date());
    const [invoiceTotals, expenseTotals, overdueCount, draftCount, dueSoon, recentInvoices, recentExpenses, years] = await Promise.all([
      Invoice.aggregate([{ $match: { financialYear, status: { $ne: "Cancelled" } } }, { $group: { _id: null, invoiced: { $sum: "$total" }, paid: { $sum: "$amountPaid" }, outstanding: { $sum: "$balanceDue" }, count: { $sum: 1 } } }]),
      Expense.aggregate([{ $match: { financialYear } }, { $group: { _id: null, net: { $sum: "$netAmount" }, vat: { $sum: "$vatAmount" }, total: { $sum: "$totalAmount" }, count: { $sum: 1 } } }]),
      Invoice.countDocuments({ financialYear, status: "Overdue", balanceDue: { $gt: 0 } }),
      Invoice.countDocuments({ financialYear, status: "Draft" }),
      Invoice.find({ financialYear, status: { $in: ["Sent", "Partially Paid", "Overdue"] }, balanceDue: { $gt: 0 }, dueDate: { $lte: addDays(new Date(), 14) } }).sort({ dueDate: 1 }).limit(8),
      Invoice.find({ financialYear }).sort({ issueDate: -1, createdAt: -1 }).limit(6),
      Expense.find({ financialYear }).select("-receipt.data").sort({ expenseDate: -1, createdAt: -1 }).limit(6),
      Promise.all([Invoice.distinct("financialYear"), Expense.distinct("financialYear")])
    ]);
    const invoice = invoiceTotals[0] || { invoiced: 0, paid: 0, outstanding: 0, count: 0 };
    const expense = expenseTotals[0] || { net: 0, vat: 0, total: 0, count: 0 };
    res.json({ financialYear, invoice, expense, netPosition: invoice.paid - expense.total, overdueCount, draftCount, dueSoon, recentInvoices, recentExpenses: recentExpenses.map(expenseSummary), financialYears: Array.from(new Set(years.flat().concat(financialYear))).sort().reverse() });
  } catch (error) { next(error); }
});

router.get("/invoices", async (req, res, next) => {
  try {
    await refreshOverdueInvoices();
    const filter = {};
    const { search, status, financialYear, dateFrom, dateTo } = req.query;
    if (status) filter.status = status;
    if (financialYear) filter.financialYear = financialYear;
    const range = dateRange(dateFrom, dateTo);
    if (range) filter.issueDate = range;
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ invoiceNumber: regex }, { clientName: regex }, { billingEmail: regex }, { orderNumber: regex }];
    }
    res.json(await Invoice.find(filter).sort({ issueDate: -1, createdAt: -1 }));
  } catch (error) { next(error); }
});

router.post("/invoices", async (req, res, next) => {
  try {
    requireFields(req.body, ["clientName", "billingEmail", "billingAddress", "issueDate", "dueDate"]);
    validateEmail(req.body.billingEmail);
    if (!Array.isArray(req.body.lineItems) || !req.body.lineItems.length) return res.status(400).json({ message: "Add at least one invoice item" });
    const invoice = await Invoice.create({ ...invoicePayload(req.body, req.user), invoiceNumber: await nextInvoiceNumber(), financialYear: financialYearFor(req.body.issueDate), createdBy: actorFrom(req.user) });
    await logActivity(req, { module: "Finance", action: "Created", entityType: "Invoice", entityId: invoice._id, summary: `Created draft invoice ${invoice.invoiceNumber} for ${invoice.clientName}`, metadata: { total: invoice.total, financialYear: invoice.financialYear } });
    res.status(201).json(invoice);
  } catch (error) { next(error); }
});

router.get("/invoices/:id/pdf", async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    const pdf = await generateInvoicePdf(invoice);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Innovex-Invoice-${invoice.invoiceNumber}.pdf`);
    res.send(pdf);
  } catch (error) { next(error); }
});

router.post("/invoices/:id/send", async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    if (invoice.scheduledStatus === "Processing") return res.status(409).json({ message: "This invoice is currently being sent by the scheduler" });
    if (!invoice.bankDetails?.accountNumber || !invoice.bankDetails?.sortCode) return res.status(400).json({ message: "Configure Finance Centre bank details before sending this invoice" });
    const fromEmail = req.body.fromEmail || invoice.senderEmail;
    if (!canUseSender(req.user, fromEmail)) return res.status(403).json({ message: "This sender mailbox is not assigned to your account" });
    const pdfBuffer = await generateInvoicePdf(invoice);
    const cc = emailList(req.body.cc);
    const delivery = await sendInvoiceEmail({ invoice, pdfBuffer, fromEmail, customMessage: req.body.message, cc });
    if (!delivery.sent) return res.status(503).json({ message: delivery.reason });
    invoice.senderEmail = fromEmail;
    invoice.cc = cc;
    invoice.sentAt = new Date();
    invoice.scheduledStatus = "Sent";
    invoice.scheduledSendAt = undefined;
    invoice.scheduledMessage = "";
    invoice.scheduleError = "";
    invoice.sentFolderSaved = delivery.sentFolderSaved;
    invoice.sentFolderError = delivery.sentFolderError;
    if (["Draft", "Overdue"].includes(invoice.status)) invoice.status = new Date(invoice.dueDate) < new Date() ? "Overdue" : "Sent";
    invoice.nextReminderAt = invoice.reminderEnabled ? addDays(invoice.dueDate, 1) : undefined;
    invoice.updatedBy = actorFrom(req.user);
    await invoice.save();
    await EmailLog.create({ fromEmail: delivery.fromEmail, fromName: req.user.name, to: [invoice.billingEmail], cc, subject: delivery.subject, message: delivery.message, targetType: "Invoice", targetId: invoice._id, status: "Sent", error: delivery.sentFolderError || "", sentBy: { user: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role } });
    await logActivity(req, { module: "Finance", action: "Sent", entityType: "Invoice", entityId: invoice._id, summary: `Sent invoice ${invoice.invoiceNumber} to ${invoice.billingEmail}`, metadata: { total: invoice.total, senderEmail: fromEmail } });
    const archiveNote = delivery.sentFolderSaved ? " A copy was saved in the sender mailbox Sent folder." : ` The invoice was sent, but the Sent-folder copy could not be saved: ${delivery.sentFolderError}`;
    res.json({ message: `Invoice sent with PDF attachment.${archiveNote}`, invoice });
  } catch (error) { next(error); }
});

router.post("/invoices/:id/schedule", async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    if (invoice.scheduledStatus === "Processing") return res.status(409).json({ message: "This invoice is currently being sent" });
    if (!invoice.bankDetails?.accountNumber || !invoice.bankDetails?.sortCode) return res.status(400).json({ message: "Configure Finance Centre bank details before scheduling this invoice" });
    const fromEmail = req.body.fromEmail || invoice.senderEmail;
    if (!canUseSender(req.user, fromEmail)) return res.status(403).json({ message: "This sender mailbox is not assigned to your account" });
    const scheduledSendAt = new Date(req.body.scheduledSendAt);
    if (Number.isNaN(scheduledSendAt.getTime()) || scheduledSendAt <= new Date()) return res.status(400).json({ message: "Choose a future date and time" });

    invoice.senderEmail = fromEmail;
    invoice.cc = emailList(req.body.cc);
    invoice.scheduledSendAt = scheduledSendAt;
    invoice.scheduledStatus = "Scheduled";
    invoice.scheduledMessage = String(req.body.message || "").trim();
    invoice.scheduleError = "";
    invoice.scheduledBy = actorFrom(req.user);
    invoice.updatedBy = actorFrom(req.user);
    await invoice.save();
    await logActivity(req, { module: "Finance", action: "Scheduled", entityType: "Invoice", entityId: invoice._id, summary: `Scheduled invoice ${invoice.invoiceNumber} for ${scheduledSendAt.toISOString()}`, metadata: { senderEmail: fromEmail, cc: invoice.cc } });
    res.json({ message: `Invoice scheduled for ${scheduledSendAt.toLocaleString("en-GB", { timeZone: "Europe/London" })}`, invoice });
  } catch (error) { next(error); }
});

router.delete("/invoices/:id/schedule", async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    if (!['Scheduled', 'Failed'].includes(invoice.scheduledStatus)) return res.status(400).json({ message: "This invoice does not have a cancellable scheduled delivery" });
    invoice.scheduledStatus = "Cancelled";
    invoice.scheduledSendAt = undefined;
    invoice.scheduleError = "";
    invoice.updatedBy = actorFrom(req.user);
    await invoice.save();
    await logActivity(req, { module: "Finance", action: "Schedule cancelled", entityType: "Invoice", entityId: invoice._id, summary: `Cancelled scheduled delivery for invoice ${invoice.invoiceNumber}` });
    res.json({ message: "Scheduled delivery cancelled", invoice });
  } catch (error) { next(error); }
});

router.post("/invoices/:id/remind", async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    if (invoice.balanceDue <= 0) return res.status(400).json({ message: "This invoice has no outstanding balance" });
    if (!invoice.bankDetails?.accountNumber || !invoice.bankDetails?.sortCode) return res.status(400).json({ message: "Configure Finance Centre bank details before sending this reminder" });
    const fromEmail = req.body.fromEmail || invoice.senderEmail;
    if (!canUseSender(req.user, fromEmail)) return res.status(403).json({ message: "This sender mailbox is not assigned to your account" });
    const delivery = await sendInvoiceReminderEmail({ invoice, pdfBuffer: await generateInvoicePdf(invoice), fromEmail, cc: invoice.cc || [] });
    if (!delivery.sent) return res.status(503).json({ message: delivery.reason });
    invoice.lastReminderAt = new Date();
    invoice.reminderCount += 1;
    invoice.nextReminderAt = addDays(new Date(), invoice.reminderFrequencyDays || 7);
    invoice.sentFolderSaved = delivery.sentFolderSaved;
    invoice.sentFolderError = delivery.sentFolderError;
    if (new Date(invoice.dueDate) < new Date()) invoice.status = "Overdue";
    await invoice.save();
    await EmailLog.create({ fromEmail: delivery.fromEmail, fromName: req.user.name, to: [invoice.billingEmail], cc: invoice.cc || [], subject: delivery.subject, message: `Manual payment reminder for invoice ${invoice.invoiceNumber}`, targetType: "Invoice", targetId: invoice._id, status: "Sent", error: delivery.sentFolderError || "", sentBy: { user: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role } });
    await logActivity(req, { module: "Finance", action: "Reminder sent", entityType: "Invoice", entityId: invoice._id, summary: `Sent payment reminder for invoice ${invoice.invoiceNumber}`, metadata: { balanceDue: invoice.balanceDue } });
    res.json({ message: "Payment reminder sent", invoice });
  } catch (error) { next(error); }
});

router.post("/invoices/:id/mark-paid", async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    if (invoice.status === "Cancelled") return res.status(400).json({ message: "Cancelled invoices cannot be marked as paid" });
    if (invoice.total <= 0) return res.status(400).json({ message: "This invoice has no payable total" });

    const paidAmount = req.body.amountPaid !== undefined ? Number(req.body.amountPaid || 0) : invoice.total;
    invoice.amountPaid = Math.min(Math.max(paidAmount, 0), invoice.total);
    invoice.paymentReference = String(req.body.paymentReference || invoice.paymentReference || "").trim();
    invoice.paidAt = req.body.paidAt ? new Date(req.body.paidAt) : new Date();
    invoice.nextReminderAt = undefined;
    invoice.reminderEnabled = false;
    if (["Scheduled", "Processing", "Failed"].includes(invoice.scheduledStatus)) {
      invoice.scheduledStatus = "Cancelled";
      invoice.scheduledSendAt = undefined;
      invoice.scheduleError = "";
    }
    invoice.updatedBy = actorFrom(req.user);
    await invoice.save();
    await logActivity(req, {
      module: "Finance",
      action: "Marked paid",
      entityType: "Invoice",
      entityId: invoice._id,
      summary: `Marked invoice ${invoice.invoiceNumber} as paid`,
      metadata: { amountPaid: invoice.amountPaid, paymentReference: invoice.paymentReference }
    });
    res.json({ message: `Invoice ${invoice.invoiceNumber} marked as paid`, invoice });
  } catch (error) { next(error); }
});

router.post("/invoices/:id/cancel", async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    if (invoice.status === "Paid") return res.status(400).json({ message: "Paid invoices cannot be cancelled. Record a credit note separately if needed." });
    invoice.status = "Cancelled";
    invoice.cancelReason = String(req.body.cancelReason || invoice.cancelReason || "Cancelled by admin").trim();
    invoice.cancelledAt = new Date();
    invoice.nextReminderAt = undefined;
    invoice.reminderEnabled = false;
    if (["Scheduled", "Processing", "Failed"].includes(invoice.scheduledStatus)) {
      invoice.scheduledStatus = "Cancelled";
      invoice.scheduledSendAt = undefined;
      invoice.scheduleError = "";
    }
    invoice.updatedBy = actorFrom(req.user);
    await invoice.save();
    await logActivity(req, {
      module: "Finance",
      action: "Cancelled",
      entityType: "Invoice",
      entityId: invoice._id,
      summary: `Cancelled invoice ${invoice.invoiceNumber}`,
      metadata: { cancelReason: invoice.cancelReason }
    });
    res.json({ message: `Invoice ${invoice.invoiceNumber} cancelled`, invoice });
  } catch (error) { next(error); }
});

router.put("/invoices/:id", async (req, res, next) => {
  try {
    if (req.body.billingEmail) validateEmail(req.body.billingEmail);
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    const payload = invoicePayload(req.body, req.user);
    if (payload.issueDate) payload.financialYear = financialYearFor(payload.issueDate);
    Object.assign(invoice, payload);
    await invoice.save();
    await logActivity(req, { module: "Finance", action: "Updated", entityType: "Invoice", entityId: invoice._id, summary: `Updated invoice ${invoice.invoiceNumber}`, metadata: { status: invoice.status, amountPaid: invoice.amountPaid, balanceDue: invoice.balanceDue } });
    res.json(invoice);
  } catch (error) { next(error); }
});

router.delete("/invoices/:id", async (req, res, next) => {
  try {
    const invoice = await Invoice.findById(req.params.id);
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    if (invoice.status !== "Draft") return res.status(400).json({ message: "Only draft invoices can be deleted. Cancel a sent invoice to preserve the audit trail." });
    await invoice.deleteOne();
    await logActivity(req, { module: "Finance", action: "Deleted", entityType: "Invoice", entityId: invoice._id, summary: `Deleted draft invoice ${invoice.invoiceNumber}` });
    res.json({ message: "Draft invoice deleted" });
  } catch (error) { next(error); }
});

router.get("/expenses/export.pdf", async (req, res, next) => {
  try {
    const filter = req.query.financialYear ? { financialYear: req.query.financialYear } : {};
    const financialYear = req.query.financialYear || "All";
    const expenses = attachLedgerNumbers(await Expense.find(filter).sort({ expenseDate: 1, createdAt: 1 }));
    const pdf = await generateExpenseLedgerPdf({ expenses, financialYear });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=Innovex-Expense-Ledger-${financialYear}.pdf`);
    res.send(pdf);
  } catch (error) { next(error); }
});

router.get("/expenses/export.csv", async (req, res, next) => {
  try {
    const filter = req.query.financialYear ? { financialYear: req.query.financialYear } : {};
    const expenses = attachLedgerNumbers(await Expense.find(filter).sort({ expenseDate: 1, createdAt: 1 }));
    const rows = [["Ledger Number", "Audit ID", "Date", "Financial Year", "Supplier", "Category", "Description", "Reference", "Net", "VAT Rate", "VAT", "Gross", "Payment Status", "Payment Method"]];
    expenses.forEach((item) => rows.push([item.ledgerNumber, item.expenseNumber, new Date(item.expenseDate).toLocaleDateString("en-GB"), item.financialYear, item.supplier, item.category, item.description, item.reference, moneyCell(item.netAmount), item.vatRate, moneyCell(item.vatAmount), moneyCell(item.totalAmount), item.paymentStatus, item.paymentMethod]));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=Innovex-Expenses-${req.query.financialYear || "All"}.csv`);
    res.send(`\uFEFF${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}`);
  } catch (error) { next(error); }
});

router.get("/expenses/export.xls", async (req, res, next) => {
  try {
    const filter = req.query.financialYear ? { financialYear: req.query.financialYear } : {};
    const financialYear = req.query.financialYear || "All";
    const expenses = attachLedgerNumbers(await Expense.find(filter).sort({ expenseDate: 1, createdAt: 1 }));
    const totals = expenses.reduce((sum, item) => ({
      net: sum.net + Number(item.netAmount || 0),
      vat: sum.vat + Number(item.vatAmount || 0),
      gross: sum.gross + Number(item.totalAmount || 0)
    }), { net: 0, vat: 0, gross: 0 });

    const rows = expenses.map((item) => `
      <tr>
        <td>${escapeHtml(item.ledgerNumber)}</td>
        <td>${escapeHtml(item.expenseNumber)}</td>
        <td>${escapeHtml(new Date(item.expenseDate).toLocaleDateString("en-GB"))}</td>
        <td>${escapeHtml(item.supplier)}</td>
        <td>${escapeHtml(item.category)}</td>
        <td>${escapeHtml(item.description)}</td>
        <td>${escapeHtml(item.reference || "")}</td>
        <td class="money">${moneyCell(item.netAmount)}</td>
        <td class="money">${moneyCell(item.vatAmount)}</td>
        <td class="money">${moneyCell(item.totalAmount)}</td>
        <td>${escapeHtml(item.paymentStatus)}</td>
        <td>${escapeHtml(item.paymentMethod)}</td>
      </tr>`).join("");

    const html = `<!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <style>
            body { font-family: Arial, sans-serif; color: #073f4c; }
            .title { font-size: 24px; font-weight: 700; }
            .subtle { color: #60757b; }
            .summary td { padding: 8px 14px; border: 1px solid #d9e7e9; background: #f3fbfb; font-weight: 700; }
            table { border-collapse: collapse; width: 100%; }
            th { padding: 9px; color: #fff; background: #064f5e; border: 1px solid #064f5e; text-align: left; }
            td { padding: 8px; border: 1px solid #d9e7e9; vertical-align: top; }
            tr:nth-child(even) td { background: #f8fbfb; }
            .money { mso-number-format: "0.00"; text-align: right; }
          </style>
        </head>
        <body>
          <p class="title">Innovex Resource Group Limited - Expense Ledger</p>
          <p class="subtle">Financial year: ${escapeHtml(financialYear)} | Generated: ${escapeHtml(new Date().toLocaleString("en-GB", { timeZone: "Europe/London" }))}</p>
          <table class="summary">
            <tr><td>Total records</td><td>${expenses.length}</td><td>Net</td><td class="money">${moneyCell(totals.net)}</td><td>VAT</td><td class="money">${moneyCell(totals.vat)}</td><td>Gross</td><td class="money">${moneyCell(totals.gross)}</td></tr>
          </table>
          <br />
          <table>
            <thead><tr><th>Ledger No</th><th>Audit ID</th><th>Date</th><th>Supplier</th><th>Category</th><th>Description</th><th>Supplier Ref</th><th>Net</th><th>VAT</th><th>Gross</th><th>Status</th><th>Method</th></tr></thead>
            <tbody>${rows || '<tr><td colspan="12">No expenses found for this reporting period.</td></tr>'}</tbody>
          </table>
        </body>
      </html>`;

    res.setHeader("Content-Type", "application/vnd.ms-excel; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=Innovex-Expense-Ledger-${financialYear}.xls`);
    res.send(`\uFEFF${html}`);
  } catch (error) { next(error); }
});

router.get("/expenses", async (req, res, next) => {
  try {
    const filter = {};
    const { search, category, paymentStatus, financialYear, dateFrom, dateTo } = req.query;
    if (category) filter.category = category;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (financialYear) filter.financialYear = financialYear;
    const range = dateRange(dateFrom, dateTo);
    if (range) filter.expenseDate = range;
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ supplier: regex }, { description: regex }, { reference: regex }, { expenseNumber: regex }];
    }
    const expenses = await Expense.find(filter).select("-receipt.data").sort({ expenseDate: -1, createdAt: -1 });
    res.json(attachLedgerNumbers(expenses));
  } catch (error) { next(error); }
});

router.post("/expenses", uploadExpenseReceipt.single("receipt"), async (req, res, next) => {
  try {
    requireFields(req.body, ["expenseDate", "supplier", "description"]);
    const payload = expensePayload(req.body, req.user);
    const expense = await Expense.create({ ...payload, expenseNumber: await nextExpenseNumber(), financialYear: financialYearFor(req.body.expenseDate), createdBy: actorFrom(req.user), receipt: req.file ? { originalName: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size, hasFile: true, data: req.file.buffer } : undefined });
    await logActivity(req, { module: "Finance", action: "Created", entityType: "Expense", entityId: expense._id, summary: `Recorded ${expense.expenseNumber} for ${expense.supplier}`, metadata: { totalAmount: expense.totalAmount, category: expense.category, financialYear: expense.financialYear } });
    res.status(201).json(expenseSummary(expense));
  } catch (error) { next(error); }
});

router.get("/expenses/:id/receipt", async (req, res, next) => {
  try {
    const expense = await Expense.findById(req.params.id).select("receipt");
    if (!expense?.receipt?.data) return res.status(404).json({ message: "Receipt not found" });
    res.setHeader("Content-Type", expense.receipt.mimetype || "application/octet-stream");
    res.setHeader("Content-Disposition", `attachment; filename=${encodeURIComponent(expense.receipt.originalName || "receipt")}`);
    res.send(expense.receipt.data);
  } catch (error) { next(error); }
});

router.put("/expenses/:id", uploadExpenseReceipt.single("receipt"), async (req, res, next) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    const payload = expensePayload(req.body, req.user);
    if (payload.expenseDate) payload.financialYear = financialYearFor(payload.expenseDate);
    if (req.file) payload.receipt = { originalName: req.file.originalname, mimetype: req.file.mimetype, size: req.file.size, hasFile: true, data: req.file.buffer };
    Object.assign(expense, payload);
    await expense.save();
    await logActivity(req, { module: "Finance", action: "Updated", entityType: "Expense", entityId: expense._id, summary: `Updated expense ${expense.expenseNumber}`, metadata: { totalAmount: expense.totalAmount, category: expense.category } });
    res.json(expenseSummary(expense));
  } catch (error) { next(error); }
});

router.delete("/expenses/:id", async (req, res, next) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found" });
    await logActivity(req, { module: "Finance", action: "Deleted", entityType: "Expense", entityId: expense._id, summary: `Deleted expense ${expense.expenseNumber}`, metadata: { totalAmount: expense.totalAmount } });
    res.json({ message: "Expense deleted" });
  } catch (error) { next(error); }
});

export default router;
