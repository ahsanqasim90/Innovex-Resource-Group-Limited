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

function pdfText(value, fallback = "-") {
  return safe(value, fallback)
    .replace(/[\u2022\u25CF\u25AA]/g, "-")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\u00A0/g, " ");
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

function drawAsset(doc, filename, x, y, options = {}) {
  const assetPath = path.join(process.cwd(), "server", "assets", filename);
  if (!fs.existsSync(assetPath)) return false;
  try {
    doc.image(assetPath, x, y, options);
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
    doc.roundedRect(LEFT, 134, CONTENT_WIDTH, 72, 12).fill("#ffffff").strokeColor(line).stroke();
    drawLogo(doc, LEFT + 16, 149, 68, 40);
    doc.fillColor(teal).font("Helvetica-Bold").fontSize(7.6).text("EMPLOYEE PAY STATEMENT", LEFT + 102, 149, { lineBreak: false });
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(16).text(slip.employeeName, LEFT + 102, 165, { width: 260, lineBreak: false, ellipsis: true });
    doc.fillColor(muted).font("Helvetica").fontSize(7.8).text([slip.jobTitle, slip.department, slip.employeeEmail].filter(Boolean).join(" | "), LEFT + 102, 187, { width: 275, lineBreak: false, ellipsis: true });
    doc.roundedRect(438, 151, 86, 36, 9).fill("#fff7df").strokeColor("#f2d58a").stroke();
    doc.fillColor(muted).font("Helvetica-Bold").fontSize(6.6).text("NET PAY", 451, 160, { width: 60, align: "center", lineBreak: false });
    doc.fillColor(teal).font("Helvetica-Bold").fontSize(11.5).text(money(slip.netPay), 446, 173, { width: 70, align: "center", lineBreak: false });

    metaBox(doc, [
      ["Pay period", `${dateLabel(slip.payPeriodStart)} - ${dateLabel(slip.payPeriodEnd)}`],
      ["Payment date", dateLabel(slip.paymentDate)],
      ["Payment method", slip.paymentMethod || "Bank transfer"],
      ["Net pay", money(slip.netPay)]
    ], 224);

    const columns = [
      { label: "EARNINGS", x: 56, width: 230 },
      { label: "AMOUNT", x: 285, width: 90, align: "right" },
      { label: "DEDUCTIONS", x: 398, width: 85 },
      { label: "AMOUNT", x: 482, width: 58, align: "right" }
    ];
    let y = tableHeader(doc, 306, columns);
    const earnings = [
      ["Basic salary", slip.basicSalary],
      ["Overtime", slip.overtime],
      ["Bonus", slip.bonus],
      ["Commission", slip.commission],
      ["Internet and Communication Allowance", slip.internetCommunicationAllowance],
      ["Remote Working Allowance", slip.remoteWorkingAllowance],
      ["Other allowance", slip.otherAllowance]
    ].filter(([, value], index) => index === 0 || Number(value || 0) > 0);
    const deductions = [
      ["Tax", slip.tax],
      ["Other deduction", slip.otherDeduction]
    ].filter(([, value], index) => index === 0 || Number(value || 0) > 0);
    const rowCount = Math.max(earnings.length, deductions.length);
    for (let index = 0; index < rowCount; index += 1) {
      const earning = earnings[index] || ["", ""];
      const deduction = deductions[index] || ["", ""];
      if (index % 2 === 0) doc.rect(LEFT, y, CONTENT_WIDTH, 24).fill(soft);
      doc.fillColor(ink).font("Helvetica").fontSize(8).text(earning[0], 56, y + 8, { width: 210, lineBreak: false, ellipsis: true });
      doc.fillColor(teal).font("Helvetica-Bold").text(earning[0] ? money(earning[1]) : "", 285, y + 8, { width: 90, align: "right", lineBreak: false });
      doc.fillColor(ink).font("Helvetica").text(deduction[0], 398, y + 8, { width: 85, lineBreak: false });
      doc.fillColor(teal).font("Helvetica-Bold").text(deduction[0] ? money(deduction[1]) : "", 482, y + 8, { width: 58, align: "right", lineBreak: false });
      doc.moveTo(LEFT, y + 24).lineTo(LEFT + CONTENT_WIDTH, y + 24).strokeColor(line).stroke();
      y += 24;
    }

    metaBox(doc, [
      ["Gross pay", money(slip.grossPay)],
      ["Total deductions", money(slip.totalDeductions)],
      ["Net pay", money(slip.netPay)]
    ], y + 16);

    const exchangeText = slip.exchangeRateValue
      ? `${slip.exchangeRateLabel || "Currency rate at issue"}: ${slip.exchangeRateValue}`
      : "Currency rate at issue: not provided";
    const paymentNotice = slip.paymentNotice || "Full payment may take additional time to be received because payment is processed through a broker. Payments may also be received partially before the remaining balance is completed.";
    doc.roundedRect(LEFT, y + 92, CONTENT_WIDTH, 76, 10).fill("#fffaf0").strokeColor("#f4d48c").stroke();
    doc.fillColor(teal).font("Helvetica-Bold").fontSize(7.8).text("PAYMENT AND CURRENCY NOTE", 58, y + 106, { lineBreak: false });
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(8).text(exchangeText, 58, y + 123, { width: 470, lineBreak: false, ellipsis: true });
    doc.fillColor(ink).font("Helvetica").fontSize(7.8).text(paymentNotice, 58, y + 140, { width: 470, lineGap: 1 });

    const attestationY = y + 184;
    doc.roundedRect(LEFT, attestationY, CONTENT_WIDTH, 88, 12).fill("#ffffff").strokeColor(line).stroke();
    doc.fillColor(teal).font("Helvetica-Bold").fontSize(7.8).text("ATTESTATION", 58, attestationY + 15, { lineBreak: false });
    doc.fillColor(ink).font("Helvetica").fontSize(8.2).text(
      slip.attestationText || "This salary slip has been issued by Innovex Resource Group Limited and is attested as a true record of the payment details shown above.",
      58,
      attestationY + 32,
      { width: 285, lineGap: 2 }
    );
    drawAsset(doc, "director-signature-fawad.png", 356, attestationY + 14, { fit: [86, 40], align: "center", valign: "center" });
    drawAsset(doc, "innovex-stamp.png", 458, attestationY + 10, { fit: [62, 62], align: "center", valign: "center" });
    doc.moveTo(356, attestationY + 60).lineTo(438, attestationY + 60).strokeColor(line).stroke();
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(8.2).text(safe(slip.directorName, "Fawad Khan"), 356, attestationY + 67, { width: 96, lineBreak: false });
    doc.fillColor(muted).font("Helvetica").fontSize(7.2).text(safe(slip.directorTitle, "Director"), 356, attestationY + 78, { width: 96, lineBreak: false });
    doc.fillColor(muted).font("Helvetica").fontSize(6.5).text("Authorised signatory", 456, attestationY + 72, { width: 70, align: "center" });

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

    const signatoryName = pdfText(offer.signatoryName, "Muhammad Ahsan Qasim");
    const signatoryTitle = pdfText(offer.signatoryTitle, "Co-founder & Director");
    const commissionItems = Array.isArray(offer.commissionItems) ? offer.commissionItems.filter((item) => item?.roles) : [];
    const commissionType = (value) => safe(value, "Fixed value") === "Percentage" ? "Percentage" : "Fixed value";
    const commissionValue = (value, type) => commissionType(type) === "Percentage"
      ? `${Number(value || 0).toLocaleString("en-GB", { maximumFractionDigits: 2 })}%`
      : money(value);
    const isCommission = commissionItems.length > 0
      || safe(offer.salaryType, "").toLowerCase() === "commission"
      || safe(offer.employmentType, "").toLowerCase().includes("commission");
    const startDisplay = offer.startDateText || dateLabel(offer.startDate);
    const expiryDisplay = offer.offerExpiryText || dateLabel(offer.offerExpiryDate);
    const issuedOn = dateLabel(offer.createdAt || new Date());
    let y = 0;

    const addOfferPage = (label = "OFFER DETAILS") => {
      doc.addPage();
      drawHeader(doc, "Offer Letter", offer.offerNumber);
      doc.fillColor(teal).font("Helvetica-Bold").fontSize(8).text(label, LEFT, 139, { lineBreak: false });
      doc.fillColor(muted).font("Helvetica").fontSize(7.2).text(
        `${pdfText(offer.candidateName, "Candidate")} | ${pdfText(offer.roleTitle, "Role")}`,
        275,
        139,
        { width: 278, align: "right", lineBreak: false, ellipsis: true }
      );
      y = 160;
    };

    const ensureSpace = (height, label) => {
      if (y + height > 770) addOfferPage(label);
    };

    const takeTextChunk = (text, width, maxHeight) => {
      doc.font("Helvetica").fontSize(8.6);
      if (doc.heightOfString(text, { width, lineGap: 2 }) <= maxHeight) return text;
      let low = 1;
      let high = text.length;
      while (low < high) {
        const mid = Math.ceil((low + high) / 2);
        if (doc.heightOfString(text.slice(0, mid), { width, lineGap: 2 }) <= maxHeight) low = mid;
        else high = mid - 1;
      }
      const breakAt = Math.max(text.lastIndexOf("\n", low), text.lastIndexOf(" ", low));
      return text.slice(0, breakAt > 0 ? breakAt : low).trim();
    };

    const drawTextSection = (title, value, background = "#ffffff") => {
      let remaining = pdfText(value, "").trim();
      if (!remaining) return;
      let part = 1;
      while (remaining) {
        ensureSpace(90, title);
        const maxTextHeight = Math.min(330, 770 - y - 44);
        if (maxTextHeight < 46) {
          addOfferPage(title);
          continue;
        }
        const chunk = takeTextChunk(remaining, 471, maxTextHeight);
        doc.font("Helvetica").fontSize(8.6);
        const textHeight = doc.heightOfString(chunk, { width: 471, lineGap: 2 });
        const boxHeight = textHeight + 43;
        doc.roundedRect(LEFT, y, CONTENT_WIDTH, boxHeight, 10).fill(background).strokeColor(line).stroke();
        doc.fillColor(teal).font("Helvetica-Bold").fontSize(8.4).text(
          `${title}${part > 1 ? " (CONTINUED)" : ""}`,
          58,
          y + 14,
          { lineBreak: false }
        );
        doc.fillColor(ink).font("Helvetica").fontSize(8.6).text(chunk, 58, y + 31, { width: 471, lineGap: 2 });
        y += boxHeight + 12;
        remaining = remaining.slice(chunk.length).trim();
        part += 1;
      }
    };

    drawHeader(doc, "Offer Letter", offer.offerNumber);
    doc.roundedRect(LEFT, 134, CONTENT_WIDTH, 124, 12).fill("#ffffff").strokeColor(line).stroke();
    doc.fillColor(muted).font("Helvetica").fontSize(8).text(issuedOn, 58, 152, { lineBreak: false });
    doc.fillColor(muted).font("Helvetica").fontSize(7.2).text(
      [offer.candidateEmail, offer.candidatePhone].filter(Boolean).map((value) => pdfText(value)).join(" | "),
      188,
      152,
      { width: 220, align: "right", lineBreak: false, ellipsis: true }
    );
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(15.5).text(`Dear ${pdfText(offer.candidateName, "Candidate")},`, 58, 176, { width: 335, lineBreak: false, ellipsis: true });
    const offerTitle = `Offer of ${pdfText(offer.roleTitle, "Role")}`;
    const offerTitleSize = offerTitle.length > 34 ? 15.5 : 19;
    doc.fillColor(teal).font("Helvetica-Bold").fontSize(offerTitleSize).text(offerTitle, 58, 205, { width: 355, lineBreak: false, ellipsis: true });
    doc.fillColor(ink).font("Helvetica").fontSize(8.8).text(
      "We are pleased to confirm your offer with Innovex Resource Group Limited. The complete role details, payment terms and conditions are set out below.",
      58,
      233,
      { width: 350, lineGap: 2 }
    );
    doc.roundedRect(425, 154, 88, 58, 10).fill("#fff7df").strokeColor("#f2d58a").stroke();
    doc.fillColor(muted).font("Helvetica-Bold").fontSize(7).text("OFFER STATUS", 437, 168, { width: 64, align: "center", lineBreak: false });
    doc.fillColor(teal).font("Helvetica-Bold").fontSize(13).text(pdfText(offer.status, "Draft"), 437, 188, { width: 64, align: "center", lineBreak: false, ellipsis: true });

    metaBox(doc, [
      ["Role", pdfText(offer.roleTitle)],
      ["Employment type", pdfText(offer.employmentType)],
      ["Start date", pdfText(startDisplay)],
      ["Location", pdfText(offer.workLocation, "To be confirmed")]
    ], 276);

    y = tableHeader(doc, 358, [
      { label: "OFFER DETAIL", x: 56, width: 180 },
      { label: "INFORMATION", x: 250, width: 290 }
    ]);
    const salaryDisplay = isCommission
      ? (commissionItems.length ? "Project / role-based commission - see commission structure" : `${commissionType(offer.defaultCommissionType)} commission: ${commissionValue(offer.salaryAmount, offer.defaultCommissionType)}`)
      : `${pdfText(offer.salaryType)}: ${money(offer.salaryAmount)}`;
    const details = [
      ["Department", offer.department || "To be confirmed"],
      ["Salary / rate", salaryDisplay],
      ["Hours per week", offer.hoursPerWeek || "To be confirmed"],
      ["Reporting to", offer.reportingTo || "To be confirmed"],
      ["Probation period", offer.probationPeriod || "To be confirmed"],
      ["Offer expiry", expiryDisplay]
    ];
    details.forEach((row, index) => {
      const value = pdfText(row[1]);
      doc.font("Helvetica").fontSize(8.4);
      const rowHeight = Math.max(28, doc.heightOfString(value, { width: 290, lineGap: 1 }) + 16);
      if (index % 2 === 0) doc.rect(LEFT, y, CONTENT_WIDTH, rowHeight).fill(soft);
      doc.fillColor(muted).font("Helvetica-Bold").fontSize(7.8).text(row[0].toUpperCase(), 56, y + 9, { width: 170, lineBreak: false });
      doc.fillColor(ink).font("Helvetica").fontSize(8.4).text(value, 250, y + 9, { width: 290, lineGap: 1 });
      doc.moveTo(LEFT, y + rowHeight).lineTo(LEFT + CONTENT_WIDTH, y + rowHeight).strokeColor(line).stroke();
      y += rowHeight;
    });

    let commissionTermsDrawn = false;
    if (commissionItems.length) {
      ensureSpace(80, "COMMISSION STRUCTURE");
      doc.fillColor(teal).font("Helvetica-Bold").fontSize(9).text("COMMISSION STRUCTURE", LEFT, y + 18, { lineBreak: false });
      y += 38;
      y = tableHeader(doc, y, [
        { label: "PROJECT / POSITION / TRIGGER", x: 56, width: 245 },
        { label: "TYPE", x: 315, width: 95 },
        { label: "RATE / VALUE", x: 425, width: 108, align: "right" }
      ]);
      commissionItems.forEach((item, index) => {
        const roles = pdfText(item.roles);
        const type = commissionType(item.calculationType);
        doc.font("Helvetica").fontSize(8.3);
        const rowHeight = Math.max(34, doc.heightOfString(roles, { width: 245, lineGap: 1 }) + 16);
        ensureSpace(rowHeight, "COMMISSION STRUCTURE (CONTINUED)");
        if (index % 2 === 0) doc.rect(LEFT, y, CONTENT_WIDTH, rowHeight).fill(soft);
        doc.fillColor(ink).font("Helvetica").fontSize(8.3).text(roles, 56, y + 9, { width: 245, lineGap: 1 });
        doc.fillColor(muted).font("Helvetica-Bold").fontSize(7.8).text(type, 315, y + 10, { width: 95, lineBreak: false });
        doc.fillColor(teal).font("Helvetica-Bold").fontSize(9).text(commissionValue(item.amount, type), 425, y + 10, { width: 108, align: "right", lineBreak: false });
        doc.moveTo(LEFT, y + rowHeight).lineTo(LEFT + CONTENT_WIDTH, y + rowHeight).strokeColor(line).stroke();
        y += rowHeight;
      });
      y += 14;

      if (offer.commissionPaymentTerms) {
        const paymentTerms = pdfText(offer.commissionPaymentTerms);
        doc.font("Helvetica").fontSize(7.4);
        const paymentHeight = doc.heightOfString(paymentTerms, { width: 471, lineGap: 1 });
        const paymentBoxHeight = paymentHeight + 30;
        if (y + paymentBoxHeight <= 770) {
          doc.roundedRect(LEFT, y, CONTENT_WIDTH, paymentBoxHeight, 9).fill("#fffaf0").strokeColor("#f4d48c").stroke();
          doc.fillColor(teal).font("Helvetica-Bold").fontSize(7.4).text("COMMISSION PAYMENT TRIGGER", 58, y + 10, { lineBreak: false });
          doc.fillColor(ink).font("Helvetica").fontSize(7.4).text(paymentTerms, 58, y + 23, { width: 471, lineGap: 1 });
          y += paymentBoxHeight + 10;
          commissionTermsDrawn = true;
        }
      }
    }

    addOfferPage("TERMS AND BENEFITS");
    if (offer.commissionPaymentTerms && !commissionTermsDrawn) drawTextSection("WHEN COMMISSION BECOMES PAYABLE", offer.commissionPaymentTerms, "#fffaf0");
    drawTextSection(
      "CONDITIONS AND NEXT STEPS",
      offer.conditions || "This offer is subject to satisfactory right-to-work checks, references, compliance documentation, and any role-specific requirements confirmed by Innovex Resource Group Limited."
    );
    drawTextSection(
      "BENEFITS",
      offer.benefits || "Further onboarding information will be shared by the Innovex team once the offer is accepted.",
      soft
    );
    if (offer.customMessage) drawTextSection("MESSAGE FROM INNOVEX", offer.customMessage, "#fffaf0");

    ensureSpace(116, "AUTHORISATION");
    const signY = y;
    doc.roundedRect(LEFT, signY, CONTENT_WIDTH, 104, 12).fill("#fffaf0").strokeColor("#f4d48c").stroke();
    doc.fillColor(teal).font("Helvetica-Bold").fontSize(7.8).text("AUTHORISATION AND ACCEPTANCE", 58, signY + 15, { lineBreak: false });
    doc.fillColor(ink).font("Helvetica").fontSize(8).text(
      "Please reply to confirm acceptance or request clarification. This offer letter is issued by an authorised Innovex signatory.",
      58,
      signY + 35,
      { width: 270, lineGap: 2 }
    );
    drawAsset(doc, "director-signature-ahsan.png", 355, signY + 5, { fit: [176, 58], align: "center", valign: "center" });
    doc.moveTo(350, signY + 68).lineTo(530, signY + 68).strokeColor(line).stroke();
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(8.2).text(signatoryName, 350, signY + 75, { width: 180, align: "center", lineBreak: false });
    doc.fillColor(muted).font("Helvetica").fontSize(7.2).text(signatoryTitle, 350, signY + 87, { width: 180, align: "center", lineBreak: false });

    finish(doc, resolve, chunks);
  });
}
