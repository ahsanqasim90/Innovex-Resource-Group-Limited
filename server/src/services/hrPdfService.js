import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

const PAGE_WIDTH = 595.28;
const LEFT = 42;
const CONTENT_WIDTH = 511;
const teal = "#064f5e";
const deepTeal = "#033d49";
const gold = "#f4b942";
const ink = "#173840";
const muted = "#667d84";
const line = "#d7e5e7";
const soft = "#f4f9f9";

function money(value) {
  return `\u00A3${Number(value || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateLabel(value) {
  return value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }) : "-";
}

function safe(value, fallback = "-") {
  return String(value || fallback);
}

function drawLogo(doc, x, y, width = 72, height = 44) {
  const logoPath = path.join(process.cwd(), "client", "public", "Logo.png");
  if (!fs.existsSync(logoPath)) return false;
  try {
    doc.image(logoPath, x, y, { fit: [width, height], align: "left", valign: "center" });
    return true;
  } catch {
    return false;
  }
}

function drawHeader(doc, title, reference) {
  doc.rect(0, 0, PAGE_WIDTH, 10).fill(gold);
  doc.rect(0, 10, PAGE_WIDTH, 105).fill(deepTeal);
  const hasLogo = drawLogo(doc, LEFT, 32);
  const brandX = hasLogo ? 125 : LEFT;
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(12).text("INNOVEX RESOURCE GROUP LIMITED", brandX, 39, { width: 260, lineBreak: false });
  doc.fillColor("#b9d8dc").font("Helvetica").fontSize(8).text("Recruitment | Training | Website Development | SEO", brandX, 60, { width: 285, lineBreak: false });
  doc.fillColor("#d8eaec").fontSize(7.2).text("33 Forsythia Drive, Cardiff, CF23 7HP", brandX, 76, { width: 285, lineBreak: false });
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(23).text(title, 345, 37, { width: 208, align: "right", lineBreak: false });
  doc.fillColor(gold).fontSize(10).text(reference, 345, 70, { width: 208, align: "right", lineBreak: false });
}

function drawFooter(doc, pageNumber, totalPages) {
  doc.moveTo(LEFT, 784).lineTo(LEFT + CONTENT_WIDTH, 784).strokeColor(line).lineWidth(0.8).stroke();
  doc.fillColor(muted).font("Helvetica").fontSize(6.5)
    .text("Innovex Resource Group Limited | Company No. 15975820 | Registered in England and Wales", LEFT, 793, { width: CONTENT_WIDTH, align: "center", lineBreak: false })
    .text("info@innovexresourcegroup.co.uk | 0330 0435 830", LEFT, 804, { width: CONTENT_WIDTH, align: "center", lineBreak: false });
  doc.fillColor(teal).font("Helvetica-Bold").fontSize(6.5).text(`PAGE ${pageNumber} OF ${totalPages}`, 470, 819, { width: 83, align: "right", lineBreak: false });
}

function metaBox(doc, items, y) {
  const col = CONTENT_WIDTH / items.length;
  doc.roundedRect(LEFT, y, CONTENT_WIDTH, 66, 10).fill(soft).strokeColor(line).stroke();
  items.forEach(([label, value], index) => {
    const x = LEFT + index * col + 14;
    if (index > 0) doc.moveTo(LEFT + index * col, y).lineTo(LEFT + index * col, y + 66).strokeColor(line).stroke();
    doc.fillColor(muted).font("Helvetica-Bold").fontSize(6.8).text(label.toUpperCase(), x, y + 15, { width: col - 28, lineBreak: false });
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(9.2).text(safe(value), x, y + 34, { width: col - 28, lineBreak: false, ellipsis: true });
  });
}

function tableHeader(doc, y, columns) {
  doc.roundedRect(LEFT, y, CONTENT_WIDTH, 28, 6).fill(teal);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7.4);
  columns.forEach((column) => doc.text(column.label, column.x, y + 10, { width: column.width, align: column.align || "left", lineBreak: false }));
  return y + 28;
}

function finish(doc, resolve, chunks) {
  const range = doc.bufferedPageRange();
  for (let page = range.start; page < range.start + range.count; page += 1) {
    doc.switchToPage(page);
    drawFooter(doc, page + 1, range.count);
  }
  doc.end();
}

export function generateSalarySlipPdf(slip) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true, info: { Title: `Salary Slip ${slip.slipNumber}`, Author: "Innovex Resource Group Limited" } });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, "Salary Slip", slip.slipNumber);
    doc.fillColor(teal).font("Helvetica-Bold").fontSize(8).text("EMPLOYEE PAY STATEMENT", LEFT, 145, { lineBreak: false });
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(17).text(slip.employeeName, LEFT, 164, { width: 300, lineBreak: false, ellipsis: true });
    doc.fillColor(muted).font("Helvetica").fontSize(8.2).text([slip.jobTitle, slip.department, slip.employeeEmail].filter(Boolean).join(" | "), LEFT, 188, { width: 430, lineBreak: false, ellipsis: true });

    metaBox(doc, [
      ["Pay period", `${dateLabel(slip.payPeriodStart)} - ${dateLabel(slip.payPeriodEnd)}`],
      ["Payment date", dateLabel(slip.paymentDate)],
      ["Payment method", slip.paymentMethod || "Bank transfer"],
      ["Net pay", money(slip.netPay)]
    ], 222);

    const columns = [
      { label: "EARNINGS", x: 56, width: 230 },
      { label: "AMOUNT", x: 285, width: 90, align: "right" },
      { label: "DEDUCTIONS", x: 398, width: 85 },
      { label: "AMOUNT", x: 482, width: 58, align: "right" }
    ];
    let y = tableHeader(doc, 318, columns);
    const earnings = [["Basic salary", slip.basicSalary], ["Overtime", slip.overtime], ["Bonus", slip.bonus], ["Commission", slip.commission], ["Other allowance", slip.otherAllowance]];
    const deductions = [["Tax", slip.tax], ["National Insurance", slip.nationalInsurance], ["Pension", slip.pension], ["Other deduction", slip.otherDeduction], ["", ""]];
    earnings.forEach((earning, index) => {
      if (index % 2 === 0) doc.rect(LEFT, y, CONTENT_WIDTH, 31).fill(soft);
      doc.fillColor(ink).font("Helvetica").fontSize(8.6).text(earning[0], 56, y + 11, { width: 210, lineBreak: false });
      doc.fillColor(teal).font("Helvetica-Bold").text(money(earning[1]), 285, y + 11, { width: 90, align: "right", lineBreak: false });
      doc.fillColor(ink).font("Helvetica").text(deductions[index][0], 398, y + 11, { width: 85, lineBreak: false });
      doc.fillColor(teal).font("Helvetica-Bold").text(deductions[index][0] ? money(deductions[index][1]) : "", 482, y + 11, { width: 58, align: "right", lineBreak: false });
      doc.moveTo(LEFT, y + 31).lineTo(LEFT + CONTENT_WIDTH, y + 31).strokeColor(line).stroke();
      y += 31;
    });

    metaBox(doc, [
      ["Gross pay", money(slip.grossPay)],
      ["Total deductions", money(slip.totalDeductions)],
      ["Net pay", money(slip.netPay)]
    ], y + 24);

    const exchangeText = slip.exchangeRateValue
      ? `${slip.exchangeRateLabel || "Currency rate at issue"}: ${slip.exchangeRateValue}`
      : "Currency rate at issue: not provided";
    const paymentNotice = slip.paymentNotice || "Full payment may take additional time to be received because payment is processed through a broker. Payments may also be received partially before the remaining balance is completed.";
    doc.roundedRect(LEFT, y + 112, CONTENT_WIDTH, 98, 10).fill("#fffaf0").strokeColor("#f4d48c").stroke();
    doc.fillColor(teal).font("Helvetica-Bold").fontSize(8).text("CONFIDENTIAL PAYROLL NOTICE", 58, y + 129, { lineBreak: false });
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(8.2).text(exchangeText, 58, y + 148, { width: 470, lineBreak: false, ellipsis: true });
    doc.fillColor(ink).font("Helvetica").fontSize(8.1).text(paymentNotice, 58, y + 166, { width: 470, lineGap: 2 });

    finish(doc, resolve, chunks);
  });
}

export function generateOfferLetterPdf(offer) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true, info: { Title: `Offer Letter ${offer.offerNumber}`, Author: "Innovex Resource Group Limited" } });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, "Offer Letter", offer.offerNumber);
    doc.fillColor(muted).font("Helvetica").fontSize(8).text(dateLabel(new Date()), LEFT, 145, { lineBreak: false });
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(16).text(`Dear ${offer.candidateName},`, LEFT, 174, { width: CONTENT_WIDTH, lineBreak: false });
    doc.fillColor(teal).font("Helvetica-Bold").fontSize(18).text(`Offer of ${offer.roleTitle}`, LEFT, 214, { width: CONTENT_WIDTH, lineBreak: false, ellipsis: true });
    doc.fillColor(ink).font("Helvetica").fontSize(9.2).text("We are pleased to confirm your offer with Innovex Resource Group Limited. This letter outlines the key terms of the offer and the next steps required before commencement.", LEFT, 247, { width: CONTENT_WIDTH, lineGap: 3 });

    metaBox(doc, [
      ["Role", offer.roleTitle],
      ["Employment type", offer.employmentType],
      ["Start date", dateLabel(offer.startDate)],
      ["Location", offer.workLocation || "To be confirmed"]
    ], 304);

    let y = tableHeader(doc, 397, [
      { label: "OFFER DETAIL", x: 56, width: 180 },
      { label: "INFORMATION", x: 250, width: 290 }
    ]);
    const rows = [
      ["Salary / rate", `${offer.salaryType}: ${money(offer.salaryAmount)}`],
      ["Hours per week", offer.hoursPerWeek ? `${offer.hoursPerWeek} hours` : "To be confirmed"],
      ["Reporting to", offer.reportingTo || "To be confirmed"],
      ["Probation period", offer.probationPeriod || "To be confirmed"],
      ["Offer expiry", dateLabel(offer.offerExpiryDate)]
    ];
    rows.forEach((row, index) => {
      if (index % 2 === 0) doc.rect(LEFT, y, CONTENT_WIDTH, 34).fill(soft);
      doc.fillColor(muted).font("Helvetica-Bold").fontSize(8).text(row[0].toUpperCase(), 56, y + 12, { width: 170, lineBreak: false });
      doc.fillColor(ink).font("Helvetica").fontSize(8.8).text(row[1], 250, y + 12, { width: 290, lineBreak: false, ellipsis: true });
      doc.moveTo(LEFT, y + 34).lineTo(LEFT + CONTENT_WIDTH, y + 34).strokeColor(line).stroke();
      y += 34;
    });

    doc.fillColor(teal).font("Helvetica-Bold").fontSize(9).text("Conditions and next steps", LEFT, y + 32, { lineBreak: false });
    doc.fillColor(ink).font("Helvetica").fontSize(8.7).text(offer.conditions || "This offer is subject to satisfactory right-to-work checks, references, compliance documentation, and any role-specific requirements confirmed by the client or Innovex Resource Group Limited.", LEFT, y + 52, { width: CONTENT_WIDTH, lineGap: 3 });
    doc.fillColor(teal).font("Helvetica-Bold").fontSize(9).text("Benefits / additional notes", LEFT, y + 122, { lineBreak: false });
    doc.fillColor(ink).font("Helvetica").fontSize(8.7).text(offer.benefits || offer.notes || "Further onboarding information will be shared by the Innovex team once the offer is accepted.", LEFT, y + 142, { width: CONTENT_WIDTH, lineGap: 3 });

    doc.roundedRect(LEFT, 705, CONTENT_WIDTH, 54, 10).fill("#fffaf0").strokeColor("#f4d48c").stroke();
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(8.6).text("Please reply to this email to confirm acceptance or to request clarification.", 58, 724, { width: 468, lineBreak: false });

    finish(doc, resolve, chunks);
  });
}
