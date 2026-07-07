import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import { ImapFlow } from "imapflow";
import { findEmailAccount } from "../config/emailAccounts.js";

const recipient = process.env.CONTACT_TO_EMAIL || "info@innovexresourcegroup.co.uk";

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function makeTransporter(account = null) {
  const config = account || {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  };

  return nodemailer.createTransport({
    host: config.host,
    port: Number(config.port || 587),
    secure: config.secure === true || config.secure === "true",
    auth: {
      user: config.user,
      pass: config.pass
    }
  });
}

function formatSender(account = null) {
  if (!account) return process.env.MAIL_FROM || process.env.SMTP_USER;
  return account.name ? `"${account.name}" <${account.address}>` : account.address;
}

function senderAccountOrDefault(fromEmail) {
  if (!fromEmail) return null;
  return findEmailAccount(fromEmail);
}

async function sendAndArchive(transporter, account, mailOptions) {
  const info = await transporter.sendMail(mailOptions);
  let sentFolderSaved = false;
  let sentFolderError = "";

  try {
    const raw = await new MailComposer(mailOptions).compile().build();
    const client = new ImapFlow({
      host: account.imapHost,
      port: account.imapPort || 993,
      secure: account.imapSecure !== false,
      auth: { user: account.user, pass: account.pass },
      logger: false
    });
    await client.connect();
    try {
      const mailboxes = await client.list();
      const sentMailbox = mailboxes.find((mailbox) => mailbox.specialUse === "\\Sent")
        || mailboxes.find((mailbox) => /(^|\/)sent( items| mail)?$/i.test(mailbox.path));
      if (!sentMailbox) throw new Error("Sent mailbox was not found");
      await client.append(sentMailbox.path, raw, ["\\Seen"], new Date());
      sentFolderSaved = true;
    } finally {
      await client.logout().catch(() => undefined);
    }
  } catch (error) {
    sentFolderError = error.message || "Unable to save a copy in Sent";
  }

  return { info, sentFolderSaved, sentFolderError };
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
}

function money(value) {
  return `£${Number(value || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function invoiceDate(value) {
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

function invoiceGreeting(invoice) {
  const contact = String(invoice.contactName || "").trim();
  return /[a-z]/i.test(contact) ? `Dear ${escapeHtml(contact)},` : "Hello,";
}

function systemEmailFooter() {
  return `<div style="margin-top:26px;padding-top:14px;border-top:1px solid #d8e5e7;color:#6b7f85;font-size:11px;line-height:1.5">This is a system-generated email from the Innovex Finance Centre. Please do not send payment information by email. For invoice queries, reply to this message or call 0330 0435 830.</div>`;
}

export async function sendContactEmail(message) {
  if (!hasSmtpConfig()) {
    return { sent: false, reason: "SMTP is not configured" };
  }

  const transporter = makeTransporter();
  const subject = `Website contact: ${message.subject}`;
  const text = [
    "New website contact form submission",
    "",
    `Name: ${message.name}`,
    `Email: ${message.email}`,
    `Phone: ${message.phone || "Not provided"}`,
    `Help needed: ${message.inquiryType || "General Enquiry"}`,
    `Subject: ${message.subject}`,
    "",
    "Message:",
    message.message
  ].join("\n");

  const html = `
    <h2>New website contact form submission</h2>
    <p><strong>Name:</strong> ${message.name}</p>
    <p><strong>Email:</strong> <a href="mailto:${message.email}">${message.email}</a></p>
    <p><strong>Phone:</strong> ${message.phone || "Not provided"}</p>
    <p><strong>Help needed:</strong> ${message.inquiryType || "General Enquiry"}</p>
    <p><strong>Subject:</strong> ${message.subject}</p>
    <hr />
    <p>${String(message.message).replace(/\n/g, "<br />")}</p>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: recipient,
    replyTo: message.email,
    subject,
    text,
    html
  });

  return { sent: true };
}

export async function sendInterviewReminderEmail(interview) {
  if (!hasSmtpConfig()) {
    return { sent: false, reason: "SMTP is not configured" };
  }

  const transporter = makeTransporter();
  const subject = "Interview reminder";
  const text = `Reminder: ${interview.candidateName} has an interview today for ${interview.jobTitle} at ${interview.interviewTime} with ${interview.clientName}.`;
  const html = `
    <h2>Interview reminder</h2>
    <p><strong>Reminder:</strong> ${interview.candidateName} has an interview today for ${interview.jobTitle} at ${interview.interviewTime} with ${interview.clientName}.</p>
    <p><strong>Candidate email:</strong> <a href="mailto:${interview.candidateEmail}">${interview.candidateEmail}</a></p>
    <p><strong>Candidate phone:</strong> ${interview.candidatePhone}</p>
    <p><strong>Interview type:</strong> ${interview.interviewType}</p>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: recipient,
    subject,
    text,
    html
  });

  return { sent: true };
}

export async function sendMeetingReminderEmail(meeting) {
  if (!hasSmtpConfig()) {
    return { sent: false, reason: "SMTP is not configured" };
  }

  const transporter = makeTransporter();
  const subject = "Meeting reminder";
  const text = `Reminder: ${meeting.attendeeName} has a ${meeting.meetingPurpose} meeting today at ${meeting.meetingTime} with ${meeting.companyName}.`;
  const html = `
    <h2>Meeting reminder</h2>
    <p><strong>Reminder:</strong> ${meeting.attendeeName} has a ${meeting.meetingPurpose} meeting today at ${meeting.meetingTime} with ${meeting.companyName}.</p>
    <p><strong>Meeting:</strong> ${meeting.meetingTitle}</p>
    <p><strong>Company:</strong> ${meeting.companyName}</p>
    <p><strong>Attendee:</strong> ${meeting.attendeeName}</p>
    <p><strong>Email:</strong> ${meeting.attendeeEmail ? `<a href="mailto:${meeting.attendeeEmail}">${meeting.attendeeEmail}</a>` : "Not provided"}</p>
    <p><strong>Phone:</strong> ${meeting.attendeePhone || "Not provided"}</p>
    <p><strong>Type:</strong> ${meeting.meetingType}</p>
    ${meeting.notes ? `<p><strong>Notes:</strong> ${String(meeting.notes).replace(/\n/g, "<br />")}</p>` : ""}
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: recipient,
    subject,
    text,
    html
  });

  return { sent: true };
}

export async function sendTrainingEnquiryEmail(booking) {
  if (!hasSmtpConfig()) {
    return { sent: false, reason: "SMTP is not configured" };
  }

  const transporter = makeTransporter();
  const courseList = booking.selectedCourses?.map((course) => course.title).join(", ") || "Not provided";
  const preferredSlot = [
    booking.trainingDate ? new Date(booking.trainingDate).toLocaleDateString("en-GB") : "Flexible date",
    booking.trainingStartTime || "Flexible time"
  ].join(" at ");
  const subject = `Training course enquiry: ${booking.clientName}`;
  const text = [
    "New healthcare training course enquiry",
    "",
    `Client/company: ${booking.clientName}`,
    `Contact person: ${booking.contactPersonName}`,
    `Email: ${booking.email}`,
    `Phone: ${booking.phone || "Not provided"}`,
    `Location/address: ${booking.address || "Not provided"}`,
    `Courses: ${courseList}`,
    `Delegates: ${booking.numberOfDelegates || "Not provided"}`,
    `Preferred slot: ${preferredSlot}`,
    "",
    "Notes:",
    booking.notes || "No extra notes provided"
  ].join("\n");

  const html = `
    <h2>New healthcare training course enquiry</h2>
    <p><strong>Client/company:</strong> ${booking.clientName}</p>
    <p><strong>Contact person:</strong> ${booking.contactPersonName}</p>
    <p><strong>Email:</strong> <a href="mailto:${booking.email}">${booking.email}</a></p>
    <p><strong>Phone:</strong> ${booking.phone || "Not provided"}</p>
    <p><strong>Location/address:</strong> ${booking.address || "Not provided"}</p>
    <p><strong>Selected courses:</strong> ${courseList}</p>
    <p><strong>Delegates:</strong> ${booking.numberOfDelegates || "Not provided"}</p>
    <p><strong>Preferred slot:</strong> ${preferredSlot}</p>
    <hr />
    <p>${String(booking.notes || "No extra notes provided").replace(/\n/g, "<br />")}</p>
  `;

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: recipient,
    replyTo: booking.email,
    subject,
    text,
    html
  });

  return { sent: true };
}

export async function sendCandidateOutreachEmail({ candidate, subject, message, replyTo, fromEmail }) {
  const account = senderAccountOrDefault(fromEmail);
  if (!account && !hasSmtpConfig()) {
    return { sent: false, reason: "SMTP is not configured" };
  }

  if (!candidate.email) {
    return { sent: false, reason: "Candidate email is missing" };
  }

  const transporter = makeTransporter(account);
  const safeMessage = String(message || "").replace(/\n/g, "<br />");

  await transporter.sendMail({
    from: formatSender(account),
    to: candidate.email,
    replyTo: replyTo || account?.address || recipient,
    subject,
    text: message,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#10242c">
        <p>${safeMessage}</p>
        <hr style="border:none;border-top:1px solid #dce8eb;margin:20px 0" />
        <p style="font-size:13px;color:#667985">
          Innovex Resource Group Limited<br />
          ${account?.address || "info@innovexresourcegroup.co.uk"}
        </p>
      </div>
    `
  });

  return { sent: true };
}

export async function sendBusinessLeadOutreachEmail({ lead, subject, message, replyTo, fromEmail }) {
  const account = senderAccountOrDefault(fromEmail);
  if (!account && !hasSmtpConfig()) {
    return { sent: false, reason: "SMTP is not configured" };
  }

  const emails = Array.isArray(lead.emails) ? lead.emails.map((item) => item.email).filter(Boolean) : [];
  if (!emails.length) {
    return { sent: false, reason: "Business lead email is missing" };
  }

  const transporter = makeTransporter(account);
  const safeMessage = String(message || "").replace(/\n/g, "<br />");

  await transporter.sendMail({
    from: formatSender(account),
    to: emails[0],
    bcc: emails.slice(1),
    replyTo: replyTo || account?.address || recipient,
    subject,
    text: message,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#10242c">
        <p>${safeMessage}</p>
        <hr style="border:none;border-top:1px solid #dce8eb;margin:20px 0" />
        <p style="font-size:13px;color:#667985">
          Innovex Resource Group Limited<br />
          ${account?.address || "info@innovexresourcegroup.co.uk"}
        </p>
      </div>
    `
  });

  return { sent: true };
}

export async function sendComposedEmail({ fromEmail, to = [], cc = [], bcc = [], subject, message, replyTo }) {
  const account = senderAccountOrDefault(fromEmail);
  if (!account) {
    return { sent: false, reason: "Selected sender mailbox is not configured" };
  }

  const transporter = makeTransporter(account);
  const safeMessage = String(message || "").replace(/\n/g, "<br />");

  await transporter.sendMail({
    from: formatSender(account),
    to,
    cc,
    bcc,
    replyTo: replyTo || account.address,
    subject,
    text: message,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#10242c">
        <p>${safeMessage}</p>
        <hr style="border:none;border-top:1px solid #dce8eb;margin:20px 0" />
        <p style="font-size:13px;color:#667985">
          Innovex Resource Group Limited<br />
          ${account.address}
        </p>
      </div>
    `
  });

  return { sent: true };
}

export async function sendInvoiceEmail({ invoice, pdfBuffer, fromEmail, customMessage = "", cc = [] }) {
  const account = senderAccountOrDefault(fromEmail || invoice.senderEmail);
  if (!account) return { sent: false, reason: "Selected sender mailbox is not configured" };
  const transporter = makeTransporter(account);
  const subject = `Invoice ${invoice.invoiceNumber} | Innovex Resource Group Limited`;
  const message = customMessage || `Please find attached invoice ${invoice.invoiceNumber} for services provided by Innovex Resource Group Limited. The invoice total is ${money(invoice.total)}, due by ${invoiceDate(invoice.dueDate)}.`;
  const mailOptions = {
    from: formatSender(account),
    to: invoice.billingEmail,
    cc,
    replyTo: account.address,
    subject,
    text: `${message}\n\nInvoice: ${invoice.invoiceNumber}\nClient: ${invoice.clientName}\nTotal: ${money(invoice.total)}\nBalance due: ${money(invoice.balanceDue)}\nDue date: ${invoiceDate(invoice.dueDate)}\n\nKind regards,\nInnovex Resource Group Limited\n\nThis is a system-generated email from the Innovex Finance Centre.`,
    html: `<div style="margin:0;background:#f3f8f8;padding:28px 12px;font-family:Arial,sans-serif;color:#173840"><div style="max-width:620px;margin:auto;background:#ffffff;border:1px solid #d8e5e7;border-radius:14px;overflow:hidden"><div style="height:7px;background:#f4b942"></div><div style="background:#064f5e;padding:22px 28px;color:#ffffff"><div style="font-size:12px;letter-spacing:1.5px;font-weight:700;color:#b9d8dc">INNOVEX RESOURCE GROUP LIMITED</div><div style="font-size:22px;font-weight:700;margin-top:6px">Invoice ${escapeHtml(invoice.invoiceNumber)}</div></div><div style="padding:26px 28px"><p style="margin-top:0">${invoiceGreeting(invoice)}</p><p style="line-height:1.65">${escapeHtml(message).replace(/\n/g, "<br />")}</p><table role="presentation" style="width:100%;margin:22px 0;border-collapse:separate;border-spacing:0;background:#eef7f7;border-radius:10px"><tr><td style="padding:16px 18px;color:#60777e;font-size:12px">INVOICE TOTAL<br><strong style="display:block;color:#173840;font-size:18px;margin-top:5px">${money(invoice.total)}</strong></td><td style="padding:16px 18px;color:#60777e;font-size:12px">BALANCE DUE<br><strong style="display:block;color:#173840;font-size:18px;margin-top:5px">${money(invoice.balanceDue)}</strong></td><td style="padding:16px 18px;color:#60777e;font-size:12px">DUE DATE<br><strong style="display:block;color:#173840;font-size:14px;margin-top:7px">${invoiceDate(invoice.dueDate)}</strong></td></tr></table><p style="line-height:1.6">The PDF invoice is attached to this email. Please use <strong>${escapeHtml(invoice.invoiceNumber)}</strong> as your payment reference.</p><p style="margin:24px 0 0">Kind regards,<br><strong>Innovex Resource Group Limited</strong><br><span style="color:#60777e">0330 0435 830 &nbsp;|&nbsp; info@innovexresourcegroup.co.uk</span></p>${systemEmailFooter()}</div></div></div>`,
    attachments: [{ filename: `Innovex-Invoice-${invoice.invoiceNumber}.pdf`, content: pdfBuffer, contentType: "application/pdf" }]
  };
  const archive = await sendAndArchive(transporter, account, mailOptions);
  return { sent: true, fromEmail: account.address, subject, message, cc, ...archive };
}

export async function sendInvoiceReminderEmail({ invoice, pdfBuffer, fromEmail, cc = [] }) {
  const account = senderAccountOrDefault(fromEmail || invoice.senderEmail);
  if (!account) return { sent: false, reason: "Selected sender mailbox is not configured" };
  const transporter = makeTransporter(account);
  const subject = `Payment reminder: Invoice ${invoice.invoiceNumber}`;
  const overdue = new Date(invoice.dueDate) < new Date();
  const timing = overdue ? `was due on ${invoiceDate(invoice.dueDate)}` : `is due on ${invoiceDate(invoice.dueDate)}`;
  const mailOptions = {
    from: formatSender(account),
    to: invoice.billingEmail,
    cc,
    replyTo: account.address,
    subject,
    text: `This is a friendly payment reminder for invoice ${invoice.invoiceNumber}. The outstanding balance is ${money(invoice.balanceDue)} and ${timing}. Please disregard this message if payment has already been made.\n\nThis is a system-generated email from the Innovex Finance Centre.`,
    html: `<div style="margin:0;background:#f3f8f8;padding:28px 12px;font-family:Arial,sans-serif;color:#173840"><div style="max-width:620px;margin:auto;background:#ffffff;border:1px solid #d8e5e7;border-radius:14px;overflow:hidden"><div style="height:7px;background:#f4b942"></div><div style="background:#064f5e;padding:22px 28px;color:#ffffff"><div style="font-size:12px;letter-spacing:1.5px;font-weight:700;color:#b9d8dc">INNOVEX RESOURCE GROUP LIMITED</div><div style="font-size:22px;font-weight:700;margin-top:6px">Payment reminder</div></div><div style="padding:26px 28px"><p style="margin-top:0">${invoiceGreeting(invoice)}</p><p>This is a friendly reminder regarding invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong>.</p><div style="margin:22px 0;padding:18px;border-left:4px solid #f4b942;background:#eef7f7;border-radius:4px"><div style="font-size:12px;color:#60777e">OUTSTANDING BALANCE</div><strong style="display:block;font-size:22px;margin:5px 0">${money(invoice.balanceDue)}</strong><span>Payment ${timing}.</span></div><p>Please disregard this message if payment has already been made. If you have a query, reply to this email and our team will assist you.</p><p style="margin:24px 0 0">Kind regards,<br><strong>Innovex Resource Group Limited</strong><br><span style="color:#60777e">0330 0435 830 &nbsp;|&nbsp; info@innovexresourcegroup.co.uk</span></p>${systemEmailFooter()}</div></div></div>`,
    attachments: [{ filename: `Innovex-Invoice-${invoice.invoiceNumber}.pdf`, content: pdfBuffer, contentType: "application/pdf" }]
  };
  const archive = await sendAndArchive(transporter, account, mailOptions);
  return { sent: true, fromEmail: account.address, subject, cc, ...archive };
}

export async function sendClientTermsEmail({ terms, pdfBuffer, fromEmail, customMessage = "", cc = [] }) {
  const account = senderAccountOrDefault(fromEmail || terms.senderEmail);
  if (!account) return { sent: false, reason: "Selected sender mailbox is not configured" };

  const transporter = makeTransporter(account);
  const subject = `Terms of Business | ${terms.clientName} | Innovex Resource Group Limited`;
  const message = customMessage || `Please find attached the Terms of Business prepared for ${terms.clientName}. These include the agreed commercial schedule, role rates, payment terms and rebate details for Innovex Resource Group Limited services.`;
  const dueSummary = `${terms.paymentDueDays || 0} days from invoice date`;
  const roleSummary = (terms.roleRates || [])
    .map((rate) => `${rate.roleTitle}: ${rate.feeType} ${rate.rateValue || 0}${rate.feeType === "Percentage" ? "%" : ""}`)
    .join("\n");

  const mailOptions = {
    from: formatSender(account),
    to: terms.clientEmail,
    cc,
    replyTo: account.address,
    subject,
    text: `${message}\n\nClient: ${terms.clientName}\nDocument: ${terms.documentNumber}\nPayment terms: ${dueSummary}\nRebate period: ${terms.rebatePeriodDays || 0} days\n\n${roleSummary ? `Role rates:\n${roleSummary}\n\n` : ""}Kind regards,\nInnovex Resource Group Limited\n\nThis is a system-generated email from the Innovex Client Terms Centre.`,
    html: `<div style="margin:0;background:#f3f8f8;padding:28px 12px;font-family:Arial,sans-serif;color:#173840"><div style="max-width:650px;margin:auto;background:#ffffff;border:1px solid #d8e5e7;border-radius:14px;overflow:hidden"><div style="height:7px;background:#f4b942"></div><div style="background:#064f5e;padding:22px 28px;color:#ffffff"><div style="font-size:12px;letter-spacing:1.5px;font-weight:700;color:#b9d8dc">INNOVEX RESOURCE GROUP LIMITED</div><div style="font-size:22px;font-weight:700;margin-top:6px">Terms of Business</div></div><div style="padding:26px 28px"><p style="margin-top:0">Hello,</p><p style="line-height:1.65">${escapeHtml(message).replace(/\n/g, "<br />")}</p><table role="presentation" style="width:100%;margin:22px 0;border-collapse:separate;border-spacing:0;background:#eef7f7;border-radius:10px"><tr><td style="padding:16px 18px;color:#60777e;font-size:12px">DOCUMENT<br><strong style="display:block;color:#173840;font-size:15px;margin-top:6px">${escapeHtml(terms.documentNumber)}</strong></td><td style="padding:16px 18px;color:#60777e;font-size:12px">PAYMENT TERMS<br><strong style="display:block;color:#173840;font-size:15px;margin-top:6px">${escapeHtml(dueSummary)}</strong></td><td style="padding:16px 18px;color:#60777e;font-size:12px">REBATE PERIOD<br><strong style="display:block;color:#173840;font-size:15px;margin-top:6px">${Number(terms.rebatePeriodDays || 0)} days</strong></td></tr></table><p style="line-height:1.6">The PDF document is attached. Please review the terms and reply to this email if you would like any amendment before signing.</p><p style="margin:24px 0 0">Kind regards,<br><strong>Innovex Resource Group Limited</strong><br><span style="color:#60777e">0330 0435 830 &nbsp;|&nbsp; info@innovexresourcegroup.co.uk</span></p><div style="margin-top:26px;padding-top:14px;border-top:1px solid #d8e5e7;color:#6b7f85;font-size:11px;line-height:1.5">This is a system-generated email from the Innovex Client Terms Centre. If the attachment does not open, please reply and our team will resend it.</div></div></div></div>`,
    attachments: [{ filename: `Innovex-Terms-${terms.documentNumber}.pdf`, content: pdfBuffer, contentType: "application/pdf" }]
  };

  const archive = await sendAndArchive(transporter, account, mailOptions);
  return { sent: true, fromEmail: account.address, subject, message, cc, ...archive };
}
