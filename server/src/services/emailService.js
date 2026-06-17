import nodemailer from "nodemailer";

const recipient = process.env.CONTACT_TO_EMAIL || "info@innovexresourcegroup.co.uk";

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function makeTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
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

export async function sendCandidateOutreachEmail({ candidate, subject, message, replyTo }) {
  if (!hasSmtpConfig()) {
    return { sent: false, reason: "SMTP is not configured" };
  }

  if (!candidate.email) {
    return { sent: false, reason: "Candidate email is missing" };
  }

  const transporter = makeTransporter();
  const safeMessage = String(message || "").replace(/\n/g, "<br />");

  await transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: candidate.email,
    replyTo: replyTo || recipient,
    subject,
    text: message,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.55;color:#10242c">
        <p>${safeMessage}</p>
        <hr style="border:none;border-top:1px solid #dce8eb;margin:20px 0" />
        <p style="font-size:13px;color:#667985">
          Innovex Resource Group Limited<br />
          info@innovexresourcegroup.co.uk
        </p>
      </div>
    `
  });

  return { sent: true };
}
