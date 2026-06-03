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
