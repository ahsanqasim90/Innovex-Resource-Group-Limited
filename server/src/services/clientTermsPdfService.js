import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

const COLORS = {
  ink: "#063f4a",
  teal: "#085766",
  gold: "#f4b942",
  mist: "#eef7f7",
  line: "#cfe4e8",
  muted: "#5f747c",
  softGold: "#fff5d8"
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 42;
const RIGHT = 42;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT;

function money(value) {
  return `£${Number(value || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

function logoPath() {
  return path.resolve(process.cwd(), "../client/public/Logo.png");
}

function drawLogo(doc, x, y, size = 42) {
  const file = logoPath();
  if (fs.existsSync(file)) {
    doc.image(file, x, y, { fit: [size, size] });
  } else {
    doc.roundedRect(x, y, size, size, 10).fill(COLORS.mist);
    doc.fillColor(COLORS.ink).fontSize(12).font("Helvetica-Bold").text("IRG", x, y + 14, { width: size, align: "center" });
  }
}

function addFooter(doc, pageNumber = 1) {
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor(COLORS.muted)
    .text("Innovex Resource Group Limited | 33 Forsythia Drive, Cardiff, United Kingdom, CF23 7HP", LEFT, 805, {
      width: CONTENT_WIDTH / 2
    })
    .text(`Page ${pageNumber}`, LEFT, 805, { width: CONTENT_WIDTH, align: "right" });
}

function addPage(doc) {
  doc.addPage({ margin: 0, size: "A4" });
  addFooter(doc, doc.bufferedPageRange().count);
  return 56;
}

function ensureSpace(doc, y, height) {
  return y + height > PAGE_HEIGHT - 64 ? addPage(doc) : y;
}

function labelValue(doc, x, y, label, value, width) {
  doc.fillColor(COLORS.muted).font("Helvetica-Bold").fontSize(8).text(label.toUpperCase(), x, y, { width });
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(10).text(value || "-", x, y + 13, { width });
}

function sectionTitle(doc, y, eyebrow, title) {
  y = ensureSpace(doc, y, 44);
  doc.fillColor("#00718a").font("Helvetica-Bold").fontSize(8).characterSpacing(1.4).text(eyebrow.toUpperCase(), LEFT, y);
  doc.characterSpacing(0).fillColor(COLORS.ink).fontSize(16).text(title, LEFT, y + 14);
  return y + 42;
}

function drawCommercialRow(doc, y, items) {
  const width = CONTENT_WIDTH / items.length;
  doc.roundedRect(LEFT, y, CONTENT_WIDTH, 58, 10).fill(COLORS.mist).stroke(COLORS.line);
  items.forEach((item, index) => {
    const x = LEFT + width * index + 14;
    if (index > 0) doc.moveTo(LEFT + width * index, y).lineTo(LEFT + width * index, y + 58).strokeColor(COLORS.line).stroke();
    labelValue(doc, x, y + 13, item.label, item.value, width - 24);
  });
  return y + 76;
}

function drawRoleRates(doc, y, roleRates = []) {
  y = sectionTitle(doc, y, "Commercial schedule", "Role rates and payment triggers");
  if (!roleRates.length) {
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(10).text("No role-specific rates added. Fees will be agreed in writing before service delivery.", LEFT, y);
    return y + 28;
  }

  const columns = [150, 90, 80, 130, 61];
  y = ensureSpace(doc, y, 40);
  doc.roundedRect(LEFT, y, CONTENT_WIDTH, 30, 8).fill(COLORS.teal);
  ["Role", "Fee type", "Rate", "Payment trigger", "Notes"].forEach((heading, index) => {
    const x = LEFT + columns.slice(0, index).reduce((sum, value) => sum + value, 0) + 10;
    doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(8).text(heading.toUpperCase(), x, y + 10, { width: columns[index] - 12 });
  });
  y += 30;

  roleRates.forEach((rate, index) => {
    const rowHeight = Math.max(
      48,
      doc.heightOfString(rate.roleTitle || "-", { width: columns[0] - 14 }) + 24,
      doc.heightOfString(rate.paymentTrigger || "-", { width: columns[3] - 14 }) + 24,
      doc.heightOfString(rate.notes || "-", { width: columns[4] - 14 }) + 24
    );
    y = ensureSpace(doc, y, rowHeight + 4);
    doc.rect(LEFT, y, CONTENT_WIDTH, rowHeight).fill(index % 2 === 0 ? "#ffffff" : "#f7fbfb").stroke(COLORS.line);
    const values = [
      rate.roleTitle,
      rate.feeType,
      rate.feeType === "Flat Fee" ? money(rate.rateValue) : `${rate.rateValue || 0}${rate.rateUnit ? ` ${rate.rateUnit}` : ""}`,
      rate.paymentTrigger,
      rate.notes || "-"
    ];
    values.forEach((value, columnIndex) => {
      const x = LEFT + columns.slice(0, columnIndex).reduce((sum, column) => sum + column, 0) + 10;
      doc.fillColor(COLORS.ink).font(columnIndex === 0 ? "Helvetica-Bold" : "Helvetica").fontSize(8.5).text(String(value || "-"), x, y + 12, {
        width: columns[columnIndex] - 14
      });
    });
    y += rowHeight;
  });
  return y + 22;
}

function drawClauses(doc, y, clauses = []) {
  y = sectionTitle(doc, y, "Agreement clauses", "Terms of business");
  clauses
    .slice()
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .forEach((clause, index) => {
      const heading = `${index + 1}. ${clause.heading}`;
      const body = clause.body || "";
      const height = doc.heightOfString(body, { width: CONTENT_WIDTH - 24 }) + 50;
      y = ensureSpace(doc, y, height);
      doc.roundedRect(LEFT, y, CONTENT_WIDTH, height - 10, 8).fill("#ffffff").stroke(COLORS.line);
      doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(11).text(heading, LEFT + 12, y + 12, { width: CONTENT_WIDTH - 24 });
      doc.fillColor(COLORS.muted).font("Helvetica").fontSize(9.5).text(body, LEFT + 12, y + 31, {
        width: CONTENT_WIDTH - 24,
        lineGap: 2
      });
      y += height;
    });
  return y;
}

export function generateClientTermsPdf(terms) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: "A4", bufferPages: true });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    doc.rect(0, 0, PAGE_WIDTH, 142).fill(COLORS.teal);
    doc.rect(0, 136, PAGE_WIDTH, 6).fill(COLORS.gold);
    drawLogo(doc, LEFT, 34, 48);
    doc
      .fillColor("#cdeff1")
      .font("Helvetica-Bold")
      .fontSize(8)
      .characterSpacing(1.6)
      .text("INNOVEX RESOURCE GROUP LIMITED", LEFT + 62, 42)
      .characterSpacing(0)
      .fillColor("#ffffff")
      .fontSize(25)
      .text(terms.title || "Terms of Business", LEFT + 62, 56, { width: 300 })
      .fontSize(10)
      .fillColor("#d8f0f2")
      .text("Client-specific commercial terms for recruitment, staffing and support services.", LEFT + 62, 92, { width: 330 });

    doc.roundedRect(392, 35, 160, 76, 12).fill("#ffffff").stroke(COLORS.line);
    labelValue(doc, 410, 50, "Document", terms.documentNumber, 126);
    labelValue(doc, 410, 78, "Status", terms.status, 126);

    addFooter(doc, 1);
    let y = 174;

    y = sectionTitle(doc, y, "Client agreement", "Parties and commercial summary");
    doc.roundedRect(LEFT, y, CONTENT_WIDTH, 98, 12).fill("#ffffff").stroke(COLORS.line);
    drawLogo(doc, LEFT + 16, y + 19, 42);
    doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(12).text("Innovex Resource Group Limited", LEFT + 70, y + 22);
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(9).text("33 Forsythia Drive, Cardiff, United Kingdom, CF23 7HP", LEFT + 70, y + 42, { width: 190 });
    doc.moveTo(LEFT + 255, y + 16).lineTo(LEFT + 255, y + 82).strokeColor(COLORS.line).stroke();
    labelValue(doc, LEFT + 278, y + 18, "Client", terms.clientName, 200);
    labelValue(doc, LEFT + 278, y + 48, "Contact", terms.contactName || terms.clientEmail, 200);
    labelValue(doc, LEFT + 278, y + 72, "Email", terms.clientEmail, 200);
    y += 122;

    y = drawCommercialRow(doc, y, [
      { label: "Agreement type", value: terms.agreementType },
      { label: "Effective date", value: formatDate(terms.effectiveDate) },
      { label: "Payment due", value: `${terms.paymentDueDays || 0} days` },
      { label: "Rebate period", value: `${terms.rebatePeriodDays || 0} days` }
    ]);

    y = drawRoleRates(doc, y, terms.roleRates || []);

    y = sectionTitle(doc, y, "Payment cycle", "Invoice and rebate details");
    y = ensureSpace(doc, y, 110);
    doc.roundedRect(LEFT, y, CONTENT_WIDTH, 94, 12).fill(COLORS.softGold).stroke("#f0d58a");
    doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(10).text("Invoice cycle", LEFT + 16, y + 16);
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(9.5).text(terms.invoiceCycle || "-", LEFT + 16, y + 34, { width: 225 });
    doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(10).text("Rebate terms", LEFT + 278, y + 16);
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(9.5).text(terms.rebateTerms || "-", LEFT + 278, y + 34, { width: 215 });
    y += 116;

    if (terms.specialTerms) {
      y = sectionTitle(doc, y, "Special conditions", "Client-specific notes");
      const height = Math.max(70, doc.heightOfString(terms.specialTerms, { width: CONTENT_WIDTH - 28 }) + 40);
      y = ensureSpace(doc, y, height);
      doc.roundedRect(LEFT, y, CONTENT_WIDTH, height, 10).fill("#ffffff").stroke(COLORS.line);
      doc.fillColor(COLORS.muted).font("Helvetica").fontSize(9.5).text(terms.specialTerms, LEFT + 14, y + 16, { width: CONTENT_WIDTH - 28, lineGap: 2 });
      y += height + 22;
    }

    y = drawClauses(doc, y, terms.clauses || []);

    y = ensureSpace(doc, y, 140);
    y = sectionTitle(doc, y, "Acceptance", "Signatures");
    doc.roundedRect(LEFT, y, 240, 94, 12).fill("#ffffff").stroke(COLORS.line);
    doc.roundedRect(LEFT + 270, y, 240, 94, 12).fill("#ffffff").stroke(COLORS.line);
    labelValue(doc, LEFT + 16, y + 18, "For Innovex Resource Group Limited", "Authorised representative", 200);
    labelValue(doc, LEFT + 286, y + 18, "For client", terms.clientName, 200);
    doc.moveTo(LEFT + 16, y + 66).lineTo(LEFT + 216, y + 66).strokeColor(COLORS.line).stroke();
    doc.moveTo(LEFT + 286, y + 66).lineTo(LEFT + 486, y + 66).strokeColor(COLORS.line).stroke();
    doc.fillColor(COLORS.muted).font("Helvetica").fontSize(8).text("Signature / date", LEFT + 16, y + 72);
    doc.text("Signature / date", LEFT + 286, y + 72);

    doc.end();
  });
}
