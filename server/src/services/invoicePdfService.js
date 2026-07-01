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
  return value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase() : "-";
}

function safe(value, fallback = "-") {
  return String(value || fallback);
}

function drawLogo(doc, x, y, width = 78, height = 45) {
  const logoPath = path.join(process.cwd(), "client", "public", "Logo.png");
  if (!fs.existsSync(logoPath)) return false;
  try {
    doc.image(logoPath, x, y, { fit: [width, height], align: "left", valign: "center" });
    return true;
  } catch {
    return false;
  }
}

function drawHeader(doc, invoice, continuation = false) {
  doc.rect(0, 0, PAGE_WIDTH, 10).fill(gold);
  doc.rect(0, 10, PAGE_WIDTH, 112).fill(deepTeal);
  const hasLogo = drawLogo(doc, LEFT, 32, 76, 48);
  const brandX = hasLogo ? 128 : LEFT;
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(14).text("INNOVEX RESOURCE GROUP LIMITED", brandX, 39, { width: 260, lineBreak: false });
  doc.fillColor("#b9d8dc").font("Helvetica").fontSize(8.5).text("Recruitment, training and digital business services", brandX, 62, { width: 280, lineBreak: false });
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(continuation ? 17 : 29).text(continuation ? "INVOICE CONTINUED" : "INVOICE", 390, 31, { width: 163, align: "right", lineBreak: false });
  doc.fillColor(gold).fontSize(12).text(safe(invoice.invoiceNumber), 390, 68, { width: 163, align: "right", lineBreak: false });
  doc.roundedRect(455, 88, 98, 22, 11).fill("#ffffff");
  doc.fillColor(teal).font("Helvetica-Bold").fontSize(7.5).text(safe(invoice.status).toUpperCase(), 465, 96, { width: 78, align: "center", lineBreak: false });
}

function drawFooter(doc, pageNumber, totalPages) {
  doc.moveTo(LEFT, 784).lineTo(LEFT + CONTENT_WIDTH, 784).strokeColor(line).lineWidth(0.8).stroke();
  doc.fillColor(muted).font("Helvetica").fontSize(6.5)
    .text("Innovex Resource Group Limited | Company No. 15975820 | Registered in England and Wales", LEFT, 793, { width: CONTENT_WIDTH, align: "center", lineBreak: false })
    .text("33 Forsythia Drive, Cardiff, CF23 7HP | info@innovexresourcegroup.co.uk | 0330 0435 830", LEFT, 804, { width: CONTENT_WIDTH, align: "center", lineBreak: false });
  doc.fillColor(teal).font("Helvetica-Bold").fontSize(6.5).text(`PAGE ${pageNumber} OF ${totalPages}`, 470, 819, { width: 83, align: "right", lineBreak: false });
}

function drawMetaValue(doc, label, value, x, y, width) {
  doc.fillColor(muted).font("Helvetica-Bold").fontSize(6.8).text(label.toUpperCase(), x, y, { width, lineBreak: false });
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(9).text(safe(value), x, y + 13, { width, lineBreak: false });
}

function drawParties(doc, invoice) {
  doc.fillColor(teal).font("Helvetica-Bold").fontSize(7.5).text("BILL TO", LEFT, 150, { lineBreak: false });
  doc.fillColor(ink).fontSize(13).text(invoice.clientName, LEFT, 166, { width: 260, lineBreak: false, ellipsis: true });
  const address = [invoice.contactName ? `Attn: ${invoice.contactName}` : "", invoice.billingAddress, invoice.billingEmail].filter(Boolean).join("\n");
  doc.fillColor(muted).font("Helvetica").fontSize(8.2).text(address, LEFT, 188, { width: 260, height: 58, lineGap: 2, ellipsis: true });

  doc.roundedRect(330, 145, 223, 92, 9).fill(soft).strokeColor(line).stroke();
  drawMetaValue(doc, "Invoice date", dateLabel(invoice.issueDate), 344, 160, 92);
  drawMetaValue(doc, "Due date", dateLabel(invoice.dueDate), 448, 160, 91);
  drawMetaValue(doc, "Sales person", invoice.salesPerson || "Innovex Team", 344, 198, 92);
  drawMetaValue(doc, "Order reference", invoice.orderNumber || "-", 448, 198, 91);
}

function drawItemHeader(doc, y) {
  doc.roundedRect(LEFT, y, CONTENT_WIDTH, 27, 6).fill(teal);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7.2);
  doc.text("DESCRIPTION", 53, y + 10, { width: 190, lineBreak: false });
  doc.text("SERVICE DETAILS", 252, y + 10, { width: 175, lineBreak: false });
  doc.text("NET AMOUNT", 438, y + 10, { width: 103, align: "right", lineBreak: false });
  return y + 27;
}

function itemDetails(item) {
  const details = [];
  if (item.client) details.push(`Client: ${item.client}`);
  if (item.candidate) details.push(`Candidate: ${item.candidate}`);
  if (Number(item.annualGrossSalary || 0) > 0) details.push(`Annual salary: ${money(item.annualGrossSalary)}`);
  if (Number(item.serviceFeePercent || 0) > 0) details.push(`Service fee: ${item.serviceFeePercent}%`);
  if (!details.length) details.push(`${item.quantity || 1} x ${money(item.unitPrice)}`);
  return details.join("\n");
}

function estimateRowHeight(doc, item) {
  const description = [item.description, item.details].filter(Boolean).join("\n");
  return Math.max(48, doc.heightOfString(description, { width: 184, lineGap: 2 }) + 20, doc.heightOfString(itemDetails(item), { width: 166, lineGap: 2 }) + 20);
}

function drawLineItem(doc, item, y, index) {
  const rowHeight = estimateRowHeight(doc, item);
  if (index % 2 === 0) doc.rect(LEFT, y, CONTENT_WIDTH, rowHeight).fill(soft);
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(8.5).text(item.description, 53, y + 11, { width: 184, height: rowHeight - 18, ellipsis: true });
  if (item.details) doc.fillColor(muted).font("Helvetica").fontSize(7.3).text(item.details, 53, y + 27, { width: 184, height: rowHeight - 34, ellipsis: true });
  doc.fillColor(ink).font("Helvetica").fontSize(7.6).text(itemDetails(item), 252, y + 11, { width: 166, height: rowHeight - 18, lineGap: 2, ellipsis: true });
  doc.fillColor(teal).font("Helvetica-Bold").fontSize(9).text(money(item.netAmount), 438, y + 11, { width: 103, align: "right", lineBreak: false });
  doc.moveTo(LEFT, y + rowHeight).lineTo(LEFT + CONTENT_WIDTH, y + rowHeight).strokeColor(line).lineWidth(0.7).stroke();
  return y + rowHeight;
}

function drawTotalsAndPayment(doc, invoice, y) {
  const top = Math.max(y + 18, 420);
  const notesHeight = 105;
  doc.roundedRect(LEFT, top, 286, notesHeight, 9).fill(soft).strokeColor(line).stroke();
  doc.fillColor(teal).font("Helvetica-Bold").fontSize(7.5).text("NOTES & PAYMENT TERMS", 56, top + 14, { lineBreak: false });
  doc.fillColor(ink).font("Helvetica").fontSize(8).text(invoice.notes || "Thank you for choosing Innovex Resource Group Limited.", 56, top + 31, { width: 258, height: 30, ellipsis: true });
  doc.fillColor(muted).fontSize(7.3).text(invoice.paymentTerms || "Payment is due by the date shown on this invoice.", 56, top + 69, { width: 258, height: 23, ellipsis: true });

  const totals = [
    ["Subtotal", invoice.subtotal],
    [`VAT (${invoice.vatRate || 0}%)`, invoice.vatAmount],
    ["Total GBP", invoice.total],
    ["Paid", invoice.amountPaid]
  ];
  totals.forEach(([label, value], index) => {
    const rowY = top + index * 22;
    doc.fillColor(muted).font("Helvetica-Bold").fontSize(7.7).text(label, 350, rowY + 5, { width: 96, lineBreak: false });
    doc.fillColor(ink).text(money(value), 450, rowY + 5, { width: 103, align: "right", lineBreak: false });
  });
  doc.roundedRect(342, top + 88, 211, 38, 8).fill(gold);
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(9).text("BALANCE DUE", 356, top + 102, { width: 95, lineBreak: false });
  doc.fontSize(12).text(money(invoice.balanceDue), 451, top + 99, { width: 88, align: "right", lineBreak: false });

  const paymentY = top + 145;
  doc.roundedRect(LEFT, paymentY, CONTENT_WIDTH, 104, 10).fill("#eef7f7").strokeColor(line).stroke();
  doc.fillColor(teal).font("Helvetica-Bold").fontSize(9).text("PAYMENT INFORMATION", 56, paymentY + 14, { lineBreak: false });
  doc.fillColor(ink).font("Helvetica").fontSize(7.8).text(`Please pay by ${dateLabel(invoice.dueDate)} using invoice ${invoice.invoiceNumber} as the payment reference.`, 56, paymentY + 32, { width: 480, lineBreak: false });
  doc.fillColor(muted).font("Helvetica-Bold").fontSize(6.7).text("ACCOUNT NAME", 56, paymentY + 56, { lineBreak: false });
  doc.fillColor(ink).fontSize(8).text(invoice.bankDetails?.accountTitle || "Innovex Resource Group Limited", 56, paymentY + 69, { width: 190, lineBreak: false, ellipsis: true });
  doc.fillColor(muted).fontSize(6.7).text("BANK", 260, paymentY + 56, { lineBreak: false });
  doc.fillColor(ink).fontSize(8).text(invoice.bankDetails?.bankName || "-", 260, paymentY + 69, { width: 82, lineBreak: false, ellipsis: true });
  doc.fillColor(muted).fontSize(6.7).text("SORT CODE", 352, paymentY + 56, { lineBreak: false });
  doc.fillColor(ink).fontSize(8).text(invoice.bankDetails?.sortCode || "-", 352, paymentY + 69, { width: 75, lineBreak: false });
  doc.fillColor(muted).fontSize(6.7).text("ACCOUNT NO.", 437, paymentY + 56, { lineBreak: false });
  doc.fillColor(ink).fontSize(8).text(invoice.bankDetails?.accountNumber || "-", 437, paymentY + 69, { width: 102, lineBreak: false });
  if (invoice.bankDetails?.bic) doc.fillColor(muted).font("Helvetica").fontSize(6.8).text(`BIC/SWIFT: ${invoice.bankDetails.bic}`, 437, paymentY + 85, { width: 102, lineBreak: false });
}

export function generateInvoicePdf(invoice) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 0, bufferPages: true, autoFirstPage: true, info: { Title: `Invoice ${invoice.invoiceNumber}`, Author: "Innovex Resource Group Limited", Subject: `Invoice for ${invoice.clientName}` } });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, invoice);
    drawParties(doc, invoice);
    let y = drawItemHeader(doc, 262);

    (invoice.lineItems || []).forEach((item, index) => {
      const rowHeight = estimateRowHeight(doc, item);
      if (y + rowHeight > 505) {
        doc.addPage({ size: "A4", margin: 0 });
        drawHeader(doc, invoice, true);
        y = drawItemHeader(doc, 154);
      }
      y = drawLineItem(doc, item, y, index);
    });

    if (y > 505) {
      doc.addPage({ size: "A4", margin: 0 });
      drawHeader(doc, invoice, true);
      y = 154;
    }
    drawTotalsAndPayment(doc, invoice, y);

    const range = doc.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page += 1) {
      doc.switchToPage(page);
      drawFooter(doc, page + 1, range.count);
    }
    doc.end();
  });
}
