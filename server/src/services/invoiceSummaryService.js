import PDFDocument from "pdfkit";

export function invoiceSummaryRange(dateFrom, dateTo) {
  const valid = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
  if (!valid(dateFrom) || !valid(dateTo) || dateFrom > dateTo) {
    const error = new Error("Choose valid start and end dates. The end date must be on or after the start date.");
    error.statusCode = 400;
    throw error;
  }
  return { $gte: new Date(`${dateFrom}T00:00:00.000Z`), $lte: new Date(`${dateTo}T23:59:59.999Z`) };
}

export function buildInvoiceSummary(invoices, dateFrom, dateTo) {
  const groups = new Map();
  const statuses = {};
  for (const invoice of invoices) {
    statuses[invoice.status] = (statuses[invoice.status] || 0) + 1;
    if (["Draft", "Cancelled"].includes(invoice.status)) continue;
    const currency = invoice.currency || "GBP";
    if (!groups.has(currency)) groups.set(currency, { currency, count: 0, subtotal: 0, vatAmount: 0, total: 0, amountPaid: 0, balanceDue: 0 });
    const group = groups.get(currency);
    group.count += 1;
    for (const field of ["subtotal", "vatAmount", "total", "amountPaid", "balanceDue"]) group[field] += Math.round(Number(invoice[field] || 0) * 100);
  }
  const totals = [...groups.values()].map((group) => {
    for (const field of ["subtotal", "vatAmount", "total", "amountPaid", "balanceDue"]) group[field] /= 100;
    return group;
  });
  return { dateFrom, dateTo, generatedAt: new Date().toISOString(), count: invoices.length, statuses, totals, invoices };
}

const date = (value) => new Date(value).toLocaleDateString("en-GB", { timeZone: "UTC" });
const amount = (value) => Number(value || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function generateInvoiceSummaryPdf(summary) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", layout: "landscape", margin: 32 });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    let page = 0;
    let y;
    const text = (value, x, top, width, options = {}) => doc.text(String(value ?? ""), x, top, { width, ...options });
    const header = () => {
      page += 1;
      doc.rect(0, 0, doc.page.width, 85).fill("#064f5e");
      doc.fillColor("white").font("Helvetica-Bold").fontSize(19);
      text("Invoice summary", 32, 22, 450);
      doc.font("Helvetica").fontSize(10);
      text(`${date(summary.dateFrom)} - ${date(summary.dateTo)} | Invoice issue dates (inclusive)`, 32, 52, 700);
      doc.fillColor("#50676d").fontSize(8);
      text(`Generated ${new Date(summary.generatedAt).toLocaleString("en-GB", { timeZone: "Europe/London" })} (UK)`, 32, 555, 650);
      text(`Page ${page}`, 725, 555, 85, { align: "right" });
      y = 103;
    };
    const newPage = () => { doc.addPage(); header(); };
    header();
    doc.fillColor("#064f5e").font("Helvetica-Bold").fontSize(11);
    text(`${summary.count} invoices | ${summary.statuses.Draft || 0} drafts | ${summary.statuses.Cancelled || 0} cancelled`, 32, y, 770);
    y += 24;
    doc.font("Helvetica").fontSize(9);
    text("Totals exclude drafts and cancelled invoices. Paid and outstanding are current balances, not payments made during this period.", 32, y, 770);
    y += 28;
    for (const group of summary.totals) {
      if (y > 465) newPage();
      doc.fillColor("#064f5e").font("Helvetica-Bold").fontSize(10);
      text(`${group.currency} | ${group.count} issued invoices`, 32, y, 770);
      y += 18;
      doc.font("Helvetica").fontSize(9);
      text(`Net: ${amount(group.subtotal)}    VAT: ${amount(group.vatAmount)}    Total: ${amount(group.total)}    Paid: ${amount(group.amountPaid)}    Outstanding: ${amount(group.balanceDue)}`, 32, y, 770);
      y += 28;
    }
    const widths = [94, 166, 66, 66, 82, 40, 88, 88, 88];
    const labels = ["Invoice", "Client", "Issued", "Due", "Status", "CCY", "Total", "Paid", "Outstanding"];
    const tableHeader = () => {
      doc.rect(32, y, 778, 25).fill("#064f5e");
      doc.fillColor("white").font("Helvetica-Bold").fontSize(8);
      let x = 32;
      labels.forEach((label, index) => { text(label, x + 5, y + 8, widths[index] - 10, { align: index >= 6 ? "right" : "left" }); x += widths[index]; });
      y += 25;
    };
    if (y > 460) newPage();
    tableHeader();
    summary.invoices.forEach((invoice, index) => {
      const cells = [invoice.invoiceNumber, invoice.clientName, date(invoice.issueDate), date(invoice.dueDate), invoice.status, invoice.currency || "GBP", amount(invoice.total), amount(invoice.amountPaid), amount(invoice.balanceDue)];
      doc.font("Helvetica").fontSize(8);
      const rowHeight = Math.min(110, Math.max(32, ...cells.map((cell, i) => doc.heightOfString(String(cell || ""), { width: widths[i] - 10 }) + 16)));
      if (y + rowHeight > 530) { newPage(); tableHeader(); }
      doc.rect(32, y, 778, rowHeight).fill(index % 2 ? "#f0f6f6" : "#ffffff");
      doc.fillColor("#183e48").font("Helvetica").fontSize(8);
      let x = 32;
      cells.forEach((cell, i) => { text(cell, x + 5, y + 8, widths[i] - 10, { height: rowHeight - 12, ellipsis: true, align: i >= 6 ? "right" : "left" }); x += widths[i]; });
      y += rowHeight;
    });
    if (!summary.count) {
      doc.fillColor("#50676d").font("Helvetica").fontSize(10);
      text("No invoices found for this date range.", 38, y + 14, 740);
    }
    doc.end();
  });
}
