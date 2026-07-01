import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

const teal = "#064f5e";
const gold = "#f4b942";
const ink = "#173840";
const muted = "#657b82";
const line = "#d8e5e7";

function money(value) {
  return `£${Number(value || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateLabel(value) {
  return value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase() : "-";
}

function safe(value, fallback = "-") {
  return String(value || fallback);
}

function drawLabelValue(doc, label, value, x, y, width = 150) {
  doc.fillColor(muted).font("Helvetica-Bold").fontSize(7).text(label.toUpperCase(), x, y, { width });
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(9).text(safe(value), x, y + 11, { width });
}

function drawPageFooter(doc) {
  const y = 790;
  doc.moveTo(42, y - 8).lineTo(553, y - 8).strokeColor(line).stroke();
  doc.fillColor(muted).font("Helvetica").fontSize(7.2).text(
    "Innovex Resource Group Limited. Registered in England and Wales. Registered office: 33 Forsythia Drive, Cardiff, United Kingdom, CF23 7HP. Company number: 15975820.",
    42, y, { width: 511, align: "center" }
  );
}

function drawHeader(doc, invoice) {
  const logoPath = path.join(process.cwd(), "client", "public", "Logo.png");
  if (fs.existsSync(logoPath)) {
    try { doc.image(logoPath, 42, 35, { fit: [88, 52], align: "left" }); } catch { /* fallback below */ }
  }
  doc.fillColor(teal).font("Helvetica-Bold").fontSize(13).text("INNOVEX RESOURCE", 42, 91);
  doc.fillColor(gold).fontSize(8).text("GROUP LIMITED", 42, 108);
  doc.fillColor(teal).font("Helvetica-Bold").fontSize(27).text("INVOICE", 388, 35, { width: 165, align: "right" });
  doc.fillColor(ink).fontSize(13).text(invoice.invoiceNumber, 388, 70, { width: 165, align: "right" });
  doc.roundedRect(388, 96, 165, 33, 8).fill("#edf7f7");
  doc.fillColor(teal).fontSize(8).text(invoice.status.toUpperCase(), 400, 108, { width: 141, align: "center" });
}

function drawItemHeader(doc, y) {
  doc.roundedRect(42, y, 511, 25, 6).fill(teal);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7.3);
  doc.text("DESCRIPTION", 52, y + 9, { width: 184 });
  doc.text("PLACEMENT / SERVICE", 240, y + 9, { width: 176 });
  doc.text("NET AMOUNT", 425, y + 9, { width: 116, align: "right" });
  return y + 25;
}

function drawLineItem(doc, item, y, index) {
  const detailParts = [];
  if (item.client) detailParts.push(`Client: ${item.client}`);
  if (item.candidate) detailParts.push(`Candidate: ${item.candidate}`);
  if (Number(item.annualGrossSalary || 0) > 0) detailParts.push(`Annual salary: ${money(item.annualGrossSalary)}`);
  if (Number(item.serviceFeePercent || 0) > 0) detailParts.push(`Service fee: ${item.serviceFeePercent}%`);
  if (!detailParts.length) detailParts.push(`${item.quantity || 1} × ${money(item.unitPrice)}`);
  const leftText = [item.description, item.details].filter(Boolean).join("\n");
  const rowHeight = Math.max(45, doc.heightOfString(leftText, { width: 176 }) + 19, doc.heightOfString(detailParts.join("\n"), { width: 166 }) + 19);
  if (index % 2 === 0) doc.rect(42, y, 511, rowHeight).fill("#f7fbfb");
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(8.5).text(item.description, 52, y + 10, { width: 176 });
  if (item.details) doc.fillColor(muted).font("Helvetica").fontSize(7.4).text(item.details, 52, y + 23, { width: 176 });
  doc.fillColor(ink).font("Helvetica").fontSize(7.6).text(detailParts.join("\n"), 240, y + 10, { width: 176, lineGap: 2 });
  doc.fillColor(teal).font("Helvetica-Bold").fontSize(9).text(money(item.netAmount), 425, y + 10, { width: 116, align: "right" });
  doc.moveTo(42, y + rowHeight).lineTo(553, y + rowHeight).strokeColor(line).stroke();
  return y + rowHeight;
}

export function generateInvoicePdf(invoice) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 42, bufferPages: true, info: { Title: `Invoice ${invoice.invoiceNumber}`, Author: "Innovex Resource Group Limited" } });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, invoice);
    drawLabelValue(doc, "Invoice date", dateLabel(invoice.issueDate), 310, 150, 110);
    drawLabelValue(doc, "Due date", dateLabel(invoice.dueDate), 432, 150, 121);
    drawLabelValue(doc, "Sales person", invoice.salesPerson || "Innovex Team", 310, 188, 110);
    drawLabelValue(doc, "Order number", invoice.orderNumber || "-", 432, 188, 121);

    doc.fillColor(teal).font("Helvetica-Bold").fontSize(8).text("BILL TO", 42, 150);
    doc.fillColor(ink).fontSize(12).text(invoice.clientName, 42, 166, { width: 230 });
    doc.fillColor(muted).font("Helvetica").fontSize(8.5).text(
      [invoice.contactName ? `Attn: ${invoice.contactName}` : "", invoice.billingAddress, invoice.billingEmail].filter(Boolean).join("\n"),
      42, 184, { width: 230, lineGap: 3 }
    );

    let y = drawItemHeader(doc, 250);
    invoice.lineItems.forEach((item, index) => {
      const estimate = Math.max(45, doc.heightOfString([item.description, item.details].filter(Boolean).join("\n"), { width: 176 }) + 19);
      if (y + estimate > 650) {
        drawPageFooter(doc);
        doc.addPage();
        y = drawItemHeader(doc, 55);
      }
      y = drawLineItem(doc, item, y, index);
    });

    let totalsY;
    if (y > 480) {
      drawPageFooter(doc);
      doc.addPage();
      totalsY = 70;
    } else {
      totalsY = Math.max(y + 18, 470);
    }
    doc.fillColor(muted).font("Helvetica").fontSize(8).text(invoice.notes || "Thank you for your business.", 42, totalsY, { width: 280, lineGap: 3 });
    const totals = [
      ["Subtotal", invoice.subtotal],
      [`VAT (${invoice.vatRate || 0}%)`, invoice.vatAmount],
      ["Total GBP", invoice.total],
      ["Paid", invoice.amountPaid],
      ["Balance due", invoice.balanceDue]
    ];
    totals.forEach(([label, value], index) => {
      const rowY = totalsY + index * 24;
      if (index === totals.length - 1) doc.roundedRect(338, rowY - 6, 215, 27, 6).fill(gold);
      doc.fillColor(index === totals.length - 1 ? ink : muted).font("Helvetica-Bold").fontSize(index === totals.length - 1 ? 10 : 8)
        .text(label, 350, rowY, { width: 100 }).text(money(value), 450, rowY, { width: 91, align: "right" });
    });

    const paymentY = totalsY + 142;
    doc.roundedRect(42, paymentY, 511, 105, 10).fill("#f7fbfb").strokeColor(line).stroke();
    doc.fillColor(teal).font("Helvetica-Bold").fontSize(10).text("PAYMENT INFORMATION", 56, paymentY + 14);
    doc.fillColor(ink).font("Helvetica").fontSize(8).text(`Payment due on or before ${dateLabel(invoice.dueDate)}.`, 56, paymentY + 34);
    doc.text(`Account: ${invoice.bankDetails?.accountTitle || "Innovex Resource Group Limited"}`, 56, paymentY + 52);
    doc.text(`Bank: ${invoice.bankDetails?.bankName || "Barclays"}   Sort code: ${invoice.bankDetails?.sortCode || ""}   Account no: ${invoice.bankDetails?.accountNumber || ""}`, 56, paymentY + 68);
    doc.text(`BIC/SWIFT: ${invoice.bankDetails?.bic || ""}`, 56, paymentY + 84);
    doc.fillColor(muted).fontSize(7.5).text("Invoice queries: 0330 0435 830 | info@innovexresourcegroup.co.uk", 315, paymentY + 52, { width: 220, align: "right" });
    drawPageFooter(doc);

    const range = doc.bufferedPageRange();
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      doc.fillColor(muted).font("Helvetica").fontSize(7).text(`Page ${i + 1} of ${range.count}`, 480, 814, { width: 73, align: "right" });
    }
    doc.end();
  });
}
