import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

const PAGE = { width: 595.28, height: 841.89 };
const LEFT = 54;
const RIGHT = 54;
const WIDTH = PAGE.width - LEFT - RIGHT;
const NAVY = "#17385f";
const DEEP = "#12334d";
const TEAL = "#177474";
const PINK = "#e91370";
const CYAN = "#08a5d5";
const INK = "#172731";
const MUTED = "#62737d";
const LINE = "#cbd7dd";
const SOFT = "#f0f4f7";

function safe(value, fallback = "-") {
  return String(value || fallback)
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2022\u25cf]/g, "-");
}

function money(value) {
  return `\u00a3${Number(value || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateLabel(value) {
  return value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/London" }) : "-";
}

function logoPath() {
  return [
    path.resolve(process.cwd(), "client/public/Logo.png"),
    path.resolve(process.cwd(), "../client/public/Logo.png"),
    path.resolve(process.cwd(), "public/Logo.png")
  ].find((candidate) => fs.existsSync(candidate));
}

function drawLogo(doc, x, y, width = 73, height = 56) {
  const logo = logoPath();
  if (logo) doc.image(logo, x, y, { fit: [width, height], align: "left", valign: "center" });
}

function drawHeader(doc) {
  drawLogo(doc, 28, 22, 84, 62);
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(19).text("INNOVEX RESOURCE GROUP LIMITED", 128, 39, { width: 420, align: "center", lineBreak: false, characterSpacing: 0.5 });
  doc.rect(LEFT, 94, WIDTH, 3).fill(CYAN);
  doc.rect(LEFT + WIDTH * 0.55, 94, WIDTH * 0.45, 3).fill(PINK);
}

function drawFooter(doc, pageNumber, totalPages) {
  doc.moveTo(LEFT, 790).lineTo(PAGE.width - RIGHT, 790).strokeColor(LINE).lineWidth(0.6).stroke();
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(7.4).text("33 Forsythia Drive, Cardiff, CF23 7HP  |  +44 330 043 5830  |  info@innovexresourcegroup.co.uk", LEFT, 800, { width: WIDTH, align: "center", lineBreak: false });
  doc.fillColor(MUTED).font("Helvetica").fontSize(7).text(`${pageNumber} of ${totalPages}`, LEFT, 816, { width: WIDTH, align: "right", lineBreak: false });
}

function sectionLabel(doc, text, y) {
  doc.fillColor(TEAL).font("Helvetica-Bold").fontSize(8.5).text(text.toUpperCase(), LEFT + 6, y, { lineBreak: false });
  return y + 17;
}

function metaTable(doc, quotation, y) {
  const cells = [
    ["Date", dateLabel(quotation.issueDate)],
    ["Quotation ref.", quotation.quotationNumber],
    ["Valid for", `${quotation.validDays} days from issue`]
  ];
  const cellWidth = WIDTH / 3;
  doc.rect(LEFT, y, WIDTH, 44).fill(SOFT).strokeColor(INK).lineWidth(0.45).stroke();
  cells.forEach(([label, value], index) => {
    const x = LEFT + index * cellWidth;
    if (index) doc.moveTo(x, y).lineTo(x, y + 44).stroke();
    doc.fillColor(TEAL).font("Helvetica-Bold").fontSize(7).text(label.toUpperCase(), x + 9, y + 10, { width: cellWidth - 18, lineBreak: false });
    doc.fillColor(INK).font("Helvetica-Bold").fontSize(8.7).text(safe(value), x + 9, y + 25, { width: cellWidth - 18, lineBreak: false, ellipsis: true });
  });
  return y + 44;
}

function preparedFor(doc, quotation, y) {
  y = sectionLabel(doc, "Prepared for", y);
  const leftWidth = WIDTH * 0.62;
  doc.rect(LEFT, y, WIDTH, 72).fill("#ffffff").strokeColor(INK).lineWidth(0.45).stroke();
  doc.moveTo(LEFT + leftWidth, y).lineTo(LEFT + leftWidth, y + 72).stroke();
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(10.5).text(safe(quotation.contactName), LEFT + 10, y + 10, { width: leftWidth - 20, lineBreak: false, ellipsis: true });
  doc.fillColor(INK).font("Helvetica").fontSize(8).text([quotation.contactJobTitle, quotation.clientName, quotation.clientAddress].filter(Boolean).map(safe).join("\n"), LEFT + 10, y + 27, { width: leftWidth - 20, height: 39, ellipsis: true, lineGap: 1 });
  doc.fillColor(TEAL).font("Helvetica-Bold").fontSize(7).text("CONTACT", LEFT + leftWidth + 10, y + 10, { width: WIDTH - leftWidth - 20, lineBreak: false });
  doc.fillColor(INK).font("Helvetica-Bold").fontSize(8.7).text([quotation.clientPhone, quotation.clientEmail].filter(Boolean).join("\n"), LEFT + leftWidth + 10, y + 27, { width: WIDTH - leftWidth - 20, height: 35, ellipsis: true });
  return y + 72;
}

function programmeTable(doc, quotation, y) {
  y = sectionLabel(doc, "Delivery & programme", y);
  const half = WIDTH / 2;
  const bodyHeight = 80;
  doc.rect(LEFT, y, WIDTH, 24).fill(DEEP);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7.1).text("TRAINING LOCATIONS", LEFT + 9, y + 8, { width: half - 18, lineBreak: false });
  doc.text(safe(quotation.programmeTitle, "PROGRAMME").toUpperCase(), LEFT + half + 9, y + 8, { width: half - 18, lineBreak: false, ellipsis: true });
  y += 24;
  doc.rect(LEFT, y, WIDTH, bodyHeight).fill(SOFT).strokeColor(LINE).stroke();
  doc.moveTo(LEFT + half, y).lineTo(LEFT + half, y + bodyHeight).stroke();
  doc.fillColor(INK).font("Helvetica").fontSize(7.6).text(`${safe(quotation.trainingLocations)}\n${safe(quotation.deliverySummary)}`, LEFT + 9, y + 10, { width: half - 18, height: bodyHeight - 18, lineGap: 1.6, ellipsis: true });
  doc.text(safe(quotation.programmeDescription), LEFT + half + 9, y + 10, { width: half - 18, height: bodyHeight - 18, lineGap: 1.6, ellipsis: true });
  return y + bodyHeight;
}

function pricingTable(doc, quotation, y) {
  y = sectionLabel(doc, "Pricing", y);
  const drawPricingHeader = () => {
    doc.rect(LEFT, y, WIDTH, 25).fill(DEEP);
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7.2)
      .text("COURSE / SESSION DETAILS", LEFT + 9, y + 9, { width: 275, lineBreak: false })
      .text("SESSIONS", LEFT + 298, y + 9, { width: 55, align: "center", lineBreak: false })
      .text("RATE", LEFT + 358, y + 9, { width: 58, align: "right", lineBreak: false })
      .text("TOTAL", LEFT + 420, y + 9, { width: 58, align: "right", lineBreak: false });
    y += 25;
  };
  drawPricingHeader();
  quotation.lineItems.forEach((item, index) => {
    const rowHeight = item.description || Number(item.discountPercent || 0) ? 42 : 30;
    if (y + rowHeight > 755) {
      doc.addPage({ size: "A4", margin: 0 });
      drawHeader(doc);
      y = sectionLabel(doc, "Pricing continued", 125);
      drawPricingHeader();
    }
    doc.rect(LEFT, y, WIDTH, rowHeight).fill(index % 2 ? SOFT : "#ffffff").strokeColor(LINE).lineWidth(0.45).stroke();
    doc.fillColor(index % 2 ? TEAL : INK).font("Helvetica-Bold").fontSize(8).text(safe(item.title), LEFT + 9, y + 8, { width: 275, lineBreak: false, ellipsis: true });
    const detail = [item.description, item.delegates ? `Up to ${item.delegates} delegates` : "", item.discountPercent ? `${item.discountPercent}% discount applied` : ""].filter(Boolean).join(" | ");
    if (detail) doc.fillColor(MUTED).font("Helvetica").fontSize(6.8).text(safe(detail), LEFT + 9, y + 23, { width: 275, lineBreak: false, ellipsis: true });
    doc.fillColor(INK).font("Helvetica").fontSize(8).text(String(item.sessions || 1), LEFT + 298, y + 10, { width: 55, align: "center", lineBreak: false });
    doc.text(money(item.unitPrice), LEFT + 358, y + 10, { width: 58, align: "right", lineBreak: false });
    doc.fillColor(NAVY).font("Helvetica-Bold").text(money(item.total), LEFT + 420, y + 10, { width: 58, align: "right", lineBreak: false });
    y += rowHeight;
  });
  if (quotation.totalDiscount > 0) {
    doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(7.2).text(`Discount: -${money(quotation.totalDiscount)}`, LEFT + 245, y + 8, { width: 95, align: "right", lineBreak: false });
  }
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9.5).text(`Quotation total: ${money(quotation.total)}`, LEFT + 345, y + 7, { width: 133, align: "right", lineBreak: false });
  return y + 27;
}

function includedTable(doc, quotation, y) {
  const items = quotation.inclusions || [];
  const half = Math.ceil(items.length / 2);
  const rows = Math.max(1, half);
  const height = Math.max(44, rows * 18 + 12);
  if (y + height + 17 > 785) {
    doc.addPage({ size: "A4", margin: 0 });
    drawHeader(doc);
    y = 125;
  }
  y = sectionLabel(doc, "Included in every session", y);
  doc.rect(LEFT, y, WIDTH, height).fill(SOFT).strokeColor(LINE).stroke();
  doc.moveTo(LEFT + WIDTH / 2, y).lineTo(LEFT + WIDTH / 2, y + height).stroke();
  items.forEach((item, index) => {
    const column = index >= half ? 1 : 0;
    const row = column ? index - half : index;
    const x = LEFT + column * WIDTH / 2 + 9;
    const itemY = y + 10 + row * 18;
    doc.circle(x + 4, itemY + 5, 2.2).fill(TEAL);
    doc.fillColor(INK).font("Helvetica").fontSize(7.5).text(safe(item), x + 14, itemY + 1, { width: WIDTH / 2 - 32, lineBreak: false, ellipsis: true });
  });
  return y + height;
}

function commercialTerms(doc, quotation, y) {
  y = sectionLabel(doc, "Commercial terms", y);
  const terms = [
    ["PAYMENT", quotation.paymentTerms],
    ["TIMESCALE", quotation.timescaleTerms],
    ["VALIDITY", `This quotation is valid for ${quotation.validDays} days from the date of issue.`],
    ...(quotation.additionalTerms ? [["ADDITIONAL", quotation.additionalTerms]] : [])
  ];
  terms.forEach(([label, value]) => {
    doc.fillColor(TEAL).font("Helvetica-Bold").fontSize(8).text(label, LEFT + 9, y, { width: 58, lineBreak: false });
    doc.fillColor(INK).font("Helvetica").fontSize(7.8).text(safe(value), LEFT + 68, y, { width: WIDTH - 77, lineGap: 1.2 });
    y += Math.max(20, doc.heightOfString(safe(value), { width: WIDTH - 77, lineGap: 1.2 }) + 5);
  });
  return y;
}

function closingPage(doc, quotation) {
  doc.addPage({ size: "A4", margin: 0 });
  drawHeader(doc);
  let y = commercialTerms(doc, quotation, 126) + 24;
  doc.moveTo(LEFT, y - 10).lineTo(PAGE.width - RIGHT, y - 10).strokeColor(LINE).stroke();
  doc.fillColor(INK).font("Helvetica").fontSize(10).text(safe(quotation.closingMessage), LEFT + 6, y, { width: WIDTH - 12, lineGap: 3 });
  y += doc.heightOfString(safe(quotation.closingMessage), { width: WIDTH - 12, lineGap: 3 }) + 20;
  doc.fillColor(INK).font("Helvetica").fontSize(10).text("Kind regards,", LEFT + 6, y);
  y += 22;
  doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(11).text(safe(quotation.signatoryName), LEFT + 6, y);
  y += 17;
  doc.fillColor(INK).font("Helvetica").fontSize(9.5).text(`${safe(quotation.signatoryTitle)} | Innovex Resource Group Limited`, LEFT + 6, y);
  y += 18;
  doc.fillColor(TEAL).text("T: +44 330 043 5830  |  E: info@innovexresourcegroup.co.uk", LEFT + 6, y);
  y += 17;
  doc.fillColor(MUTED).text("33 Forsythia Drive, Cardiff, CF23 7HP", LEFT + 6, y);
  const logo = logoPath();
  if (logo) doc.save().opacity(0.09).image(logo, 155, 365, { fit: [285, 215], align: "center", valign: "center" }).restore();
}

export function generateTrainingQuotationPdf(quotation) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true, autoFirstPage: false, info: { Title: `Training Quotation ${quotation.quotationNumber}`, Author: "Innovex Resource Group Limited", Subject: `Course quotation for ${quotation.clientName}` } });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.addPage({ size: "A4", margin: 0 });
    drawHeader(doc);
    let y = 119;
    doc.fillColor(DEEP).font("Helvetica-Bold").fontSize(18).text("FACE-TO-FACE STAFF TRAINING", LEFT + 6, y, { lineBreak: false });
    y += 23;
    doc.fillColor(TEAL).font("Helvetica").fontSize(10).text("Training Proposal & Commercial Quotation", LEFT + 6, y, { lineBreak: false });
    y = metaTable(doc, quotation, y + 17) + 17;
    y = preparedFor(doc, quotation, y) + 16;
    const greetingName = safe(quotation.contactName).split(/\s+/)[0];
    doc.fillColor(NAVY).font("Helvetica-Bold").fontSize(9).text(`Dear ${greetingName},`, LEFT + 6, y);
    y += 17;
    doc.fillColor(INK).font("Helvetica").fontSize(8.2).text(safe(quotation.openingMessage), LEFT + 6, y, { width: WIDTH - 12, lineGap: 1.5 });
    y += doc.heightOfString(safe(quotation.openingMessage), { width: WIDTH - 12, lineGap: 1.5 }) + 15;
    y = programmeTable(doc, quotation, y) + 14;
    y = pricingTable(doc, quotation, y) + 12;
    includedTable(doc, quotation, y);

    closingPage(doc, quotation);

    const range = doc.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page += 1) {
      doc.switchToPage(page);
      drawFooter(doc, page + 1, range.count);
    }
    doc.end();
  });
}
