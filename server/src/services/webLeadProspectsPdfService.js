import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

const PAGE = { width: 841.89, height: 595.28 };
const MARGIN = 34;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;
const BRAND = {
  teal: "#064f5e",
  tealDark: "#033d49",
  tealSoft: "#edf8f7",
  gold: "#f4b942",
  goldSoft: "#fff6da",
  ink: "#173840",
  muted: "#667d84",
  line: "#d7e5e7",
  white: "#ffffff"
};

const columns = [
  { label: "BUSINESS", x: 34, width: 126 },
  { label: "CONTACT AND EMAIL", x: 164, width: 158 },
  { label: "PHONE", x: 326, width: 78 },
  { label: "CATEGORY", x: 408, width: 90 },
  { label: "SERVICES", x: 502, width: 110 },
  { label: "STATUS", x: 616, width: 94 },
  { label: "OWNER", x: 714, width: 93 }
];

const positiveStatuses = new Set(["Won", "Accepted by Innovex", "Qualified", "Meeting Booked"]);
const warningStatuses = new Set(["Interested", "Email Requested", "Follow-Up Required", "Proposal Required", "Proposal Sent"]);

function safe(value, fallback = "-") {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || fallback;
}

function truncate(value, limit) {
  const text = safe(value, "");
  return text.length > limit ? `${text.slice(0, Math.max(limit - 3, 0))}...` : text;
}

function logoPath() {
  const candidates = [
    path.resolve(process.cwd(), "client/public/Logo.png"),
    path.resolve(process.cwd(), "../client/public/Logo.png"),
    path.resolve(process.cwd(), "public/Logo.png")
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function drawLogo(doc, x, y, width = 70, height = 44) {
  const filename = logoPath();
  if (!filename) return false;
  try {
    doc.image(filename, x, y, { fit: [width, height], align: "left", valign: "center" });
    return true;
  } catch {
    return false;
  }
}

function drawHeader(doc, metadata, metrics) {
  doc.rect(0, 0, PAGE.width, 8).fill(BRAND.gold);
  doc.rect(0, 8, PAGE.width, 91).fill(BRAND.tealDark);
  const hasLogo = drawLogo(doc, MARGIN, 24, 70, 46);
  const brandX = hasLogo ? 118 : MARGIN;
  doc.fillColor(BRAND.white).font("Helvetica-Bold").fontSize(11.5)
    .text("INNOVEX RESOURCE GROUP LIMITED", brandX, 27, { width: 330, lineBreak: false });
  doc.fillColor("#bdd9dc").font("Helvetica").fontSize(7.5)
    .text("Secure Web Leads CRM export", brandX, 47, { width: 260, lineBreak: false });
  doc.fillColor("#d9e9eb").fontSize(7)
    .text("info@innovexresourcegroup.co.uk  |  0330 0435 830", brandX, 64, { width: 350, lineBreak: false });
  doc.fillColor(BRAND.white).font("Helvetica-Bold").fontSize(23)
    .text("PROSPECT REGISTER", 520, 24, { width: 287, align: "right", lineBreak: false });
  doc.fillColor(BRAND.gold).fontSize(9)
    .text(metadata.scopeLabel.toUpperCase(), 520, 57, { width: 287, align: "right", lineBreak: false });
  doc.fillColor("#d9e9eb").font("Helvetica").fontSize(7)
    .text(`Prepared for ${metadata.preparedFor}  |  ${metadata.generatedAt}`, 470, 75, { width: 337, align: "right", lineBreak: false });

  const cards = [
    ["TOTAL PROSPECTS", metrics.total, BRAND.tealSoft],
    ["EMAIL CONTACTS", metrics.emailContacts, "#eef7fb"],
    ["OPEN FOLLOW-UPS", metrics.openFollowUps, BRAND.goldSoft],
    ["POSITIVE OUTCOMES", metrics.positive, "#e8f7ef"]
  ];
  const gap = 10;
  const cardWidth = (CONTENT_WIDTH - gap * 3) / 4;
  cards.forEach(([label, value, fill], index) => {
    const x = MARGIN + index * (cardWidth + gap);
    doc.roundedRect(x, 112, cardWidth, 50, 9).fill(fill).strokeColor(BRAND.line).lineWidth(0.7).stroke();
    doc.fillColor(BRAND.muted).font("Helvetica-Bold").fontSize(6.5)
      .text(label, x + 12, 124, { width: cardWidth - 24, lineBreak: false });
    doc.fillColor(BRAND.teal).font("Helvetica-Bold").fontSize(15)
      .text(Number(value || 0).toLocaleString("en-GB"), x + 12, 140, { width: cardWidth - 24, lineBreak: false });
  });
}

function drawTableHeader(doc, y) {
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 28, 7).fill(BRAND.teal);
  doc.fillColor(BRAND.white).font("Helvetica-Bold").fontSize(6.7);
  columns.forEach((column) => doc.text(column.label, column.x + 8, y + 10, { width: column.width - 12, lineBreak: false }));
  return y + 28;
}

function statusColors(status) {
  if (positiveStatuses.has(status)) return { fill: "#dff4e8", text: "#17633a" };
  if (warningStatuses.has(status)) return { fill: BRAND.goldSoft, text: "#805500" };
  if (["Lost", "Rejected by Innovex", "Not Interested", "Do Not Contact"].includes(status)) return { fill: "#fce2e2", text: "#8b2727" };
  return { fill: "#e5f3f8", text: BRAND.teal };
}

function drawRow(doc, item, y, index) {
  const height = 34;
  if (index % 2 === 0) doc.rect(MARGIN, y, CONTENT_WIDTH, height).fill("#f7fbfb");
  doc.fillColor(BRAND.ink).font("Helvetica-Bold").fontSize(7.2)
    .text(truncate(item.businessName, 35), 42, y + 6, { width: 112, height: 9, ellipsis: true, lineBreak: false });
  doc.fillColor(BRAND.muted).font("Helvetica").fontSize(6.3)
    .text(truncate(item.townCity || item.postcode, 28), 42, y + 17, { width: 112, height: 8, ellipsis: true, lineBreak: false });

  doc.fillColor(BRAND.ink).font("Helvetica-Bold").fontSize(7)
    .text(truncate(item.contactPerson, 36), 172, y + 5, { width: 144, height: 9, ellipsis: true, lineBreak: false });
  doc.fillColor(BRAND.teal).font("Helvetica").fontSize(5.7)
    .text(safe(item.email), 172, y + 16, { width: 144, height: 14, ellipsis: true, lineGap: 0 });

  doc.fillColor(BRAND.ink).font("Helvetica").fontSize(6.6)
    .text(truncate(item.telephone, 20), 334, y + 13, { width: 64, height: 9, ellipsis: true, lineBreak: false });
  doc.text(truncate(item.businessCategory, 27), 416, y + 9, { width: 76, height: 17, ellipsis: true });
  doc.text(truncate((item.interestedServices || []).join(", "), 48), 510, y + 8, { width: 96, height: 18, ellipsis: true });

  const status = safe(item.status);
  const colors = statusColors(status);
  doc.roundedRect(624, y + 8, 78, 18, 7).fill(colors.fill);
  doc.fillColor(colors.text).font("Helvetica-Bold").fontSize(6.2)
    .text(truncate(status, 24), 630, y + 14, { width: 66, height: 7, align: "center", ellipsis: true, lineBreak: false });
  doc.fillColor(BRAND.ink).font("Helvetica").fontSize(6.4)
    .text(truncate(item.createdByName, 26), 722, y + 9, { width: 78, height: 17, ellipsis: true });

  doc.moveTo(MARGIN, y + height).lineTo(MARGIN + CONTENT_WIDTH, y + height).strokeColor(BRAND.line).lineWidth(0.5).stroke();
  return y + height;
}

function drawFooter(doc, pageNumber, totalPages) {
  doc.moveTo(MARGIN, 557).lineTo(MARGIN + CONTENT_WIDTH, 557).strokeColor(BRAND.line).lineWidth(0.7).stroke();
  doc.fillColor(BRAND.muted).font("Helvetica").fontSize(6.5)
    .text("Confidential CRM export. Store securely and share only with authorised recipients.", MARGIN, 567, { width: 500, lineBreak: false })
    .text("Innovex Resource Group Limited | Company No. 15975820 | Registered in England and Wales", MARGIN, 579, { width: 530, lineBreak: false });
  doc.fillColor(BRAND.teal).font("Helvetica-Bold").fontSize(7)
    .text(`PAGE ${pageNumber} OF ${totalPages}`, 690, 578, { width: 117, align: "right", lineBreak: false });
}

export function generateWebLeadProspectsPdf(items = [], options = {}) {
  return new Promise((resolve, reject) => {
    const generatedDate = options.generatedAt ? new Date(options.generatedAt) : new Date();
    const metadata = {
      scopeLabel: options.scopeLabel || "All accessible prospects",
      preparedFor: options.preparedFor || "Innovex CRM user",
      generatedAt: generatedDate.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" })
    };
    const metrics = {
      total: items.length,
      emailContacts: items.filter((item) => item.email || item.secondaryEmail).length,
      openFollowUps: items.reduce((total, item) => total + (item.followUps || []).filter((followUp) => !followUp.completed).length, 0),
      positive: items.filter((item) => positiveStatuses.has(item.status)).length
    };
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 0,
      bufferPages: true,
      autoFirstPage: true,
      info: {
        Title: "Innovex Prospect Register",
        Author: "Innovex Resource Group Limited",
        Subject: "Secure Web Leads CRM prospect export"
      }
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, metadata, metrics);
    let y = drawTableHeader(doc, 178);
    if (!items.length) {
      doc.roundedRect(MARGIN, y + 18, CONTENT_WIDTH, 64, 8).fill(BRAND.white).strokeColor(BRAND.line).stroke();
      doc.fillColor(BRAND.ink).font("Helvetica-Bold").fontSize(12)
        .text("No prospects found for this export.", MARGIN + 18, y + 42, { lineBreak: false });
    }

    items.forEach((item, index) => {
      if (y + 34 > 548) {
        doc.addPage({ size: "A4", layout: "landscape", margin: 0 });
        drawHeader(doc, metadata, metrics);
        y = drawTableHeader(doc, 178);
      }
      y = drawRow(doc, item, y, index);
    });

    const range = doc.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page += 1) {
      doc.switchToPage(page);
      drawFooter(doc, page + 1, range.count);
    }
    doc.end();
  });
}

export function prospectPdfFilename(date = new Date()) {
  const stamp = new Date(date).toISOString().slice(0, 10);
  return `Innovex-Prospects-${stamp}.pdf`;
}
