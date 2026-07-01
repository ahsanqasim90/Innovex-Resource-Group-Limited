import Invoice from "../models/Invoice.js";
import EmailLog from "../models/EmailLog.js";
import { generateInvoicePdf } from "./invoicePdfService.js";
import { sendInvoiceReminderEmail } from "./emailService.js";
import { addDays } from "./financeService.js";

export async function processInvoiceReminders({ limit = 30 } = {}) {
  const now = new Date();
  const invoices = await Invoice.find({
    reminderEnabled: true,
    balanceDue: { $gt: 0 },
    status: { $in: ["Sent", "Partially Paid", "Overdue"] },
    nextReminderAt: { $lte: now }
  }).sort({ nextReminderAt: 1 }).limit(limit);

  const result = { checked: invoices.length, sent: 0, failed: 0, errors: [] };
  for (const invoice of invoices) {
    try {
      if (!invoice.bankDetails?.accountNumber || !invoice.bankDetails?.sortCode) {
        throw new Error("Finance Centre bank details are not configured for this invoice");
      }
      const pdfBuffer = await generateInvoicePdf(invoice);
      const delivery = await sendInvoiceReminderEmail({ invoice, pdfBuffer, fromEmail: invoice.senderEmail });
      if (!delivery.sent) throw new Error(delivery.reason || "Reminder email failed");
      invoice.lastReminderAt = now;
      invoice.reminderCount += 1;
      invoice.nextReminderAt = addDays(now, invoice.reminderFrequencyDays || 7);
      if (new Date(invoice.dueDate) < now && invoice.status === "Sent") invoice.status = "Overdue";
      await invoice.save();
      await EmailLog.create({
        fromEmail: delivery.fromEmail,
        fromName: "Innovex Resource Group Limited",
        to: [invoice.billingEmail],
        subject: delivery.subject,
        message: `Automatic payment reminder for invoice ${invoice.invoiceNumber}`,
        targetType: "Invoice",
        targetId: invoice._id,
        status: "Sent",
        sentBy: { name: "Finance reminder automation", role: "system" }
      });
      result.sent += 1;
    } catch (error) {
      result.failed += 1;
      result.errors.push({ invoiceNumber: invoice.invoiceNumber, message: error.message });
    }
  }
  return result;
}
