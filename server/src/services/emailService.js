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
        || mailboxes.find((mailbox) => /(^|[./])sent( items| mail| messages)?$/i.test(mailbox.path));
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

function crmComplianceFooterText(source = "Innovex Outreach Centre", hasAttachment = false) {
  const attachmentLine = hasAttachment ? "If the attachment does not open, please reply and our team will resend it. " : "";
  return `This is a system-generated email from the ${source}. ${attachmentLine}This email and any attachments are confidential and intended solely for the named recipient. If you have received it in error, please notify us and delete it from your system. Innovex Resource Group Limited processes personal data in accordance with the UK GDPR and the Data Protection Act 2018. If you would prefer not to receive emails from us, please reply with the word UNSUBSCRIBE.`;
}

function crmComplianceFooterHtml(source = "Innovex Outreach Centre", hasAttachment = false) {
  return `<div style="margin-top:26px;padding-top:14px;border-top:1px solid #d8e5e7;color:#6b7f85;font-size:11px;line-height:1.55">${escapeHtml(crmComplianceFooterText(source, hasAttachment))}</div>`;
}

function messageHtml(message = "") {
  return escapeHtml(message).replace(/\n/g, "<br />");
}

function interviewDate(value) {
  if (!value) return "To be confirmed";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London"
  }).format(date);
}

function interviewTime(value) {
  const match = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!match) return value || "To be confirmed";
  const hour = Number(match[1]);
  const period = hour >= 12 ? "pm" : "am";
  return `${hour % 12 || 12}:${match[2]} ${period}`;
}

function interviewAddress(interview) {
  return [interview.careHomeAddress, interview.careHomePostcode].filter(Boolean).join("\n");
}

export function buildInterviewConfirmationEmail(interview) {
  const formattedDate = interviewDate(interview.interviewDate);
  const formattedTime = interviewTime(interview.interviewTime);
  const address = interviewAddress(interview);
  const subject = `Interview confirmed – ${interview.jobTitle} with ${interview.clientName}`;
  const replyRequest = "Please reply to this email to confirm your attendance. Your reply is required so that we can update our interview records.";
  const detailLines = [
    `Role: ${interview.jobTitle}`,
    `Care home / employer: ${interview.clientName}`,
    `Date: ${formattedDate}`,
    `Time: ${formattedTime}`,
    `Interview format: ${interview.interviewType}`
  ];
  if (address) detailLines.push(`Address: ${address}`);
  if (interview.careHomeContactName) detailLines.push(`Care home contact: ${interview.careHomeContactName}`);
  if (interview.careHomeContactPhone) detailLines.push(`Care home telephone: ${interview.careHomeContactPhone}`);
  if (interview.interviewInstructions) detailLines.push(`Joining / arrival instructions: ${interview.interviewInstructions}`);

  const text = [
    `Dear ${interview.candidateName},`,
    "",
    "YOUR INTERVIEW IS CONFIRMED AND BOOKED",
    "",
    `We are pleased to confirm that your interview for the ${interview.jobTitle} position with ${interview.clientName} has been successfully booked.`,
    "",
    ...detailLines,
    "",
    "ACTION REQUIRED – PLEASE REPLY",
    replyRequest,
    "You can simply reply with: “I confirm my attendance.”",
    "",
    "Please arrive or join 10 minutes early and keep this email for reference. If you need to change the appointment or have any questions, reply to this email as soon as possible.",
    "",
    "Kind regards,",
    "Recruitment Team",
    "Innovex Resource Group Limited",
    "0330 0435 830",
    "info@innovexresourcegroup.co.uk"
  ].join("\n");

  const locationHtml = address || interview.careHomeContactName || interview.careHomeContactPhone
    ? `<div style="margin:20px 0;padding:18px;border:1px solid #d7e9ed;border-radius:12px;background:#f7fbfc">
        <div style="margin-bottom:9px;color:#0b5f75;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Care home / interview location</div>
        <strong style="display:block;color:#063f4f;font-size:17px">${escapeHtml(interview.clientName)}</strong>
        ${address ? `<div style="margin-top:9px;color:#304b54;line-height:1.6">${messageHtml(address)}</div>` : ""}
        ${interview.careHomeContactName ? `<div style="margin-top:9px;color:#304b54"><strong>Contact:</strong> ${escapeHtml(interview.careHomeContactName)}</div>` : ""}
        ${interview.careHomeContactPhone ? `<div style="margin-top:5px;color:#304b54"><strong>Telephone:</strong> ${escapeHtml(interview.careHomeContactPhone)}</div>` : ""}
      </div>`
    : "";
  const instructionsHtml = interview.interviewInstructions
    ? `<div style="margin:20px 0;padding:16px 18px;border-left:4px solid #0b5f75;border-radius:8px;background:#eef7f7">
        <strong style="display:block;margin-bottom:7px;color:#063f4f">Joining / arrival instructions</strong>
        <div style="color:#304b54;line-height:1.6">${messageHtml(interview.interviewInstructions)}</div>
      </div>`
    : "";

  const html = `<div style="margin:0;padding:30px 12px;background:#eef5f6;font-family:Arial,sans-serif;color:#173840">
    <div style="max-width:660px;margin:auto;overflow:hidden;border:1px solid #d3e3e6;border-radius:16px;background:#ffffff;box-shadow:0 18px 45px rgba(6,63,79,.10)">
      <div style="height:7px;background:#f4b942"></div>
      <div style="padding:26px 30px;background:linear-gradient(135deg,#063f4f,#0b5f75);color:#ffffff">
        <div style="color:#bde0e4;font-size:11px;font-weight:700;letter-spacing:.14em">INNOVEX RESOURCE GROUP LIMITED</div>
        <div style="margin-top:14px"><span style="display:inline-block;padding:7px 11px;border-radius:999px;background:#f4b942;color:#173840;font-size:11px;font-weight:800;letter-spacing:.08em">INTERVIEW CONFIRMED</span></div>
        <h1 style="margin:14px 0 0;color:#ffffff;font-size:27px;line-height:1.25">Your interview is confirmed and booked</h1>
      </div>
      <div style="padding:28px 30px">
        <p style="margin-top:0;font-size:16px">Dear ${escapeHtml(interview.candidateName)},</p>
        <p style="line-height:1.7">We are pleased to confirm that your interview for the <strong>${escapeHtml(interview.jobTitle)}</strong> position with <strong>${escapeHtml(interview.clientName)}</strong> has been successfully booked.</p>
        <table role="presentation" style="width:100%;margin:22px 0;border-collapse:separate;border-spacing:0;overflow:hidden;border:1px solid #d7e9ed;border-radius:12px">
          <tr><td style="width:34%;padding:12px 15px;border-bottom:1px solid #d7e9ed;background:#f7fbfc;color:#60777e;font-size:12px;font-weight:700">ROLE</td><td style="padding:12px 15px;border-bottom:1px solid #d7e9ed;font-weight:700">${escapeHtml(interview.jobTitle)}</td></tr>
          <tr><td style="padding:12px 15px;border-bottom:1px solid #d7e9ed;background:#f7fbfc;color:#60777e;font-size:12px;font-weight:700">DATE</td><td style="padding:12px 15px;border-bottom:1px solid #d7e9ed;font-weight:700">${escapeHtml(formattedDate)}</td></tr>
          <tr><td style="padding:12px 15px;border-bottom:1px solid #d7e9ed;background:#f7fbfc;color:#60777e;font-size:12px;font-weight:700">TIME</td><td style="padding:12px 15px;border-bottom:1px solid #d7e9ed;font-weight:700">${escapeHtml(formattedTime)}</td></tr>
          <tr><td style="padding:12px 15px;background:#f7fbfc;color:#60777e;font-size:12px;font-weight:700">FORMAT</td><td style="padding:12px 15px;font-weight:700">${escapeHtml(interview.interviewType)}</td></tr>
        </table>
        ${locationHtml}
        ${instructionsHtml}
        <div style="margin:24px 0;padding:20px;border:2px solid #f4b942;border-radius:12px;background:#fff8e8">
          <div style="color:#8a5b00;font-size:12px;font-weight:800;letter-spacing:.08em">ACTION REQUIRED – PLEASE REPLY</div>
          <p style="margin:9px 0 0;color:#3f3217;font-weight:700;line-height:1.65">${escapeHtml(replyRequest)}</p>
          <p style="margin:8px 0 0;color:#5d4b25;line-height:1.55">You can simply reply with: <strong>“I confirm my attendance.”</strong></p>
        </div>
        <p style="line-height:1.7">Please arrive or join 10 minutes early and keep this email for reference. If you need to change the appointment or have any questions, reply to this email as soon as possible.</p>
        <p style="margin:26px 0 0;line-height:1.6">Kind regards,<br><strong>Recruitment Team</strong><br><strong>Innovex Resource Group Limited</strong><br><span style="color:#60777e">0330 0435 830 &nbsp;|&nbsp; info@innovexresourcegroup.co.uk</span></p>
        <div style="margin-top:24px;padding-top:14px;border-top:1px solid #d8e5e7;color:#6b7f85;font-size:11px;line-height:1.55">This is a system-generated interview confirmation. It contains confidential information intended for the named recipient. If you received it in error, please notify Innovex Resource Group Limited and delete it.</div>
      </div>
    </div>
  </div>`;

  return {
    from: formatSender(),
    to: interview.candidateEmail,
    replyTo: recipient,
    subject,
    text,
    html
  };
}

export function buildCandidateInterviewReminderEmail(interview) {
  const formattedDate = interviewDate(interview.interviewDate);
  const formattedTime = interviewTime(interview.interviewTime);
  const address = interviewAddress(interview);
  const subject = `Interview reminder for tomorrow – ${interview.jobTitle} with ${interview.clientName}`;
  const locationText = address ? `\nAddress: ${address}` : "";
  const contactText = interview.careHomeContactName ? `\nCare home contact: ${interview.careHomeContactName}` : "";
  const phoneText = interview.careHomeContactPhone ? `\nCare home telephone: ${interview.careHomeContactPhone}` : "";
  const instructionsText = interview.interviewInstructions ? `\nJoining / arrival instructions: ${interview.interviewInstructions}` : "";
  const text = [
    `Dear ${interview.candidateName},`,
    "",
    "REMINDER: YOUR INTERVIEW IS TOMORROW",
    "",
    `This is a reminder that your confirmed interview for the ${interview.jobTitle} position with ${interview.clientName} is scheduled for tomorrow.`,
    "",
    `Date: ${formattedDate}`,
    `Time: ${formattedTime}`,
    `Interview format: ${interview.interviewType}`,
    `Care home / employer: ${interview.clientName}${locationText}${contactText}${phoneText}${instructionsText}`,
    "",
    "Please arrive or join 10 minutes early and keep this email available for reference.",
    "",
    "If you have not already confirmed your attendance, please reply to this email now. If you are unable to attend or any detail appears incorrect, contact us immediately by replying to this email or calling 0330 0435 830.",
    "",
    "Kind regards,",
    "Recruitment Team",
    "Innovex Resource Group Limited",
    "0330 0435 830",
    "info@innovexresourcegroup.co.uk"
  ].join("\n");

  const locationHtml = address || interview.careHomeContactName || interview.careHomeContactPhone
    ? `<div style="margin:20px 0;padding:18px;border:1px solid #d7e9ed;border-radius:12px;background:#f7fbfc">
        <div style="margin-bottom:9px;color:#0b5f75;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase">Care home / interview location</div>
        <strong style="display:block;color:#063f4f;font-size:17px">${escapeHtml(interview.clientName)}</strong>
        ${address ? `<div style="margin-top:9px;color:#304b54;line-height:1.6">${messageHtml(address)}</div>` : ""}
        ${interview.careHomeContactName ? `<div style="margin-top:9px;color:#304b54"><strong>Contact:</strong> ${escapeHtml(interview.careHomeContactName)}</div>` : ""}
        ${interview.careHomeContactPhone ? `<div style="margin-top:5px;color:#304b54"><strong>Telephone:</strong> ${escapeHtml(interview.careHomeContactPhone)}</div>` : ""}
      </div>`
    : "";
  const instructionsHtml = interview.interviewInstructions
    ? `<div style="margin:20px 0;padding:16px 18px;border-left:4px solid #0b5f75;border-radius:8px;background:#eef7f7">
        <strong style="display:block;margin-bottom:7px;color:#063f4f">Joining / arrival instructions</strong>
        <div style="color:#304b54;line-height:1.6">${messageHtml(interview.interviewInstructions)}</div>
      </div>`
    : "";
  const html = `<div style="margin:0;padding:30px 12px;background:#eef5f6;font-family:Arial,sans-serif;color:#173840">
    <div style="max-width:660px;margin:auto;overflow:hidden;border:1px solid #d3e3e6;border-radius:16px;background:#ffffff;box-shadow:0 18px 45px rgba(6,63,79,.10)">
      <div style="height:7px;background:#f4b942"></div>
      <div style="padding:26px 30px;background:linear-gradient(135deg,#063f4f,#0b5f75);color:#ffffff">
        <div style="color:#bde0e4;font-size:11px;font-weight:700;letter-spacing:.14em">INNOVEX RESOURCE GROUP LIMITED</div>
        <div style="margin-top:14px"><span style="display:inline-block;padding:7px 11px;border-radius:999px;background:#f4b942;color:#173840;font-size:11px;font-weight:800;letter-spacing:.08em">INTERVIEW REMINDER</span></div>
        <h1 style="margin:14px 0 0;color:#ffffff;font-size:27px;line-height:1.25">Your interview is tomorrow</h1>
      </div>
      <div style="padding:28px 30px">
        <p style="margin-top:0;font-size:16px">Dear ${escapeHtml(interview.candidateName)},</p>
        <p style="line-height:1.7">This is a reminder that your confirmed interview for the <strong>${escapeHtml(interview.jobTitle)}</strong> position with <strong>${escapeHtml(interview.clientName)}</strong> is scheduled for tomorrow.</p>
        <table role="presentation" style="width:100%;margin:22px 0;border-collapse:separate;border-spacing:0;overflow:hidden;border:1px solid #d7e9ed;border-radius:12px">
          <tr><td style="width:34%;padding:12px 15px;border-bottom:1px solid #d7e9ed;background:#f7fbfc;color:#60777e;font-size:12px;font-weight:700">DATE</td><td style="padding:12px 15px;border-bottom:1px solid #d7e9ed;font-weight:700">${escapeHtml(formattedDate)}</td></tr>
          <tr><td style="padding:12px 15px;border-bottom:1px solid #d7e9ed;background:#f7fbfc;color:#60777e;font-size:12px;font-weight:700">TIME</td><td style="padding:12px 15px;border-bottom:1px solid #d7e9ed;font-weight:700">${escapeHtml(formattedTime)}</td></tr>
          <tr><td style="padding:12px 15px;border-bottom:1px solid #d7e9ed;background:#f7fbfc;color:#60777e;font-size:12px;font-weight:700">ROLE</td><td style="padding:12px 15px;border-bottom:1px solid #d7e9ed;font-weight:700">${escapeHtml(interview.jobTitle)}</td></tr>
          <tr><td style="padding:12px 15px;background:#f7fbfc;color:#60777e;font-size:12px;font-weight:700">FORMAT</td><td style="padding:12px 15px;font-weight:700">${escapeHtml(interview.interviewType)}</td></tr>
        </table>
        ${locationHtml}
        ${instructionsHtml}
        <div style="margin:24px 0;padding:20px;border:2px solid #f4b942;border-radius:12px;background:#fff8e8">
          <strong style="display:block;color:#8a5b00;font-size:12px;letter-spacing:.08em">BE READY 10 MINUTES EARLY</strong>
          <p style="margin:9px 0 0;color:#3f3217;line-height:1.65">Please keep this email available for reference. If you have not already confirmed attendance, reply now. If you cannot attend or any detail is incorrect, contact us immediately.</p>
        </div>
        <p style="margin:26px 0 0;line-height:1.6">Kind regards,<br><strong>Recruitment Team</strong><br><strong>Innovex Resource Group Limited</strong><br><span style="color:#60777e">0330 0435 830 &nbsp;|&nbsp; info@innovexresourcegroup.co.uk</span></p>
        <div style="margin-top:24px;padding-top:14px;border-top:1px solid #d8e5e7;color:#6b7f85;font-size:11px;line-height:1.55">This is an automatic one-day interview reminder intended for the named recipient. If you received it in error, please notify Innovex Resource Group Limited and delete it.</div>
      </div>
    </div>
  </div>`;

  return {
    from: formatSender(),
    to: interview.candidateEmail,
    replyTo: recipient,
    subject,
    text,
    html
  };
}

export function buildCandidateInterviewFollowUpEmail(interview) {
  const formattedDate = interviewDate(interview.interviewDate);
  const email = buildCandidateInterviewReminderEmail(interview);
  const reminderSentence = `This is a reminder that your confirmed interview for the ${interview.jobTitle} position with ${interview.clientName} is scheduled for tomorrow.`;
  const followUpSentence = `This is a follow-up regarding your confirmed interview for the ${interview.jobTitle} position with ${interview.clientName}, scheduled for ${formattedDate}.`;
  const reminderHtml = `This is a reminder that your confirmed interview for the <strong>${escapeHtml(interview.jobTitle)}</strong> position with <strong>${escapeHtml(interview.clientName)}</strong> is scheduled for tomorrow.`;
  const followUpHtml = `This is a professional follow-up regarding your confirmed interview for the <strong>${escapeHtml(interview.jobTitle)}</strong> position with <strong>${escapeHtml(interview.clientName)}</strong>, scheduled for <strong>${escapeHtml(formattedDate)}</strong>.`;

  return {
    ...email,
    subject: `Interview follow-up - ${interview.jobTitle} with ${interview.clientName}`,
    text: email.text
      .replace("REMINDER: YOUR INTERVIEW IS TOMORROW", "INTERVIEW FOLLOW-UP")
      .replace(reminderSentence, followUpSentence),
    html: email.html
      .replace("INTERVIEW REMINDER", "INTERVIEW FOLLOW-UP")
      .replace("Your interview is tomorrow", "Your interview follow-up")
      .replace(reminderHtml, followUpHtml)
      .replace("This is an automatic one-day interview reminder", "This is an interview follow-up")
  };
}

async function deliverMail(transporter, account, mailOptions) {
  if (account?.imapHost && account?.imapPort && account?.user && account?.pass) {
    return sendAndArchive(transporter, account, mailOptions);
  }
  const info = await transporter.sendMail(mailOptions);
  return {
    info,
    sentFolderSaved: false,
    sentFolderError: account ? "IMAP Sent folder is not configured for this sender" : ""
  };
}

export async function sendInterviewConfirmationEmail(interview) {
  if (!hasSmtpConfig()) {
    return { sent: false, reason: "SMTP is not configured" };
  }

  const mailOptions = buildInterviewConfirmationEmail(interview);
  const delivery = await deliverMail(makeTransporter(), null, mailOptions);
  return { sent: true, subject: mailOptions.subject, ...delivery };
}

export async function sendCandidateInterviewReminderEmail(interview) {
  if (!hasSmtpConfig()) {
    return { sent: false, reason: "SMTP is not configured" };
  }

  const mailOptions = buildCandidateInterviewReminderEmail(interview);
  const delivery = await deliverMail(makeTransporter(), null, mailOptions);
  return { sent: true, subject: mailOptions.subject, ...delivery };
}

export async function sendCandidateInterviewFollowUpEmail(interview) {
  if (!hasSmtpConfig()) {
    return { sent: false, reason: "SMTP is not configured" };
  }

  const mailOptions = buildCandidateInterviewFollowUpEmail(interview);
  const delivery = await deliverMail(makeTransporter(), null, mailOptions);
  return { sent: true, subject: mailOptions.subject, ...delivery };
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
  const source = "Innovex Outreach Centre";
  const mailOptions = {
    from: formatSender(account),
    to: candidate.email,
    replyTo: replyTo || account?.address || recipient,
    subject,
    text: `${message}\n\nKind regards,\nInnovex Resource Group Limited\n${account?.address || "info@innovexresourcegroup.co.uk"}\n\n${crmComplianceFooterText(source)}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#10242c">
        <p>${messageHtml(message)}</p>
        <hr style="border:none;border-top:1px solid #dce8eb;margin:20px 0" />
        <p style="font-size:13px;color:#667985">
          Innovex Resource Group Limited<br />
          ${account?.address || "info@innovexresourcegroup.co.uk"}
        </p>
        ${crmComplianceFooterHtml(source)}
      </div>
    `
  };
  const archive = await deliverMail(transporter, account, mailOptions);

  return { sent: true, ...archive };
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
  const source = "Innovex Business Outreach Centre";
  const mailOptions = {
    from: formatSender(account),
    to: emails[0],
    bcc: emails.slice(1),
    replyTo: replyTo || account?.address || recipient,
    subject,
    text: `${message}\n\nKind regards,\nInnovex Resource Group Limited\n${account?.address || "info@innovexresourcegroup.co.uk"}\n\n${crmComplianceFooterText(source)}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#10242c">
        <p>${messageHtml(message)}</p>
        <hr style="border:none;border-top:1px solid #dce8eb;margin:20px 0" />
        <p style="font-size:13px;color:#667985">
          Innovex Resource Group Limited<br />
          ${account?.address || "info@innovexresourcegroup.co.uk"}
        </p>
        ${crmComplianceFooterHtml(source)}
      </div>
    `
  };
  const archive = await deliverMail(transporter, account, mailOptions);

  return { sent: true, ...archive };
}

export async function sendComposedEmail({ fromEmail, to = [], cc = [], bcc = [], subject, message, replyTo }) {
  const account = senderAccountOrDefault(fromEmail);
  if (!account) {
    return { sent: false, reason: "Selected sender mailbox is not configured" };
  }

  const transporter = makeTransporter(account);
  const source = "Innovex Email Centre";
  const mailOptions = {
    from: formatSender(account),
    to,
    cc,
    bcc,
    replyTo: replyTo || account.address,
    subject,
    text: `${message}\n\nKind regards,\nInnovex Resource Group Limited\n${account.address}\n\n${crmComplianceFooterText(source)}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#10242c">
        <p>${messageHtml(message)}</p>
        <hr style="border:none;border-top:1px solid #dce8eb;margin:20px 0" />
        <p style="font-size:13px;color:#667985">
          Innovex Resource Group Limited<br />
          ${account.address}
        </p>
        ${crmComplianceFooterHtml(source)}
      </div>
    `
  };
  const archive = await deliverMail(transporter, account, mailOptions);

  return { sent: true, ...archive };
}

export async function sendProspectExportEmail({ fromEmail, to, subject, message, workbookBuffer, filename, recordCount }) {
  const account = senderAccountOrDefault(fromEmail);
  if (!account) return { sent: false, reason: "Selected sender mailbox is not configured" };

  const transporter = makeTransporter(account);
  const source = "Innovex Web Leads CRM";
  const safeMessage = message || "Please find attached the requested Innovex prospect register export.";
  const mailOptions = {
    from: formatSender(account),
    to,
    replyTo: account.address,
    subject,
    text: `${safeMessage}\n\nThe attached professional Excel workbook contains ${Number(recordCount || 0).toLocaleString("en-GB")} prospect records, an export summary and a filterable prospect register.\n\nThis file contains confidential business information. Please store and share it securely.\n\nKind regards,\nInnovex Resource Group Limited\n${account.address}\n\n${crmComplianceFooterText(source, true)}`,
    html: `<div style="margin:0;background:#f3f8f8;padding:30px 12px;font-family:Arial,sans-serif;color:#173840"><div style="max-width:650px;margin:auto;background:#ffffff;border:1px solid #d8e5e7;border-radius:16px;overflow:hidden;box-shadow:0 14px 40px rgba(6,79,94,.10)"><div style="height:7px;background:#f4b942"></div><div style="background:#064f5e;padding:24px 30px;color:#ffffff"><div style="font-size:11px;letter-spacing:1.6px;font-weight:700;color:#b9d8dc">INNOVEX RESOURCE GROUP LIMITED</div><div style="font-size:22px;font-weight:700;margin-top:6px">Prospect register export</div></div><div style="padding:28px 30px"><p style="margin-top:0;line-height:1.65">${messageHtml(safeMessage)}</p><div style="margin:22px 0;padding:18px;border:1px solid #d6e8eb;border-left:4px solid #f4b942;border-radius:12px;background:#eef7f7"><div style="color:#60777e;font-size:11px;font-weight:700;letter-spacing:.08em">ATTACHED WORKBOOK</div><strong style="display:block;color:#173840;font-size:17px;margin-top:7px">${escapeHtml(filename)}</strong><span style="display:block;color:#60777e;margin-top:7px">${Number(recordCount || 0).toLocaleString("en-GB")} prospect records · Summary and filterable register</span></div><p style="line-height:1.6">This workbook contains confidential business information. Please store it securely and only share it with authorised recipients.</p><p style="margin:24px 0 0">Kind regards,<br><strong>Innovex Resource Group Limited</strong><br><span style="color:#60777e">0330 0435 830 &nbsp;|&nbsp; ${escapeHtml(account.address)}</span></p>${crmComplianceFooterHtml(source, true)}</div></div></div>`,
    attachments: [{
      filename,
      content: workbookBuffer,
      contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    }]
  };
  const archive = await deliverMail(transporter, account, mailOptions);
  return { sent: true, fromEmail: account.address, subject, ...archive };
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
  const message = customMessage || `Please find attached the Terms of Business prepared for ${terms.clientName}. The PDF includes your Innovex Resource Group Limited terms and the agreed client-specific commercial schedule for review.`;
  const source = "Innovex Client Terms Centre";

  const mailOptions = {
    from: formatSender(account),
    to: terms.clientEmail,
    cc,
    replyTo: account.address,
    subject,
    text: `${message}\n\nClient: ${terms.clientName}\nDocument: ${terms.documentNumber}\n\nThe PDF document is attached. Please review the terms and reply to this email if you would like any amendment before signing.\n\nKind regards,\nInnovex Resource Group Limited\n\n${crmComplianceFooterText(source, true)}`,
    html: `<div style="margin:0;background:#f3f8f8;padding:28px 12px;font-family:Arial,sans-serif;color:#173840"><div style="max-width:650px;margin:auto;background:#ffffff;border:1px solid #d8e5e7;border-radius:14px;overflow:hidden"><div style="height:7px;background:#f4b942"></div><div style="background:#064f5e;padding:22px 28px;color:#ffffff"><div style="font-size:12px;letter-spacing:1.5px;font-weight:700;color:#b9d8dc">INNOVEX RESOURCE GROUP LIMITED</div><div style="font-size:22px;font-weight:700;margin-top:6px">Terms of Business</div></div><div style="padding:26px 28px"><p style="margin-top:0">Hello,</p><p style="line-height:1.65">${messageHtml(message)}</p><div style="margin:22px 0;padding:16px 18px;background:#eef7f7;border-left:4px solid #f4b942;border-radius:10px"><div style="color:#60777e;font-size:12px;letter-spacing:.08em">DOCUMENT</div><strong style="display:block;color:#173840;font-size:17px;margin-top:5px">${escapeHtml(terms.documentNumber)}</strong><span style="display:block;color:#60777e;margin-top:6px">${escapeHtml(terms.clientName)}</span></div><p style="line-height:1.6">The PDF document is attached. Please review the terms and reply to this email if you would like any amendment before signing.</p><p style="margin:24px 0 0">Kind regards,<br><strong>Innovex Resource Group Limited</strong><br><span style="color:#60777e">0330 0435 830 &nbsp;|&nbsp; info@innovexresourcegroup.co.uk</span></p>${crmComplianceFooterHtml(source, true)}</div></div></div>`,
    attachments: [{ filename: `Innovex-Terms-${terms.documentNumber}.pdf`, content: pdfBuffer, contentType: "application/pdf" }]
  };

  const archive = await sendAndArchive(transporter, account, mailOptions);
  return { sent: true, fromEmail: account.address, subject, message, cc, ...archive };
}

export function buildClientTermsUnsignedReminderEmail(terms) {
  const contact = terms.contactName || terms.clientName || "there";
  const source = "Innovex Client Terms Centre";
  const subject = `Action required: Terms of Business awaiting signature | ${terms.documentNumber}`;
  const message = `Our records show that the Terms of Business sent to ${terms.clientName} have not yet been marked as signed.`;
  const text = `Hello ${contact},

${message}

Document: ${terms.documentNumber}
Client: ${terms.clientName}

Please review and sign the attached terms at your earliest convenience. If you have already signed them, please reply to this email with the signed copy so that we can update our records.

If you do not wish to proceed, please reply and let us know. This is an automatically generated follow-up; once you confirm that you do not wish to proceed, we can close the record and remove your details from our active follow-up system.

If you have any questions or require an amendment, simply reply to this email and our team will assist you.

Kind regards,
Innovex Resource Group Limited

${crmComplianceFooterText(source, true)}`;
  const html = `<div style="margin:0;background:#f3f8f8;padding:30px 12px;font-family:Arial,sans-serif;color:#173840"><div style="max-width:650px;margin:auto;background:#ffffff;border:1px solid #d8e5e7;border-radius:16px;overflow:hidden;box-shadow:0 14px 40px rgba(6,79,94,.10)"><div style="height:7px;background:#f4b942"></div><div style="background:#064f5e;padding:24px 30px;color:#ffffff"><div style="font-size:11px;letter-spacing:1.6px;font-weight:700;color:#b9d8dc">INNOVEX RESOURCE GROUP LIMITED</div><div style="font-size:23px;font-weight:700;margin-top:7px">Terms awaiting signature</div></div><div style="padding:28px 30px"><p style="margin-top:0">Hello ${escapeHtml(contact)},</p><p style="line-height:1.65">${escapeHtml(message)}</p><div style="margin:22px 0;padding:18px 20px;background:#eef7f7;border-left:4px solid #f4b942;border-radius:10px"><div style="color:#60777e;font-size:11px;letter-spacing:.08em">DOCUMENT REQUIRING ACTION</div><strong style="display:block;color:#173840;font-size:18px;margin-top:6px">${escapeHtml(terms.documentNumber)}</strong><span style="display:block;color:#60777e;margin-top:5px">${escapeHtml(terms.clientName)}</span></div><p style="line-height:1.65"><strong>Please review and sign the attached terms at your earliest convenience.</strong> If you have already signed them, please reply to this email with the signed copy so that we can update our records.</p><div style="margin:20px 0;padding:15px 17px;background:#fff8e8;border:1px solid #efd58c;border-radius:10px;line-height:1.6"><strong style="display:block;color:#173840;margin-bottom:5px">Not proceeding?</strong>If you do not wish to proceed, please reply and let us know. This is an automatically generated follow-up; once confirmed, we can close the record and remove your details from our active follow-up system.</div><p style="line-height:1.65">If you have any questions or require an amendment, simply reply to this email and our team will assist you.</p><p style="margin:24px 0 0">Kind regards,<br><strong>Innovex Resource Group Limited</strong><br><span style="color:#60777e">0330 0435 830 &nbsp;|&nbsp; info@innovexresourcegroup.co.uk</span></p>${crmComplianceFooterHtml(source, true)}</div></div></div>`;
  return { subject, message, text, html };
}

export async function sendClientTermsUnsignedReminderEmail({ terms, pdfBuffer, fromEmail, cc = [] }) {
  const account = senderAccountOrDefault(fromEmail || terms.senderEmail);
  if (!account) return { sent: false, reason: "Selected sender mailbox is not configured" };

  const email = buildClientTermsUnsignedReminderEmail(terms);
  const mailOptions = {
    from: formatSender(account),
    to: terms.clientEmail,
    cc,
    replyTo: account.address,
    subject: email.subject,
    text: email.text,
    html: email.html,
    attachments: [
      {
        filename: `Innovex-Terms-${terms.documentNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf"
      }
    ]
  };
  const archive = await sendAndArchive(makeTransporter(account), account, mailOptions);
  return { sent: true, fromEmail: account.address, cc, ...email, ...archive };
}

function hrDocumentFooter(source) {
  return `<div style="margin-top:24px;padding-top:14px;border-top:1px solid #d8e5e7;color:#6b7f85;font-size:11px;line-height:1.55">This is a system-generated email from the ${escapeHtml(source)}. This email and any attachments are confidential and intended solely for the named recipient. If you have received it in error, please notify us and delete it from your system.</div>`;
}

function hrMoney(value) {
  return `\u00A3${Number(value || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function hrDate(value) {
  return value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "-";
}

export async function sendSalarySlipEmail({ salarySlip, pdfBuffer, fromEmail, customMessage = "", cc = [] }) {
  const account = senderAccountOrDefault(fromEmail || salarySlip.senderEmail);
  if (!account) return { sent: false, reason: "Selected sender mailbox is not configured" };

  const transporter = makeTransporter(account);
  const source = "Innovex HR Centre";
  const subject = `Salary slip ${salarySlip.slipNumber} | Innovex Resource Group Limited`;
  const message = customMessage || `Please find attached your salary slip for the period ${hrDate(salarySlip.payPeriodStart)} to ${hrDate(salarySlip.payPeriodEnd)}.`;
  const exchangeLabel = salarySlip.exchangeRateLabel || "Currency rate at issue";
  const exchangeText = salarySlip.exchangeRateValue ? `${exchangeLabel}: ${salarySlip.exchangeRateValue}` : "Currency rate at issue: not provided";
  const paymentNotice = salarySlip.paymentNotice || "Full payment may take additional time to be received because payment is processed through a broker. Payments may also be received partially before the remaining balance is completed.";
  const mailOptions = {
    from: formatSender(account),
    to: salarySlip.employeeEmail,
    cc,
    replyTo: account.address,
    subject,
    text: `${message}\n\nDocument: ${salarySlip.slipNumber}\nNet pay: ${hrMoney(salarySlip.netPay)}\nPayment date: ${hrDate(salarySlip.paymentDate)}\n${exchangeText}\n\nPayment timing note: ${paymentNotice}\n\nKind regards,\nInnovex Resource Group Limited\n\nThis is a system-generated email from the ${source}. This email and any attachments are confidential and intended solely for the named recipient.`,
    html: `<div style="margin:0;background:#f3f8f8;padding:28px 12px;font-family:Arial,sans-serif;color:#173840"><div style="max-width:650px;margin:auto;background:#ffffff;border:1px solid #d8e5e7;border-radius:14px;overflow:hidden"><div style="height:7px;background:#f4b942"></div><div style="background:#064f5e;padding:22px 28px;color:#ffffff"><div style="font-size:12px;letter-spacing:1.5px;font-weight:700;color:#b9d8dc">INNOVEX RESOURCE GROUP LIMITED</div><div style="font-size:22px;font-weight:700;margin-top:6px">Salary Slip</div></div><div style="padding:26px 28px"><p style="margin-top:0">Hello ${escapeHtml(salarySlip.employeeName)},</p><p style="line-height:1.65">${messageHtml(message)}</p><div style="margin:22px 0;padding:16px 18px;background:#eef7f7;border-left:4px solid #f4b942;border-radius:10px"><div style="color:#60777e;font-size:12px;letter-spacing:.08em">NET PAY</div><strong style="display:block;color:#173840;font-size:22px;margin-top:5px">${hrMoney(salarySlip.netPay)}</strong><span style="display:block;color:#60777e;margin-top:6px">Payment date: ${hrDate(salarySlip.paymentDate)}</span><span style="display:block;color:#60777e;margin-top:6px">${escapeHtml(exchangeText)}</span></div><div style="margin:18px 0;padding:14px 16px;background:#fff8e8;border:1px solid #f4d28a;border-radius:10px;color:#4d3b13;line-height:1.55"><strong style="display:block;margin-bottom:5px;color:#173840">Payment timing note</strong>${escapeHtml(paymentNotice)}</div><p style="line-height:1.6">Your PDF salary slip is attached to this email. Please reply if any details require review.</p><p style="margin:24px 0 0">Kind regards,<br><strong>Innovex Resource Group Limited</strong><br><span style="color:#60777e">${escapeHtml(account.address)}</span></p>${hrDocumentFooter(source)}</div></div></div>`,
    attachments: [{ filename: `Innovex-Salary-Slip-${salarySlip.slipNumber}.pdf`, content: pdfBuffer, contentType: "application/pdf" }]
  };

  const archive = await sendAndArchive(transporter, account, mailOptions);
  return { sent: true, fromEmail: account.address, subject, message, cc, ...archive };
}

export async function sendOfferLetterEmail({ offerLetter, pdfBuffer, fromEmail, customMessage = "", cc = [] }) {
  const account = senderAccountOrDefault(fromEmail || offerLetter.senderEmail);
  if (!account) return { sent: false, reason: "Selected sender mailbox is not configured" };

  const transporter = makeTransporter(account);
  const source = "Innovex HR Centre";
  const subject = `Offer letter | ${offerLetter.roleTitle} | Innovex Resource Group Limited`;
  const message = customMessage || `Please find attached your offer letter for the ${offerLetter.roleTitle} role. Kindly review the document and reply to confirm acceptance or request any clarification.`;
  const mailOptions = {
    from: formatSender(account),
    to: offerLetter.candidateEmail,
    cc,
    replyTo: account.address,
    subject,
    text: `${message}\n\nOffer reference: ${offerLetter.offerNumber}\nRole: ${offerLetter.roleTitle}\nStart date: ${hrDate(offerLetter.startDate)}\n\nKind regards,\nInnovex Resource Group Limited\n\nThis is a system-generated email from the ${source}. This email and any attachments are confidential and intended solely for the named recipient.`,
    html: `<div style="margin:0;background:#f3f8f8;padding:28px 12px;font-family:Arial,sans-serif;color:#173840"><div style="max-width:650px;margin:auto;background:#ffffff;border:1px solid #d8e5e7;border-radius:14px;overflow:hidden"><div style="height:7px;background:#f4b942"></div><div style="background:#064f5e;padding:22px 28px;color:#ffffff"><div style="font-size:12px;letter-spacing:1.5px;font-weight:700;color:#b9d8dc">INNOVEX RESOURCE GROUP LIMITED</div><div style="font-size:22px;font-weight:700;margin-top:6px">Offer Letter</div></div><div style="padding:26px 28px"><p style="margin-top:0">Hello ${escapeHtml(offerLetter.candidateName)},</p><p style="line-height:1.65">${messageHtml(message)}</p><div style="margin:22px 0;padding:16px 18px;background:#eef7f7;border-left:4px solid #f4b942;border-radius:10px"><div style="color:#60777e;font-size:12px;letter-spacing:.08em">ROLE OFFERED</div><strong style="display:block;color:#173840;font-size:20px;margin-top:5px">${escapeHtml(offerLetter.roleTitle)}</strong><span style="display:block;color:#60777e;margin-top:6px">Start date: ${hrDate(offerLetter.startDate)}</span></div><p style="line-height:1.6">The PDF offer letter is attached. Please reply to this email with your acceptance or any questions.</p><p style="margin:24px 0 0">Kind regards,<br><strong>Innovex Resource Group Limited</strong><br><span style="color:#60777e">${escapeHtml(account.address)}</span></p>${hrDocumentFooter(source)}</div></div></div>`,
    attachments: [{ filename: `Innovex-Offer-Letter-${offerLetter.offerNumber}.pdf`, content: pdfBuffer, contentType: "application/pdf" }]
  };

  const archive = await sendAndArchive(transporter, account, mailOptions);
  return { sent: true, fromEmail: account.address, subject, message, cc, ...archive };
}
