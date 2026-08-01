import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

const COLORS = {
  ink: "#073f4a",
  teal: "#075767",
  tealDark: "#043f4d",
  gold: "#f4b942",
  mist: "#eef7f7",
  pale: "#f8fbfb",
  line: "#cfe2e5",
  muted: "#60777e",
  white: "#ffffff",
  black: "#17272c"
};

const PAGE = { width: 595.28, height: 841.89 };
const MARGIN = 46;
const CONTENT_WIDTH = PAGE.width - MARGIN * 2;
const CONTENT_BOTTOM = 560;

function firstExistingPath(candidates) {
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function termsTemplatePath() {
  return firstExistingPath([
    path.resolve(process.cwd(), "server/assets/irg-terms-template.txt"),
    path.resolve(process.cwd(), "assets/irg-terms-template.txt")
  ]);
}

function logoPath() {
  return firstExistingPath([
    path.resolve(process.cwd(), "client/public/Logo.png"),
    path.resolve(process.cwd(), "../client/public/Logo.png"),
    path.resolve(process.cwd(), "public/Logo.png")
  ]);
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });
}

function cleanLegalText(value) {
  const pound = String.fromCharCode(163);
  const replacements = [
    ["â€œ", '"'],
    ["â€", '"'],
    ["â€™", "'"],
    ["â€˜", "'"],
    ["â€¢", "-"],
    ["â€“", "-"],
    ["â€”", "-"],
    ["Â£", pound],
    ["Â", ""]
  ];
  let text = String(value || "").replace(/\r\n/g, "\n");
  replacements.forEach(([from, to]) => {
    text = text.split(from).join(to);
  });
  return text
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/\t+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[^\S\n]+/g, " ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A3]/g, "")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\batthe\b/gi, "at the")
    .replace(/Engagement\]/g, "Engagement")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function professionalizeLegalText(value) {
  return String(value || "")
    .replace(
      /a company incorporated in England and Wales under company number 15975820 and whose\s+registered office is at 33 Forsythia Drive, Cardiff, Wales, CF23 7HP, United Kingdom\s+\("the Employment Agency"\);/i,
      'Innovex Resource Group Limited is incorporated in England and Wales under company number 15975820, with its registered office at 33 Forsythia Drive, Cardiff, Wales, CF23 7HP, United Kingdom (the "Employment Agency" or "Agency").'
    )
    .replace(/person; firm, organization/gi, "person, firm, organisation")
    .replace(/\bMeans:\b/g, "means:")
    .replace(/The Agency endeavors/gi, "The Agency endeavours")
    .replace(/willing to work to work/gi, "willing to work")
    .replace(
      /Cash refunds will be offered once agreed in writing by the Agency\./gi,
      "Cash refunds will only be offered where agreed in writing by the Agency."
    )
    .replace(/4\.1\.\s+Refunds will be issued/gi, "4.2. Refunds will be issued")
    .replace(/4\.2\.\s+If the Engagement terminates/gi, "4.3. If the Engagement terminates")
    .replace(/4\.3\.\s+In circumstances where clause 3\.6 applies/gi, "4.4. In circumstances where clause 3.6 applies")
    .replace(/4\.4\.\s+If the candidate dies/gi, "4.5. If the candidate dies")
    .replace(
      /By signing this document, I the "Client" agree for Agency Innovex Resource Group Limited\(Company Registration no: 15975820\) to supply us with candidates in accordance with terms above\./gi,
      "By signing this document, the Client confirms acceptance of these Terms of Business and authorises Innovex Resource Group Limited (Company Registration no: 15975820) to introduce candidates in accordance with the terms set out above."
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function applyClientSettings(value, terms) {
  const paymentDays = Number(terms.paymentDueDays ?? 14);
  const rebateDays = Number(terms.rebatePeriodDays ?? 28);
  return String(value)
    .replace(/within\s+7\s+days\s+of\s+the\s+date\s+of\s+invoice/gi, `within ${paymentDays} days of the date of invoice`)
    .replace(/within\s+7\s+days\s+of\s+invoice/gi, `within ${paymentDays} days of invoice`)
    .replace(/within\s+15\s+days\s+of\s+its\s+termination/gi, `within ${rebateDays} days of its termination`);
}

function loadStructuredTerms(terms) {
  const template = termsTemplatePath();
  if (!fs.existsSync(template)) throw new Error("IRG terms template text file is missing.");

  let text = applyClientSettings(professionalizeLegalText(cleanLegalText(fs.readFileSync(template, "utf8"))), terms);
  const signatureIndex = text.search(/\n\s*Terms of business agreement/i);
  if (signatureIndex >= 0) text = text.slice(0, signatureIndex).trim();

  const firstClauseIndex = text.search(/^1\.\s+DEFINITIONS/im);
  if (firstClauseIndex >= 0) text = text.slice(firstClauseIndex);

  text = text.replace(
    /Salary Range\s+Percentage[\s\S]*?(?=\n\s*3\.5\.)/i,
    "\n\n[[FEE_TABLE]]\n\n"
  );
  text = text.replace(
    /Week in which Applicant Leaves\s+% of Introduction Fee Refunded[\s\S]*?9 to 12 weeks\s+25%/i,
    "\n\n[[REBATE_TABLE]]\n\n"
  );

  return text;
}

function drawLogo(doc, x, y, width = 62, height = 42) {
  const file = logoPath();
  if (fs.existsSync(file)) {
    doc.image(file, x, y, { fit: [width, height], align: "left", valign: "center" });
    return;
  }
  doc.roundedRect(x, y, height, height, 10).fill(COLORS.mist);
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(11).text("IRG", x, y + 14, {
    width: height,
    align: "center"
  });
}

function drawFooter(doc, pageNumber, documentNumber) {
  doc
    .strokeColor(COLORS.line)
    .lineWidth(0.7)
    .moveTo(MARGIN, 764)
    .lineTo(PAGE.width - MARGIN, 764)
    .stroke();
  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(7.5)
    .text("Innovex Resource Group Limited  |  Company No. 15975820  |  info@innovexresourcegroup.co.uk", MARGIN, 775, {
      width: CONTENT_WIDTH - 84,
      height: 12,
      lineBreak: false
    })
    .text(`${documentNumber}  |  Page ${pageNumber}`, PAGE.width - MARGIN - 120, 775, {
      width: 120,
      height: 12,
      align: "right",
      lineBreak: false
    });
}

function drawPageHeader(doc, terms) {
  drawLogo(doc, MARGIN, 11, 42, 42);
  doc
    .fillColor(COLORS.ink)
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("INNOVEX RESOURCE GROUP LIMITED", MARGIN + 54, 25, {
      characterSpacing: 0.8,
      height: 14,
      lineBreak: false
    });
  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(8)
    .text(`${terms.documentNumber}  |  TERMS OF BUSINESS`, PAGE.width - MARGIN - 200, 26, {
      width: 200,
      height: 12,
      align: "right",
      lineBreak: false
    });
  doc.rect(MARGIN, 57, CONTENT_WIDTH, 3).fill(COLORS.gold);
}

function addContentPage(doc, terms) {
  doc.addPage({ margin: 0, size: "A4" });
  return 78;
}

function ensureSpace(doc, y, needed, terms) {
  return y + needed > CONTENT_BOTTOM ? addContentPage(doc, terms) : y;
}

function drawLabelValue(doc, x, y, label, value, width) {
  doc.fillColor(COLORS.muted).font("Helvetica-Bold").fontSize(7.4).text(label.toUpperCase(), x, y, {
    width,
    characterSpacing: 0.5
  });
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(10).text(value || "-", x, y + 14, {
    width,
    ellipsis: true
  });
}

function drawCover(doc, terms) {
  doc.rect(0, 0, PAGE.width, PAGE.height).fill(COLORS.white);
  doc.rect(0, 0, PAGE.width, 242).fill(COLORS.tealDark);
  doc.rect(0, 236, PAGE.width, 6).fill(COLORS.gold);
  drawLogo(doc, MARGIN, 22, 94, 94);

  doc
    .fillColor("#c9e8eb")
    .font("Helvetica-Bold")
    .fontSize(8.5)
    .text("INNOVEX RESOURCE GROUP LIMITED", MARGIN, 112, { characterSpacing: 1.7 });
  doc
    .fillColor(COLORS.white)
    .font("Helvetica-Bold")
    .fontSize(28)
    .text("Terms of Business", MARGIN, 134, { width: 330 });
  doc
    .fillColor("#d5edef")
    .font("Helvetica")
    .fontSize(11)
    .text("Introduction of candidates for direct employment or engagement", MARGIN, 174, {
      width: 345,
      lineGap: 2
    });

  doc.roundedRect(390, 40, 160, 134, 14).fill(COLORS.white);
  drawLabelValue(doc, 408, 57, "Document number", terms.documentNumber, 124);
  drawLabelValue(doc, 408, 94, "Agreement type", terms.agreementType || "Recruitment", 124);
  drawLabelValue(doc, 408, 131, "Status", terms.status || "Draft", 124);

  let y = 282;
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(17).text("Prepared for", MARGIN, y);
  y += 30;
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 148, 16).fill(COLORS.pale).stroke(COLORS.line);
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(18).text(terms.clientName || "-", MARGIN + 18, y + 18, {
    width: CONTENT_WIDTH - 36
  });
  drawLabelValue(doc, MARGIN + 18, y + 58, "Contact", terms.contactName || "-", 220);
  drawLabelValue(doc, MARGIN + 270, y + 58, "Email", terms.clientEmail || "-", 215);
  drawLabelValue(doc, MARGIN + 18, y + 98, "Effective date", formatDate(terms.effectiveDate), 220);
  drawLabelValue(doc, MARGIN + 270, y + 98, "Valid until", formatDate(terms.validUntil), 215);

  y += 178;
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(14).text("Commercial summary", MARGIN, y);
  y += 24;
  const cardWidth = (CONTENT_WIDTH - 24) / 3;
  const summary = [
    ["Payment terms", `${Number(terms.paymentDueDays ?? 14)} days`],
    ["Rebate period", `${Number(terms.rebatePeriodDays ?? 28)} days`],
    ["Role rates", `${terms.roleRates?.length || 0} agreed`]
  ];
  summary.forEach(([label, value], index) => {
    const x = MARGIN + index * (cardWidth + 12);
    doc.roundedRect(x, y, cardWidth, 78, 12).fill(index === 1 ? "#fff8e8" : COLORS.mist).stroke(COLORS.line);
    drawLabelValue(doc, x + 14, y + 16, label, value, cardWidth - 28);
  });

  y += 106;
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 82, 14).fill(COLORS.mist);
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(11).text("Important", MARGIN + 16, y + 15);
  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(9)
    .text(
      "This document combines Innovex Resource Group Limited's standard legal terms with the client-specific commercial schedule recorded in the CRM. Please retain a signed copy for your records.",
      MARGIN + 16,
      y + 36,
      { width: CONTENT_WIDTH - 32, lineGap: 2 }
    );

}

function rateDisplay(rate) {
  const value = Number(rate.rateValue || 0);
  if (rate.feeType === "Percentage") return `${value}%`;
  if (rate.feeType === "Flat Fee") return `${String.fromCharCode(163)}${value.toLocaleString("en-GB")} per placement`;
  if (rate.feeType === "Hourly Margin") {
    return `${String.fromCharCode(163)}${value.toLocaleString("en-GB", { minimumFractionDigits: 2 })} ${rate.rateUnit || "per hour"}`;
  }
  return `${value}${rate.rateUnit ? ` ${rate.rateUnit}` : ""}`;
}

function tableRow(doc, y, columns, values, height, fill, textColor = COLORS.black, bold = false) {
  let x = MARGIN;
  columns.forEach((width, index) => {
    doc.rect(x, y, width, height).fill(fill).stroke(COLORS.line);
    doc
      .fillColor(textColor)
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(8.5)
      .text(values[index] || "-", x + 9, y + 9, {
        width: width - 18,
        height: height - 12,
        ellipsis: true
      });
    x += width;
  });
}

function drawFeeTable(doc, y, terms) {
  const rows = (terms.roleRates || []).filter((rate) => rate.roleTitle);
  const safeRows = rows.length
    ? rows
    : [{ roleTitle: "All roles", feeType: "Custom", rateValue: 0, rateUnit: "To be agreed in writing", paymentTrigger: "" }];
  const columns = [190, 120, CONTENT_WIDTH - 310];
  const needed = 62 + safeRows.length * 42;
  y = ensureSpace(doc, y, needed, terms);

  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(11).text("Agreed fee schedule", MARGIN, y);
  y += 20;
  tableRow(doc, y, columns, ["Role / position", "Agreed fee", "Payment trigger"], 30, COLORS.teal, COLORS.white, true);
  y += 30;

  safeRows.forEach((rate, index) => {
    y = ensureSpace(doc, y, 48, terms);
    tableRow(
      doc,
      y,
      columns,
      [rate.roleTitle, rateDisplay(rate), rate.paymentTrigger || "Payable on candidate start date"],
      42,
      index % 2 ? COLORS.pale : COLORS.white
    );
    y += 42;
  });
  return y + 12;
}

function drawRebateTable(doc, y, terms) {
  y = ensureSpace(doc, y, 188, terms);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 176, 12).fill("#fffaf0").stroke("#ead9a9");
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(11).text("Rebate schedule", MARGIN + 14, y + 14);
  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(8.3)
    .text(`Maximum rebate support period: ${Number(terms.rebatePeriodDays ?? 28)} days, subject to clause 4.`, MARGIN + 14, y + 31, {
      width: CONTENT_WIDTH - 28
    });

  const tableY = y + 54;
  const columns = [CONTENT_WIDTH * 0.62, CONTENT_WIDTH * 0.38];
  tableRow(doc, tableY, columns, ["Week in which applicant leaves", "Introduction fee refunded"], 30, COLORS.teal, COLORS.white, true);
  [
    ["1 to 4 weeks", "75%"],
    ["5 to 8 weeks", "50%"],
    ["9 to 12 weeks", "25%"]
  ].forEach((row, index) => {
    tableRow(doc, tableY + 30 + index * 28, columns, row, 28, index % 2 ? COLORS.pale : COLORS.white, COLORS.black);
  });
  return y + 190;
}

function isMajorHeading(value) {
  return /^\d+\.\s+[A-Z][A-Z\s&]+$/.test(value.trim());
}

function drawMajorHeading(doc, value, y, terms) {
  y = ensureSpace(doc, y, 42, terms);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 31, 7).fill(COLORS.mist);
  doc.rect(MARGIN, y, 5, 31).fill(COLORS.gold);
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(12).text(value, MARGIN + 15, y + 8, {
    width: CONTENT_WIDTH - 25,
    height: 16,
    lineBreak: false
  });
  return y + 43;
}

function drawBodyParagraph(doc, value, y, terms) {
  const text = value.replace(/\s+/g, " ").trim();
  if (!text) return y;
  const isDefinition = /^"[^"]+"$/.test(text);
  const isBullet = text.startsWith("-");
  const x = isBullet ? MARGIN + 18 : MARGIN;
  const width = isBullet ? CONTENT_WIDTH - 18 : CONTENT_WIDTH;
  const font = isDefinition ? "Helvetica-BoldOblique" : "Helvetica";
  const fontSize = isDefinition ? 9.6 : 9;
  const lineGap = isDefinition ? 1 : 2.2;
  doc.font(font).fontSize(fontSize);
  const height = doc.heightOfString(text, { width, lineGap });
  y = ensureSpace(doc, y, height + 12, terms);
  if (isBullet) doc.circle(MARGIN + 5, y + 5, 2).fill(COLORS.teal);
  doc
    .fillColor(isDefinition ? COLORS.teal : COLORS.black)
    .font(font)
    .fontSize(fontSize)
    .text(text, x, y, { width, height: height + 3, lineGap, align: "left" });
  return y + height + (isDefinition ? 7 : 9);
}

function drawStructuredTerms(doc, value, y, terms) {
  const blocks = String(value)
    .split(/\n\s*\n/g)
    .map((block) => block.trim())
    .filter(Boolean);

  for (const block of blocks) {
    if (block === "[[FEE_TABLE]]") {
      y = drawFeeTable(doc, y, terms);
      continue;
    }
    if (block === "[[REBATE_TABLE]]") {
      y = drawRebateTable(doc, y, terms);
      continue;
    }

    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    if (lines.length && isMajorHeading(lines[0])) {
      y = ensureSpace(doc, y, 108, terms);
      y = drawMajorHeading(doc, lines.shift(), y, terms);
    }
    if (lines.length) {
      const paragraphs = lines
        .join(" ")
        .split(/(?:^|\s)(?=\d+\.\d+\.\s+[A-Z])/g)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);
      for (const paragraph of paragraphs) y = drawBodyParagraph(doc, paragraph, y, terms);
    }
  }
  return y;
}

function decorateAddedPage(doc, terms) {
  const cursor = { x: doc.x, y: doc.y };
  const pageNumber = doc.bufferedPageRange().count;
  drawPageHeader(doc, terms);
  drawFooter(doc, pageNumber, terms.documentNumber);
  doc.x = cursor.x;
  doc.y = cursor.y;
}

function decorateAllPages(doc, terms) {
  const range = doc.bufferedPageRange();
  for (let index = 0; index < range.count; index += 1) {
    doc.switchToPage(range.start + index);
    if (index > 0) drawPageHeader(doc, terms);
    drawFooter(doc, index + 1, terms.documentNumber);
  }
}

function signatureLine(doc, x, y, label, width) {
  doc.strokeColor(COLORS.line).lineWidth(1).moveTo(x, y).lineTo(x + width, y).stroke();
  doc.fillColor(COLORS.muted).font("Helvetica-Bold").fontSize(7).text(label.toUpperCase(), x, y + 6, { width });
}

function drawSignatureSection(doc, y, terms) {
  y = ensureSpace(doc, y, 308, terms);
  doc.roundedRect(MARGIN, y, CONTENT_WIDTH, 286, 14).fill(COLORS.white).stroke(COLORS.line);
  doc.rect(MARGIN, y, CONTENT_WIDTH, 7).fill(COLORS.gold);
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(14).text("Terms of business agreement", MARGIN + 18, y + 23);
  doc
    .fillColor(COLORS.black)
    .font("Helvetica")
    .fontSize(9)
    .text(
      "By signing below, the Client confirms acceptance of these Terms of Business and the commercial schedule contained in this document.",
      MARGIN + 18,
      y + 47,
      { width: CONTENT_WIDTH - 36, lineGap: 2 }
    );

  const gap = 16;
  const cardWidth = (CONTENT_WIDTH - 36 - gap) / 2;
  const cardY = y + 88;
  const left = MARGIN + 18;
  const right = left + cardWidth + gap;
  doc.roundedRect(left, cardY, cardWidth, 156, 12).fill(COLORS.pale).stroke(COLORS.line);
  doc.roundedRect(right, cardY, cardWidth, 156, 12).fill(COLORS.mist).stroke(COLORS.line);

  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(10.5).text("Client acceptance", left + 14, cardY + 14);
  doc.fillColor(COLORS.muted).font("Helvetica").fontSize(8).text(terms.clientName || "Client", left + 14, cardY + 34, {
    width: cardWidth - 28
  });
  signatureLine(doc, left + 14, cardY + 76, "Authorised signature", cardWidth - 28);
  signatureLine(doc, left + 14, cardY + 112, "Name / position", cardWidth - 28);
  signatureLine(doc, left + 14, cardY + 142, "Date", cardWidth - 28);

  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(10.5).text("Innovex confirmation", right + 14, cardY + 14);
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(8.8).text("Haider Zaman Syed", right + 14, cardY + 44);
  doc.fillColor(COLORS.muted).font("Helvetica").fontSize(8).text("Procurement Specialist", right + 14, cardY + 59);
  doc
    .fontSize(7.8)
    .text("Innovex Resource Group Limited\n33 Forsythia Drive, Cardiff\nWales, CF23 7HP, United Kingdom\n+44 330 043 5830", right + 14, cardY + 82, {
      width: cardWidth - 28,
      lineGap: 2
    });
  return y + 304;
}

export async function generateClientTermsPdf(terms) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: "A4", bufferPages: true, info: { Title: `Terms of Business - ${terms.clientName}` } });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      drawCover(doc, terms);
      drawFooter(doc, 1, terms.documentNumber);
      const onPageAdded = () => decorateAddedPage(doc, terms);
      doc.on("pageAdded", onPageAdded);
      let y = addContentPage(doc, terms);
      doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(18).text("Standard Terms of Business", MARGIN, y);
      doc.fillColor(COLORS.muted).font("Helvetica").fontSize(8.5).text("Direct employment and engagement services", MARGIN, y + 25);
      y += 52;
      y = drawStructuredTerms(doc, loadStructuredTerms(terms), y, terms);

      if (terms.specialTerms) {
        y = drawMajorHeading(doc, "CLIENT-SPECIFIC SPECIAL TERMS", y, terms);
        y = drawBodyParagraph(doc, terms.specialTerms, y, terms);
      }
      drawSignatureSection(doc, y, terms);
      doc.removeListener("pageAdded", onPageAdded);
      decorateAllPages(doc, terms);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
