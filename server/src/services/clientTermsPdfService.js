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
    ["Â", ""],
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
    ["Â", ""],
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

function professionalizeTermsText(text) {
  return String(text || "")
    .replace(
      /a company incorporated in England and Wales under company number 15975820 and whose\s+registered office is at 33 Forsythia Drive, Cardiff, Wales, CF23 7HP, United Kingdom\s+\("the Employment Agency"\);/i,
      'Innovex Resource Group Limited is a company incorporated in England and Wales under company number 15975820, with its registered office at 33 Forsythia Drive, Cardiff, Wales, CF23 7HP, United Kingdom (the "Employment Agency" or "Agency").'
    )
    .replace(
      /means the person; firm, organization or corporate body together with any subsidiary or associated Company as defined by the Companies Act 1985 to which the Applicant is introduced;/gi,
      "means the person, firm, organisation or corporate body, together with any subsidiary or associated company as defined by the Companies Act 1985, to which the Applicant is introduced;"
    )
    .replace(
      /Means the engagement, employment or use of the Applicant by the Client or any third party on a permanent or temporary basis, whether under a contract of service or for services; under an agency, license, franchise or partnership agreement; or any other engagement; directly or through a limited company of which the Applicant is an officer or employee/gi,
      "means the engagement, employment or use of the Applicant by the Client, or by any third party, on a permanent or temporary basis, whether under a contract of service, a contract for services, an agency, licence, franchise, partnership agreement, or any other form of engagement, whether directly or through a limited company of which the Applicant is an officer or employee;"
    )
    .replace(/\bMeans:\b/g, "means:")
    .replace(
      /These Terms establish the contract between the Agency and the Client and are considered to be accepted by the Client by virtue of an Introduction to, or the Engagement of an Applicant or the passing of any information about the Applicant to any third party following an Introduction\./gi,
      "These Terms establish the contract between the Agency and the Client. They are deemed accepted by the Client upon an Introduction, the Engagement of an Applicant, or the passing of any information about the Applicant to any third party following an Introduction."
    )
    .replace(
      /This Agreement does not need to be signed for it to become binding upon the parties to it\. Furthermore, these Terms of Business can be electronically sent to the Client to deliver the Terms of Business to the Client\./gi,
      "This Agreement does not need to be signed in order to become binding. These Terms of Business may be delivered electronically to the Client."
    )
    .replace(
      /The Agency may require the Client to make a deposit or prepay all of the Agency fees before the Agency supplies staff to the Client\. Once the Client has paid the Agency or has made a prepayment to the Agency the Agency shall provide staff by the Terms of Business of the Agency\./gi,
      "The Agency may require the Client to pay a deposit or prepay Agency fees before candidate support is provided. Once the agreed deposit or prepayment has been received, the Agency will provide staff or candidate introductions in accordance with these Terms of Business."
    )
    .replace(
      /The responsibility for paying the Agency's fees lies solely with the Client as defined under this contract\. If the Client wishes to involve an external organisation in the payment of the Agency's fees, then the said the external organisation would only be liable under a separate contract\. If a third-party organisation is not bound by a separate contract, the responsibility of payment would lie with the Client\./gi,
      "The responsibility for paying the Agency's fees lies solely with the Client as defined under this contract. If the Client wishes to involve an external organisation in payment of the Agency's fees, that organisation will only be liable where it has entered into a separate written contract with the Agency. Otherwise, payment responsibility remains with the Client."
    )
    .replace(
      /If the ownership of the Client changes for whatsoever reason the Owners,\s+Partners, or Directors of the Client who agreed to these Terms of Business at the\s+time of the Introduction by the Agency will be personally liable for any matters\s+under this contract\. outstanding/gi,
      "If ownership of the Client changes for any reason, the owners, partners or directors of the Client who agreed to these Terms of Business at the time of the Introduction by the Agency will remain personally liable for any outstanding matters under this contract."
    )
    .replace(
      /If the Client subsequently engages or re-engages the Applicant within the period of 6 calendar months from the date of termination of the Engagement or withdrawal of the offer, a full fee calculated in accordance with clause 3\.4 above becomes payable\./gi,
      "If the Client subsequently engages or re-engages the Applicant within 6 calendar months from the date of termination of the Engagement or withdrawal of the offer, a full fee calculated in accordance with clause 3.4 becomes payable."
    )
    .replace(/Cash refunds will be offered once agreed in writing by the Agency\./gi, "Cash refunds will only be offered where agreed in writing by the Agency.")
    .replace(/If the candidate dies before completing the rebate period, the Agency will not issue any refund\./gi, "If the candidate dies before completing the rebate period, the Agency will not issue a refund.")
    .replace(/The Agency endeavors to ensure/gi, "The Agency endeavours to ensure")
    .replace(
      /the Client undertakes to provide to the Agency details of the position which the Client seeks to fill/gi,
      "the Client undertakes to provide the Agency with details of the position which the Client seeks to fill"
    )
    .replace(
      /By signing this document, I the "Client" agree for Agency Innovex Resource Group Limited \(Company Registration no: 15975820\) to supply us with candidates in accordance with terms above\./gi,
      "By signing this document, the Client confirms acceptance of these Terms of Business and authorises Innovex Resource Group Limited (Company Registration no: 15975820) to introduce candidates in accordance with the terms set out above."
    )
    .replace(/\s+([,.;:])/g, "$1")
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
  const template = cleanTemplateText(fs.readFileSync(file, "utf8"));
  return professionalizeTermsText(normalizeLegalTextForPdf(withClientSpecificTerms(polishLegalTemplateText(template), terms)));
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

function splitTemplateAroundSignature(templateText) {
  const signatureMatch = templateText.match(/\n\s*Terms of business agreement[\s\S]*$/i);
  if (!signatureMatch || signatureMatch.index === undefined) {
    return { termsBody: templateText, hasSignature: false };
  }

  return {
    termsBody: templateText.slice(0, signatureMatch.index).trimEnd(),
    hasSignature: true
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
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(10).text("Role / salary range", LEFT + 12, y + 11, { width: colA - 24 });
  doc.text("Agreed fee", LEFT + colA + 12, y + 11, { width: colB - 24 });
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

function drawSignatureLine(doc, x, y, label, width) {
  doc.strokeColor(COLORS.line).lineWidth(1).moveTo(x, y).lineTo(x + width, y).stroke();
  doc.fillColor(COLORS.muted).font("Helvetica-Bold").fontSize(7.5).text(label.toUpperCase(), x, y + 6, { width });
}

function drawProfessionalSignatureSection(doc, y, terms) {
  y = ensureSpace(doc, y, 310);

  doc.roundedRect(LEFT, y, CONTENT_WIDTH, 286, 14).fill("#ffffff").stroke(COLORS.line);
  doc.rect(LEFT, y, CONTENT_WIDTH, 8).fill(COLORS.gold);

  doc
    .fillColor(COLORS.ink)
    .font("Helvetica-Bold")
    .fontSize(14)
    .text("Terms of business agreement", LEFT + 18, y + 24, { width: CONTENT_WIDTH - 36 });

  doc
    .fillColor("#263f46")
    .font("Helvetica")
    .fontSize(9.5)
    .text(
      "Please complete the Client signature section only. The Agency confirmation section is completed by Innovex Resource Group Limited and confirms the issuing office for this document.",
      LEFT + 18,
      y + 48,
      { width: CONTENT_WIDTH - 36, lineGap: 2 }
    );

  const cardGap = 18;
  const cardWidth = (CONTENT_WIDTH - 36 - cardGap) / 2;
  const cardY = y + 92;
  const cardHeight = 150;
  const leftCardX = LEFT + 18;
  const rightCardX = leftCardX + cardWidth + cardGap;

  doc.roundedRect(leftCardX, cardY, cardWidth, cardHeight, 12).fill(COLORS.pale).stroke(COLORS.line);
  doc.roundedRect(rightCardX, cardY, cardWidth, cardHeight, 12).fill(COLORS.mist).stroke(COLORS.line);

  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(11).text("Client signature", leftCardX + 14, cardY + 15);
  doc.fillColor(COLORS.muted).font("Helvetica").fontSize(8.5).text(terms.clientName || "Care Home / Group / Agency", leftCardX + 14, cardY + 34, {
    width: cardWidth - 28
  });
  drawSignatureLine(doc, leftCardX + 14, cardY + 70, "Authorised signature / acceptance", cardWidth - 28);
  drawSignatureLine(doc, leftCardX + 14, cardY + 108, "Name / position", cardWidth - 28);
  drawSignatureLine(doc, leftCardX + 14, cardY + 136, "Date", cardWidth - 28);

  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(11).text("Innovex confirmation", rightCardX + 14, cardY + 15);
  doc
    .fillColor(COLORS.muted)
    .font("Helvetica")
    .fontSize(8.5)
    .text("Innovex Resource Group Limited", rightCardX + 14, cardY + 34, { width: cardWidth - 28 });
  doc.fillColor(COLORS.ink).font("Helvetica-Bold").fontSize(9).text("Haider Zaman Syed", rightCardX + 14, cardY + 58, {
    width: cardWidth - 28
  });
  doc.fillColor(COLORS.muted).font("Helvetica").fontSize(8.3).text("Procurement Specialist", rightCardX + 14, cardY + 73, {
    width: cardWidth - 28
  });
  doc
    .fontSize(8)
    .text("33 Forsythia Drive, Cardiff, Wales, CF23 7HP, United Kingdom", rightCardX + 14, cardY + 96, {
      width: cardWidth - 28,
      lineGap: 1.5
    });
  doc.fontSize(8).text("+44 330 043 5830", rightCardX + 14, cardY + 126, { width: cardWidth - 28 });

  const contactY = y + 258;
  doc.roundedRect(LEFT + 18, contactY, CONTENT_WIDTH - 36, 18, 8).fill(COLORS.ink);
  doc
    .fillColor("#ffffff")
    .font("Helvetica-Bold")
    .fontSize(7.7)
    .text("33 Forsythia Drive, Cardiff, CF23 7HP  |  +44 330 043 5830  |  +44 292 2520491  |  info@innovexresourcegroup.co.uk", LEFT + 28, contactY + 5, {
      width: CONTENT_WIDTH - 56,
      align: "center"
    });

  return y + 306;
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
      const { termsBody, hasSignature } = splitTemplateAroundSignature(templateText);
      const { before, after } = splitTemplateAroundFeeTable(termsBody);

      drawCover(doc, terms);
      let y = addPage(doc);
      y = drawTermsText(doc, before, y);
      y = drawFeeStructureTable(doc, y, terms);
      y = drawTermsText(doc, after, y);
      if (hasSignature) {
        y = drawProfessionalSignatureSection(doc, y, terms);
      }
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
