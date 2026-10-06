function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

const portalDetails = {
  Partner: {
    label: "Recruitment Partner Portal",
    introduction: "You have been invited to collaborate with our recruitment team through a secure, dedicated workspace.",
    benefits: ["View vacancies selected for your organisation", "Submit candidate details and CVs securely", "Track review decisions, progress and feedback"]
  },
  Client: {
    label: "Client Portal",
    introduction: "You have been invited to access a secure workspace for your recruitment activity with our team.",
    benefits: ["Review active vacancies and candidate submissions", "Record interview or hiring decisions", "Access recruitment documents in one place"]
  },
  Candidate: {
    label: "Candidate Portal",
    introduction: "You have been invited to access your secure candidate workspace with our recruitment team.",
    benefits: ["Follow your application progress", "Manage interview availability", "Keep your recruitment information up to date"]
  }
};

export function portalInvitationEmail({ accountName, organizationName, type, activationUrl, expiresInDays = 7 }) {
  const details = portalDetails[type] || portalDetails.Candidate;
  const safeName = escapeHtml(accountName);
  const safeOrganization = escapeHtml(organizationName);
  const safeUrl = escapeHtml(activationUrl);
  const benefitRows = details.benefits.map((benefit) => `
    <tr>
      <td style="padding:0 0 12px;vertical-align:top;width:26px;color:#0b8178;font-size:18px;line-height:20px">&#10003;</td>
      <td style="padding:0 0 12px;color:#38575d;font-size:14px;line-height:20px">${escapeHtml(benefit)}</td>
    </tr>`).join("");

  const subject = type === "Partner"
    ? `Your ${organizationName} Recruitment Partner Portal invitation`
    : `Your secure ${organizationName} ${details.label} invitation`;

  const text = [
    `Hello ${accountName},`,
    "",
    details.introduction,
    "",
    ...details.benefits.map((benefit) => `- ${benefit}`),
    "",
    `Activate your secure portal: ${activationUrl}`,
    "",
    `For your security, this invitation expires in ${expiresInDays} days and can only be used once.`,
    "",
    `Kind regards,`,
    `${organizationName}`
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:0;background:#eef4f3;font-family:Arial,Helvetica,sans-serif;color:#173f46">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0">Activate your secure ${escapeHtml(details.label)} and begin collaborating with ${safeOrganization}.</div>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;background:#eef4f3">
      <tr><td align="center" style="padding:32px 14px">
        <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="width:100%;max-width:620px;border:1px solid #d8e5e3;border-radius:16px;overflow:hidden;background:#ffffff;box-shadow:0 14px 40px rgba(7,58,63,.10)">
          <tr><td style="padding:30px 38px;background:#073f46">
            <div style="color:#78d1c6;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase">INNOVEX RESOURCE GROUP LIMITED</div>
            <div style="margin-top:8px;color:#ffffff;font-size:24px;font-weight:700;line-height:31px">${escapeHtml(details.label)}</div>
            <div style="margin-top:7px;color:#c9e3df;font-size:13px;line-height:20px">Secure recruitment collaboration, managed in one place.</div>
          </td></tr>
          <tr><td style="padding:34px 38px 12px">
            <div style="color:#173f46;font-size:20px;font-weight:700;line-height:28px">Hello ${safeName},</div>
            <p style="margin:14px 0 0;color:#526d72;font-size:15px;line-height:24px">${escapeHtml(details.introduction)}</p>
          </td></tr>
          <tr><td style="padding:12px 38px 6px">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="padding:20px 20px 8px;border:1px solid #e1ecea;border-radius:12px;background:#f7fbfa">
              <tr><td colspan="2" style="padding:0 0 16px;color:#173f46;font-size:13px;font-weight:700;text-transform:uppercase;letter-spacing:.7px">Your secure workspace enables you to</td></tr>
              ${benefitRows}
            </table>
          </td></tr>
          <tr><td align="center" style="padding:24px 38px 14px">
            <a href="${safeUrl}" style="display:inline-block;padding:14px 26px;border-radius:9px;background:#0a887f;color:#ffffff;font-size:15px;font-weight:700;text-decoration:none">Activate secure portal&nbsp;&nbsp;&rarr;</a>
          </td></tr>
          <tr><td style="padding:8px 38px 30px">
            <p style="margin:0;color:#718589;font-size:12px;line-height:19px;text-align:center">For your security, this single-use invitation expires in ${expiresInDays} days. If you were not expecting it, you can safely ignore this email.</p>
          </td></tr>
          <tr><td style="padding:22px 38px;border-top:1px solid #e6eeed;background:#f8fbfa">
            <div style="color:#284e54;font-size:13px;font-weight:700">${safeOrganization}</div>
            <div style="margin-top:5px;color:#7a8e91;font-size:11px;line-height:17px">Confidential recruitment communication. Please do not forward your personal activation link.</div>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}
