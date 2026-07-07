import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

const PAGE = { width: 841.89, height: 595.28 };
const MARGIN = 34;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;
const teal = "#064f5e";
const deepTeal = "#033d49";
const gold = "#f4b942";
const ink = "#173840";
const muted = "#667d84";
const line = "#d7e5e7";
const soft = "#f4f9f9";
const paleGold = "#fff6da";

function money(value) {
  return `\u00A3${Number(value || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateLabel(value) {
  return value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";
}

function safe(value, fallback = "-") {
  return String(value || fallback);
}

function drawLogo(doc, x, y, width = 72, height = 42) {
  const logoPath = path.join(process.cwd(), "client", "public", "Logo.png");
  if (!fs.existsSync(logoPath)) return false;
  try {
    doc.image(logoPath, x, y, { fit: [width, height], align: "left", valign: "center" });
    return true;
  } catch {
    return false;
  }
}

function truncate(value, limit = 90) {
  const text = safe(value, "").replace(/\s+/g, " ").trim();
  return text.length > limit ? `${text.slice(0, limit - 1)}...` : text;
}

function calculateTotals(expenses) {
  return expenses.reduce((sum, expense) => ({
    net: sum.net + Number(expense.netAmount || 0),
    vat: sum.vat + Number(expense.vatAmount || 0),
    gross: sum.gross + Number(expense.totalAmount || 0),
    unpaid: sum.unpaid + (expense.paymentStatus === "Unpaid" ? 1 : 0)
  }), { net: 0, vat: 0, gross: 0, unpaid: 0 });
}

function drawHeader(doc, { financialYear, totals, generatedAt }) {
  doc.rect(0, 0, PAGE.width, 10).fill(gold);
  doc.rect(0, 10, PAGE.width, 92).fill(deepTeal);
  const hasLogo = drawLogo(doc, MARGIN, 27, 70, 44);
  const brandX = hasLogo ? 120 : MARGIN;
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(12).text("INNOVEX RESOURCE GROUP LIMITED", brandX, 29, { width: 280, lineBreak: false });
  doc.fillColor("#b9d8dc").font("Helvetica").fontSize(8).text("Expense ledger prepared for UK bookkeeping and accountant review", brandX, 49, { width: 340, lineBreak: false });
  doc.fillColor("#d8eaec").fontSize(7.5).text("33 Forsythia Drive, Cardiff, CF23 7HP | info@innovexresourcegroup.co.uk | 0330 0435 830", brandX, 66, { width: 430, lineBreak: false });
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(25).text("EXPENSE LEDGER", 575, 27, { width: 230, align: "right", lineBreak: false });
  doc.fillColor(gold).fontSize(11).text(`Financial year ${financialYear}`, 575, 60, { width: 230, align: "right", lineBreak: false });

  const cards = [
    ["Records", String(totals.count)],
    ["Net spend", money(totals.net)],
    ["VAT recorded", money(totals.vat)],
    ["Gross spend", money(totals.gross)],
    ["Unpaid", String(totals.unpaid)]
  ];
  let x = MARGIN;
  cards.forEach(([label, value], index) => {
    const width = index === 0 ? 112 : 150;
    doc.roundedRect(x, 120, width, 52, 10).fill(index === 3 ? paleGold : "#ffffff").strokeColor(line).stroke();
    doc.fillColor(muted).font("Helvetica-Bold").fontSize(7).text(label.toUpperCase(), x + 12, 132, { width: width - 24, lineBreak: false });
    doc.fillColor(teal).font("Helvetica-Bold").fontSize(14).text(value, x + 12, 150, { width: width - 24, lineBreak: false });
    x += width + 10;
  });

  doc.fillColor(muted).font("Helvetica").fontSize(7.5).text(`Generated ${generatedAt}`, 665, 181, { width: 140, align: "right", lineBreak: false });
}

function drawTableHeader(doc, y) {
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 30, 7).fill(teal);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7);
  doc.text("LEDGER REF", 46, y + 11, { width: 74, lineBreak: false });
  doc.text("AUDIT ID", 124, y + 11, { width: 60, lineBreak: false });
  doc.text("DATE", 188, y + 11, { width: 64, lineBreak: false });
  doc.text("SUPPLIER", 257, y + 11, { width: 126, lineBreak: false });
  doc.text("CATEGORY", 388, y + 11, { width: 93, lineBreak: false });
  doc.text("REFERENCE / DESCRIPTION", 486, y + 11, { width: 155, lineBreak: false });
  doc.text("NET", 645, y + 11, { width: 52, align: "right", lineBreak: false });
  doc.text("VAT", 701, y + 11, { width: 48, align: "right", lineBreak: false });
  doc.text("GROSS", 754, y + 11, { width: 52, align: "right", lineBreak: false });
  return y + 30;
}

function drawExpenseRow(doc, expense, y, index) {
  const rowHeight = 44;
  if (index % 2 === 0) doc.rect(MARGIN, y, CONTENT_WIDTH, rowHeight).fill(soft);
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(7.4).text(safe(expense.ledgerNumber || expense.expenseNumber), 46, y + 9, { width: 74, height: 22, ellipsis: true });
  doc.fillColor(muted).font("Helvetica").fontSize(6.8).text(safe(expense.expenseNumber), 124, y + 9, { width: 60, height: 22, ellipsis: true });
  doc.fillColor(ink).font("Helvetica").fontSize(7.2).text(dateLabel(expense.expenseDate), 188, y + 9, { width: 64, lineBreak: false });
  doc.fillColor(ink).font("Helvetica-Bold").fontSize(7.4).text(truncate(expense.supplier, 32), 257, y + 9, { width: 126, height: 11, ellipsis: true });
  doc.fillColor(muted).font("Helvetica").fontSize(6.8).text(safe(expense.paymentStatus), 257, y + 23, { width: 126, lineBreak: false });
  doc.fillColor(ink).font("Helvetica").fontSize(7.2).text(safe(expense.category), 388, y + 9, { width: 93, height: 22, ellipsis: true });
  doc.fillColor(ink).font("Helvetica").fontSize(6.8).text(truncate([expense.reference, expense.description].filter(Boolean).join(" - "), 86), 486, y + 9, { width: 155, height: 27, ellipsis: true });
  doc.fillColor(ink).font("Helvetica").fontSize(7.2).text(money(expense.netAmount), 645, y + 9, { width: 52, align: "right", lineBreak: false });
  doc.text(money(expense.vatAmount), 701, y + 9, { width: 48, align: "right", lineBreak: false });
  doc.fillColor(teal).font("Helvetica-Bold").fontSize(7.2).text(money(expense.totalAmount), 754, y + 9, { width: 52, align: "right", lineBreak: false });
  doc.moveTo(MARGIN, y + rowHeight).lineTo(MARGIN + CONTENT_WIDTH, y + rowHeight).strokeColor(line).lineWidth(0.6).stroke();
  return y + rowHeight;
}

function drawFooter(doc, pageNumber, totalPages) {
  doc.moveTo(MARGIN, 557).lineTo(MARGIN + CONTENT_WIDTH, 557).strokeColor(line).lineWidth(0.7).stroke();
  doc.fillColor(muted).font("Helvetica").fontSize(6.8)
    .text("This report is system generated from the Innovex Finance Centre. Keep original receipts and supplier invoices for statutory records.", MARGIN, 566, { width: 620, lineBreak: false })
    .text("Innovex Resource Group Limited | Company No. 15975820 | Registered in England and Wales", MARGIN, 578, { width: 500, lineBreak: false });
  doc.fillColor(teal).font("Helvetica-Bold").fontSize(7).text(`PAGE ${pageNumber} OF ${totalPages}`, 705, 578, { width: 100, align: "right", lineBreak: false });
}

export function generateExpenseLedgerPdf({ expenses = [], financialYear = "All" }) {
  return new Promise((resolve, reject) => {
    const generatedAt = new Date().toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/London" });
    const totals = { ...calculateTotals(expenses), count: expenses.length };
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 0,
      bufferPages: true,
      autoFirstPage: true,
      info: {
        Title: `Innovex Expense Ledger ${financialYear}`,
        Author: "Innovex Resource Group Limited",
        Subject: "UK expense ledger export"
      }
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    drawHeader(doc, { financialYear, totals, generatedAt });
    let y = drawTableHeader(doc, 204);

    if (!expenses.length) {
      doc.roundedRect(MARGIN, y + 18, CONTENT_WIDTH, 62, 8).fill("#ffffff").strokeColor(line).stroke();
      doc.fillColor(ink).font("Helvetica-Bold").fontSize(12).text("No expenses found for this reporting period.", MARGIN + 18, y + 41, { lineBreak: false });
    }

    expenses.forEach((expense, index) => {
      if (y + 54 > 545) {
        doc.addPage({ size: "A4", layout: "landscape", margin: 0 });
        drawHeader(doc, { financialYear, totals, generatedAt });
        y = drawTableHeader(doc, 204);
      }
      y = drawExpenseRow(doc, expense, y, index);
    });

    const range = doc.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page += 1) {
      doc.switchToPage(page);
      drawFooter(doc, page + 1, range.count);
    }
    doc.end();
  });
}
