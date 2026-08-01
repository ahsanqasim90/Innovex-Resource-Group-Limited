import ClientTerms from "../models/ClientTerms.js";
import EmailLog from "../models/EmailLog.js";
import { generateClientTermsPdf } from "./clientTermsPdfService.js";
import { sendClientTermsUnsignedReminderEmail } from "./emailService.js";

function isoDateOnly(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function clientTermsReminderWindow(date = new Date()) {
  const todayStart = new Date(date);
  todayStart.setUTCHours(0, 0, 0, 0);
  return { reminderDate: isoDateOnly(date), sentBefore: todayStart };
}

export async function processClientTermsReminders({ date = new Date(), limit = 40 } = {}) {
  const { reminderDate, sentBefore } = clientTermsReminderWindow(date);
  const result = { reminderDate, checked: 0, sent: 0, failed: 0, errors: [] };

  while (result.checked < limit) {
    const terms = await ClientTerms.findOneAndUpdate(
      {
        status: "Sent",
        unsignedReminderEnabled: { $ne: false },
        clientEmail: { $nin: ["", null] },
        sentAt: { $lt: sentBefore },
        lastUnsignedReminderDate: { $ne: reminderDate },
        unsignedReminderProcessingDate: { $ne: reminderDate }
      },
      {
        $set: {
          unsignedReminderProcessingDate: reminderDate,
          unsignedReminderError: ""
        }
      },
      { new: true, sort: { sentAt: 1 } }
    );
    if (!terms) break;
    result.checked += 1;

    try {
      const delivery = await sendClientTermsUnsignedReminderEmail({
        terms,
        pdfBuffer: await generateClientTermsPdf(terms),
        fromEmail: terms.senderEmail,
        cc: terms.cc || []
      });
      if (!delivery.sent) throw new Error(delivery.reason || "Unsigned terms reminder could not be sent");

      terms.lastUnsignedReminderDate = reminderDate;
      terms.lastUnsignedReminderAt = date;
      terms.unsignedReminderCount = Number(terms.unsignedReminderCount || 0) + 1;
      terms.unsignedReminderStatus = "Sent";
      terms.unsignedReminderError = delivery.sentFolderError || "";
      terms.sentFolderSaved = Boolean(delivery.sentFolderSaved);
      terms.sentFolderError = delivery.sentFolderError || "";
      await terms.save();

      await EmailLog.create({
        fromEmail: delivery.fromEmail,
        fromName: "Innovex Resource Group Limited",
        to: [terms.clientEmail],
        cc: terms.cc || [],
        subject: delivery.subject,
        message: delivery.message,
        targetType: "ClientTerms",
        targetId: terms._id,
        status: "Sent",
        error: delivery.sentFolderError || "",
        sentBy: { name: "Client terms reminder automation", role: "system" }
      });
      result.sent += 1;
    } catch (error) {
      const reason = error.message || "Unsigned terms reminder failed";
      terms.unsignedReminderStatus = "Failed";
      terms.unsignedReminderError = reason;
      await terms.save().catch(() => undefined);
      await EmailLog.create({
        fromEmail: terms.senderEmail,
        fromName: "Innovex Resource Group Limited",
        to: [terms.clientEmail],
        cc: terms.cc || [],
        subject: `Action required: Terms of Business awaiting signature | ${terms.documentNumber}`,
        message: `Automatic unsigned terms reminder for ${terms.documentNumber}`,
        targetType: "ClientTerms",
        targetId: terms._id,
        status: "Failed",
        error: reason,
        sentBy: { name: "Client terms reminder automation", role: "system" }
      }).catch(() => undefined);
      result.failed += 1;
      result.errors.push({ documentNumber: terms.documentNumber, message: reason });
    }
  }

  return result;
}
