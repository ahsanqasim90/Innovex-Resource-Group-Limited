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
import { sendInvoiceEmail, sendInvoiceReminderEmail } from "../services/emailService.js";
import { processInvoiceReminders } from "../services/invoiceReminderService.js";
import { actorFrom, addDays, csvEscape, financialYearFor, nextExpenseNumber, nextInvoiceNumber } from "../services/financeService.js";
import { pick, requireFields, validateEmail } from "../utils.js";

const router = express.Router();
const invoiceFields = ["invoiceType", "issueDate", "dueDate", "status", "clientName", "contactName", "billingEmail", "billingAddress", "salesPerson", "orderNumber", "lineItems", "vatRate", "amountPaid", "notes", "paymentTerms", "bankDetails", "senderEmail", "reminderEnabled", "reminderFrequencyDays"];
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

async function refreshOverdueInvoices() {
  await Invoice.updateMany({ status: "Sent", balanceDue: { $gt: 0 }, dueDate: { $lt: new Date() } }, { $set: { status: "Overdue" } });
}

router.get("/reminders/run", async (req, res, next) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ message: "Invalid cron authorization" });
    res.json(await processInvoiceReminders());
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
    if (!invoice.bankDetails?.accountNumber || !invoice.bankDetails?.sortCode) return res.status(400).json({ message: "Configure Finance Centre bank details before sending this invoice" });
    const fromEmail = req.body.fromEmail || invoice.senderEmail;
    if (!canUseSender(req.user, fromEmail)) return res.status(403).json({ message: "This sender mailbox is not assigned to your account" });
    const pdfBuffer = await generateInvoicePdf(invoice);
    const delivery = await sendInvoiceEmail({ invoice, pdfBuffer, fromEmail, customMessage: req.body.message });
    if (!delivery.sent) return res.status(503).json({ message: delivery.reason });
    invoice.senderEmail = fromEmail;
    invoice.sentAt = new Date();
    if (["Draft", "Overdue"].includes(invoice.status)) invoice.status = new Date(invoice.dueDate) < new Date() ? "Overdue" : "Sent";
    invoice.nextReminderAt = invoice.reminderEnabled ? addDays(invoice.dueDate, 1) : undefined;
    invoice.updatedBy = actorFrom(req.user);
    await invoice.save();
    await EmailLog.create({ fromEmail: delivery.fromEmail, fromName: req.user.name, to: [invoice.billingEmail], subject: delivery.subject, message: delivery.message, targetType: "Invoice", targetId: invoice._id, status: "Sent", sentBy: { user: req.user._id, name: req.user.name, email: req.user.email, role: req.user.role } });
    await logActivity(req, { module: "Finance", action: "Sent", entityType: "Invoice", entityId: invoice._id, summary: `Sent invoice ${invoice.invoiceNumber} to ${invoice.billingEmail}`, metadata: { total: invoice.total, senderEmail: fromEmail } });
    res.json({ message: "Invoice sent with PDF attachment", invoice });
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
    const delivery = await sendInvoiceReminderEmail({ invoice, pdfBuffer: await generateInvoicePdf(invoice), fromEmail });
    if (!delivery.sent) return res.status(503).json({ message: delivery.reason });
    invoice.lastReminderAt = new Date();
    invoice.reminderCount += 1;
    invoice.nextReminderAt = addDays(new Date(), invoice.reminderFrequencyDays || 7);
    if (new Date(invoice.dueDate) < new Date()) invoice.status = "Overdue";
    await invoice.save();
    await logActivity(req, { module: "Finance", action: "Reminder sent", entityType: "Invoice", entityId: invoice._id, summary: `Sent payment reminder for invoice ${invoice.invoiceNumber}`, metadata: { balanceDue: invoice.balanceDue } });
    res.json({ message: "Payment reminder sent", invoice });
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

router.get("/expenses/export.csv", async (req, res, next) => {
  try {
    const filter = req.query.financialYear ? { financialYear: req.query.financialYear } : {};
    const expenses = await Expense.find(filter).sort({ expenseDate: 1 });
    const rows = [["Expense Number", "Date", "Financial Year", "Supplier", "Category", "Description", "Reference", "Net", "VAT Rate", "VAT", "Gross", "Payment Status", "Payment Method"]];
    expenses.forEach((item) => rows.push([item.expenseNumber, new Date(item.expenseDate).toLocaleDateString("en-GB"), item.financialYear, item.supplier, item.category, item.description, item.reference, item.netAmount.toFixed(2), item.vatRate, item.vatAmount.toFixed(2), item.totalAmount.toFixed(2), item.paymentStatus, item.paymentMethod]));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=Innovex-Expenses-${req.query.financialYear || "All"}.csv`);
    res.send(`\uFEFF${rows.map((row) => row.map(csvEscape).join(",")).join("\n")}`);
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
    res.json(expenses.map(expenseSummary));
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
