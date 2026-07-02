import Invoice from "../models/Invoice.js";
import EmailLog from "../models/EmailLog.js";
import { generateInvoicePdf } from "./invoicePdfService.js";
import { sendInvoiceEmail } from "./emailService.js";
import { addDays } from "./financeService.js";

export async function processScheduledInvoices(limit = 25) {
  const result = { processed: 0, sent: 0, failed: 0, errors: [] };

  while (result.processed < limit) {
    const invoice = await Invoice.findOneAndUpdate(
      { scheduledStatus: "Scheduled", scheduledSendAt: { $lte: new Date() } },
      { $set: { scheduledStatus: "Processing", scheduleError: "" } },
      { new: true, sort: { scheduledSendAt: 1 } }
    );
    if (!invoice) break;
    result.processed += 1;

    try {
      const delivery = await sendInvoiceEmail({
        invoice,
        pdfBuffer: await generateInvoicePdf(invoice),
        fromEmail: invoice.senderEmail,
        customMessage: invoice.scheduledMessage,
        cc: invoice.cc || []
      });
      if (!delivery.sent) throw new Error(delivery.reason || "Scheduled invoice could not be sent");

      invoice.sentAt = new Date();
      invoice.scheduledStatus = "Sent";
      invoice.scheduleError = "";
      invoice.sentFolderSaved = delivery.sentFolderSaved;
      invoice.sentFolderError = delivery.sentFolderError;
      if (["Draft", "Overdue"].includes(invoice.status)) invoice.status = new Date(invoice.dueDate) < new Date() ? "Overdue" : "Sent";
      invoice.nextReminderAt = invoice.reminderEnabled ? addDays(invoice.dueDate, 1) : undefined;
      await invoice.save();

      await EmailLog.create({
        fromEmail: delivery.fromEmail,
        fromName: invoice.scheduledBy?.name || "Innovex Finance Centre",
        to: [invoice.billingEmail],
        cc: invoice.cc || [],
        subject: delivery.subject,
        message: delivery.message,
        targetType: "Invoice",
        targetId: invoice._id,
        status: "Sent",
        sentBy: { user: invoice.scheduledBy?.user, name: invoice.scheduledBy?.name, email: invoice.scheduledBy?.email, role: "scheduled" }
      });
      result.sent += 1;
    } catch (error) {
      invoice.scheduledStatus = "Failed";
      invoice.scheduleError = error.message || "Scheduled delivery failed";
      await invoice.save();
      await EmailLog.create({
        fromEmail: invoice.senderEmail,
        fromName: invoice.scheduledBy?.name || "Innovex Finance Centre",
        to: [invoice.billingEmail],
        cc: invoice.cc || [],
        subject: `Invoice ${invoice.invoiceNumber} | Innovex Resource Group Limited`,
        message: invoice.scheduledMessage || `Scheduled invoice ${invoice.invoiceNumber}`,
        targetType: "Invoice",
        targetId: invoice._id,
        status: "Failed",
        error: invoice.scheduleError,
        sentBy: { user: invoice.scheduledBy?.user, name: invoice.scheduledBy?.name, email: invoice.scheduledBy?.email, role: "scheduled" }
      });
      result.failed += 1;
      result.errors.push({ invoiceNumber: invoice.invoiceNumber, message: invoice.scheduleError });
    }
  }

  return result;
}
