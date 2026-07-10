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
  softGold: "#fff5d8",
  pale: "#f8fcfc"
};

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 42;
const RIGHT = 42;
const CONTENT_WIDTH = PAGE_WIDTH - LEFT - RIGHT;
const BOTTOM = 70;

function termsTemplatePath() {
  const candidates = [
    path.resolve(process.cwd(), "server/assets/irg-terms-template.txt"),
    path.resolve(process.cwd(), "assets/irg-terms-template.txt")
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || candidates[0];
}

function logoPath() {
  return path.resolve(process.cwd(), "../client/public/Logo.png");
}

function money(value, decimals = 0) {
  return `${String.fromCharCode(163)}${Number(value || 0).toLocaleString("en-GB", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" });
}

function normalizeLegalTextForPdf(text) {
  const pound = String.fromCharCode(163);
  let cleaned = String(text || "");

  const replacements = new Map([
    ["â€œ", '"'],
    ["â€", '"'],
    ["â€™", "'"],
    ["â€˜", "'"],
    ["â€¢", "-"],
    ["â€“", "-"],
    ["â€”", "-"],
    ["Â£", pound],
    ["Â", ""]
  ]);

  replacements.forEach((to, from) => {
    cleaned = cleaned.split(from).join(to);
  });

  return cleaned
    .replace(/\r\n/g, "\n")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2022/g, "-")
    .replace(/\u00a0/g, " ")
    .replace(/\t+/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, "")
    .replace(/\uFFFD/g, "")
    .replace(/£(\d[\d,]*(?:\.\d+)?)/g, "$1 pounds")
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/\batthe\b/gi, "at the")
    .replace(/Engagement\]/g, "Engagement")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanTemplateText(text) {
  return text
    .replaceAll("â€œ", '"')
    .replaceAll("â€", '"')
    .replaceAll("â€™", "'")
    .replaceAll("â€˜", "'")
    .replaceAll("â€¢", "-")
    .replaceAll("Â£", String.fromCharCode(163))
    .replaceAll("â€œ", '"')
    .replaceAll("â€", '"')
    .replaceAll("â€™", "'")
    .replaceAll("â€˜", "'")
    .replaceAll("â€¢", "-")
    .replaceAll("Â£", String.fromCharCode(163))
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

function polishLegalTemplateText(text) {
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

  let cleaned = String(text || "");
  replacements.forEach(([from, to]) => {
    cleaned = cleaned.replaceAll(from, to);
  });

  return cleaned
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\batthe\b/gi, "at the")
    .replace(/Engagement\]/g, "Engagement")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function withClientSpecificTerms(text, terms) {
  const paymentDays = Number(terms.paymentDueDays || 7);
  const rebateDays = Number(terms.rebatePeriodDays || 15);
  return text
    .replace(/within\s+7\s+days\s+of\s+the\s+date\s+of\s+invoice/gi, `within ${paymentDays} days of the date of invoice`)
    .replace(/within\s+7\s+days\s+of\s+invoice/gi, `within ${paymentDays} days of invoice`)
    .replace(/within\s+15\s+days\s+of\s+its\s+termination/gi, `within ${rebateDays} days of its termination`);
}

function loadTermsTemplate(terms) {
  const file = termsTemplatePath();
  if (!fs.existsSync(file)) {
    throw new Error("IRG terms template text file is missing.");
  }
  return normalizeLegalTextForPdf(withClientSpecificTerms(polishLegalTemplateText(cleanTemplateText(fs.readFileSync(file, "utf8"))), terms));
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

function addFooter(doc, pageNumber) {
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
  return 54;
}

function ensureSpace(doc, y, height) {
  return y + height > PAGE_HEIGHT - BOTTOM ? addPage(doc) : y;
}

function labelValue(doc, x, y, label, value, width) {
  doc.fillColor(COLORS.muted).font("Helvetica-Bold").fontSize(8).text(label.toUpperCase(), x, y, { width });
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(10).text(value || "-", x, y + 13, { width });
}

function drawCover(doc, terms) {
  doc.rect(0, 0, PAGE_WIDTH, 176).fill(COLORS.teal);
  doc.rect(0, 170, PAGE_WIDTH, 6).fill(COLORS.gold);
  drawLogo(doc, LEFT, 34, 50);
  doc
    .fillColor("#d8f0f2")
    .font("Helvetica-Bold")
    .fontSize(8)
    .text("INNOVEX RESOURCE GROUP LIMITED", LEFT + 66, 42, { characterSpacing: 1.6 });
  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(24)
    .text("Terms of Business", LEFT + 66, 58, { width: 300 })
    .fontSize(10)
    .fillColor("#d8f0f2")
    .text("Introduction of candidates to clients for direct employment or engagement.", LEFT + 66, 92, {
      width: 340,
      lineGap: 2
    });

  doc.roundedRect(392, 35, 160, 88, 12).fill("#ffffff").stroke(COLORS.line);
  labelValue(doc, 410, 50, "Document", terms.documentNumber, 126);
  labelValue(doc, 410, 80, "Status", terms.status, 126);

  let y = 210;
  doc.roundedRect(LEFT, y, CONTENT_WIDTH, 116, 14).fill("#ffffff").stroke(COLORS.line);
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(15).text("Client details", LEFT + 16, y + 17);
  labelValue(doc, LEFT + 16, y + 48, "Client / company", terms.clientName, 220);
  labelValue(doc, LEFT + 280, y + 48, "Contact", terms.contactName || "-", 200);
  labelValue(doc, LEFT + 16, y + 78, "Email", terms.clientEmail, 220);
  labelValue(doc, LEFT + 280, y + 78, "Effective date", formatDate(terms.effectiveDate), 200);

  y += 144;
  doc.roundedRect(LEFT, y, CONTENT_WIDTH, 78, 14).fill(COLORS.mist).stroke(COLORS.line);
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(12).text("Important notice", LEFT + 16, y + 16);
  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(9.5)
    .text(
      "This document uses Innovex Resource Group Limited's standard Terms of Business. Only the client details and agreed fee structure in clause 3.4 are prepared from the CRM record.",
      LEFT + 16,
      y + 38,
      { width: CONTENT_WIDTH - 32, lineGap: 2 }
    );

  addFooter(doc, 1);
}

function splitTemplateAroundFeeTable(templateText) {
  const match = templateText.match(/Salary Range\s+Percentage[\s\S]*?(?=\n\s*3\.5\.)/i);
  if (!match || match.index === undefined) {
    return { before: templateText, after: "", hasTable: false };
  }
  return {
    before: templateText.slice(0, match.index).trimEnd(),
    after: templateText.slice(match.index + match[0].length).trimStart(),
    hasTable: true
  };
}

function getRateDisplay(rate) {
  const value = Number(rate.rateValue || 0);
  if (rate.feeType === "Flat Fee") return `${value.toLocaleString("en-GB")} pounds per placement`;
  if (rate.feeType === "Percentage") return `${value}%`;
  if (rate.feeType === "Hourly Margin") return `${money(value, 2)} ${rate.rateUnit || "margin"}`;
  return `${value}${rate.rateUnit ? ` ${rate.rateUnit}` : ""}`;
}

function getRoleRateRows(terms) {
  const rows = (terms.roleRates || [])
    .filter((rate) => rate.roleTitle && Number(rate.rateValue || 0) > 0)
    .map((rate) => ({
      role: rate.roleTitle,
      fee: getRateDisplay(rate)
    }));

  if (rows.length) return rows;
  return [{ role: "All roles", fee: "Fee to be agreed in writing before introduction or engagement." }];
}

function drawFeeStructureTable(doc, y, terms) {
  const rows = getRoleRateRows(terms);
  const colA = 250;
  const colB = CONTENT_WIDTH - colA;
  const rowHeights = rows.map((row) =>
    Math.max(
      32,
      doc.heightOfString(row.role, { width: colA - 24 }) + 18,
      doc.heightOfString(row.fee, { width: colB - 24 }) + 18
    )
  );
  const totalHeight = 34 + rowHeights.reduce((sum, height) => sum + height, 0);

  y = ensureSpace(doc, y, totalHeight + 18);
  doc.roundedRect(LEFT, y, CONTENT_WIDTH, totalHeight, 6).fill("#ffffff").stroke("#101010");
  doc.rect(LEFT, y, colA, 34).fill(COLORS.pale).stroke("#101010");
  doc.rect(LEFT + colA, y, colB, 34).fill(COLORS.pale).stroke("#101010");
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(10).text("Salary Range", LEFT + 12, y + 11, { width: colA - 24 });
  doc.text("Percentage", LEFT + colA + 12, y + 11, { width: colB - 24 });
  y += 34;

  rows.forEach((row, index) => {
    const height = rowHeights[index];
    y = ensureSpace(doc, y, height + 6);
    doc.rect(LEFT, y, colA, height).fill(index % 2 === 0 ? "#ffffff" : "#fbfbfb").stroke("#101010");
    doc.rect(LEFT + colA, y, colB, height).fill(index % 2 === 0 ? "#ffffff" : "#fbfbfb").stroke("#101010");
    doc.fillColor("#111111").font("Helvetica").fontSize(10).text(row.role, LEFT + 12, y + 10, { width: colA - 24 });
    doc.text(row.fee, LEFT + colA + 12, y + 10, { width: colB - 24 });
    y += height;
  });

  return y + 16;
}

function isMajorHeading(paragraph) {
  return /^\d+\.\s+[A-Z][A-Z\s&]+$/.test(paragraph) || paragraph === "TERMS OF BUSINESS";
}

function isDocumentIntro(paragraph) {
  return (
    paragraph === "INNOVEX RESOURCE GROUP LIMITED" ||
    paragraph === "TERMS OF BUSINESS" ||
    paragraph === "INTRODUCTION OF CANDIDATES TO CLIENTS FOR DIRECT EMPLOYMENT/ENGAGEMENT"
  );
}

function drawParagraph(doc, paragraph, y) {
  const normalized = paragraph
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (!normalized) return y;
  if (isDocumentIntro(normalized)) return y;

  const bullet = normalized.startsWith("-");
  const heading = isMajorHeading(normalized);
  const width = bullet ? CONTENT_WIDTH - 18 : CONTENT_WIDTH;
  const x = bullet ? LEFT + 18 : LEFT;
  const fontSize = heading ? 13 : 9.6;
  const font = heading ? "Helvetica-Bold" : "Helvetica";
  const lineGap = heading ? 1 : 2.5;
  const textHeight = doc.heightOfString(normalized, { width, lineGap });

  y = ensureSpace(doc, y, textHeight + (heading ? 18 : 12));
  if (heading) {
    doc.fillColor(COLORS.ink).font(font).fontSize(fontSize).text(normalized, x, y, { width, lineGap });
    return y + textHeight + 11;
  }

  if (bullet) {
    doc.circle(LEFT + 5, y + 5, 2).fill(COLORS.teal);
  }
  doc.fillColor("#111111").font(font).fontSize(fontSize).text(normalized, x, y, { width, lineGap, align: "left" });
  return y + textHeight + 8;
}

function drawTermsText(doc, text, y) {
  const paragraphs = text
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  paragraphs.forEach((paragraph) => {
    y = drawParagraph(doc, paragraph, y);
  });
  return y;
}

function drawSignatureSection(doc, y, terms) {
  y = ensureSpace(doc, y, 152);
  doc.roundedRect(LEFT, y, CONTENT_WIDTH, 128, 12).fill(COLORS.mist).stroke(COLORS.line);
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(12).text("Client acceptance", LEFT + 16, y + 16);
  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(9)
    .text(
      "By signing below, the Client confirms acceptance of these Terms of Business and the client-specific fee structure shown in clause 3.4.",
      LEFT + 16,
      y + 36,
      { width: CONTENT_WIDTH - 32 }
    );
  doc.moveTo(LEFT + 16, y + 84).lineTo(LEFT + 236, y + 84).strokeColor(COLORS.line).stroke();
  doc.moveTo(LEFT + 276, y + 84).lineTo(LEFT + 496, y + 84).strokeColor(COLORS.line).stroke();
  labelValue(doc, LEFT + 16, y + 93, "Client", terms.clientName, 220);
  labelValue(doc, LEFT + 276, y + 93, "Signature / date", "", 220);
  return y + 148;
}

export async function generateClientTermsPdf(terms) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 0, size: "A4", bufferPages: true });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      const templateText = loadTermsTemplate(terms);
      const { before, after } = splitTemplateAroundFeeTable(templateText);

      drawCover(doc, terms);
      let y = addPage(doc);
      y = drawTermsText(doc, before, y);
      y = drawFeeStructureTable(doc, y, terms);
      y = drawTermsText(doc, after, y);
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
