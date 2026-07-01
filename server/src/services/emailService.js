import nodemailer from "nodemailer";
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

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[character]));
}

function money(value) {
  return `£${Number(value || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function invoiceDate(value) {
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
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

export async function sendInvoiceEmail({ invoice, pdfBuffer, fromEmail, customMessage = "" }) {
  const account = senderAccountOrDefault(fromEmail || invoice.senderEmail);
  if (!account) return { sent: false, reason: "Selected sender mailbox is not configured" };
  const transporter = makeTransporter(account);
  const subject = `Invoice ${invoice.invoiceNumber} from Innovex Resource Group Limited`;
  const message = customMessage || `Please find attached invoice ${invoice.invoiceNumber} for ${money(invoice.total)}. Payment is due by ${invoiceDate(invoice.dueDate)}.`;
  await transporter.sendMail({
    from: formatSender(account),
    to: invoice.billingEmail,
    replyTo: account.address,
    subject,
    text: `${message}\n\nOutstanding balance: ${money(invoice.balanceDue)}\n\nKind regards,\nInnovex Resource Group Limited`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#173840"><p>Dear ${escapeHtml(invoice.contactName || invoice.clientName)},</p><p>${escapeHtml(message).replace(/\n/g, "<br />")}</p><div style="margin:22px 0;padding:16px;border-left:4px solid #f4b942;background:#f5fafa"><strong>Invoice ${escapeHtml(invoice.invoiceNumber)}</strong><br />Total: ${money(invoice.total)}<br />Outstanding: ${money(invoice.balanceDue)}<br />Due date: ${invoiceDate(invoice.dueDate)}</div><p>Kind regards,<br /><strong>Innovex Resource Group Limited</strong><br />0330 0435 830</p></div>`,
    attachments: [{ filename: `Innovex-Invoice-${invoice.invoiceNumber}.pdf`, content: pdfBuffer, contentType: "application/pdf" }]
  });
  return { sent: true, fromEmail: account.address, subject, message };
}

export async function sendInvoiceReminderEmail({ invoice, pdfBuffer, fromEmail }) {
  const account = senderAccountOrDefault(fromEmail || invoice.senderEmail);
  if (!account) return { sent: false, reason: "Selected sender mailbox is not configured" };
  const transporter = makeTransporter(account);
  const subject = `Payment reminder: Invoice ${invoice.invoiceNumber}`;
  const overdue = new Date(invoice.dueDate) < new Date();
  const timing = overdue ? `was due on ${invoiceDate(invoice.dueDate)}` : `is due on ${invoiceDate(invoice.dueDate)}`;
  await transporter.sendMail({
    from: formatSender(account),
    to: invoice.billingEmail,
    replyTo: account.address,
    subject,
    text: `This is a friendly payment reminder for invoice ${invoice.invoiceNumber}. The outstanding balance is ${money(invoice.balanceDue)} and ${timing}. Please disregard this message if payment has already been made.`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#173840"><p>Dear ${escapeHtml(invoice.contactName || invoice.clientName)},</p><p>This is a friendly payment reminder for invoice <strong>${escapeHtml(invoice.invoiceNumber)}</strong>.</p><div style="margin:22px 0;padding:16px;border-left:4px solid #f4b942;background:#f5fafa"><strong>Outstanding balance: ${money(invoice.balanceDue)}</strong><br />Payment ${timing}.</div><p>Please disregard this message if payment has already been made, or reply to this email if you have a query.</p><p>Kind regards,<br /><strong>Innovex Resource Group Limited</strong><br />0330 0435 830</p></div>`,
    attachments: [{ filename: `Innovex-Invoice-${invoice.invoiceNumber}.pdf`, content: pdfBuffer, contentType: "application/pdf" }]
  });
  return { sent: true, fromEmail: account.address, subject };
}
