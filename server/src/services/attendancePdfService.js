import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const LEFT = 42;
const CONTENT_WIDTH = 511;
const teal = "#064f5e";
const deepTeal = "#033d49";
const gold = "#f4b942";
const ink = "#173840";
const muted = "#667d84";
const line = "#d7e5e7";
const soft = "#f4f9f9";

function assetPath(...parts) {
  const candidates = [
    path.join(process.cwd(), ...parts),
    path.join(process.cwd(), "..", ...parts)
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function drawImage(doc, filename, x, y, options) {
  if (!filename) return false;
  try {
    doc.image(filename, x, y, options);
    return true;
  } catch {
    return false;
  }
}

function cleanText(value, fallback = "-") {
  return String(value || fallback)
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\u00a0/g, " ");
}

function dateLabel(value) {
  if (!value) return "-";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function timeLabel(value) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
}

function minutesFor(record, generatedAt) {
  if (!record?.checkInAt) return 0;
  const end = record.checkOutAt ? new Date(record.checkOutAt) : generatedAt;
  return Math.max(0, Math.floor((end - new Date(record.checkInAt)) / 60000));
}

function hoursLabel(minutes) {
  const total = Number(minutes || 0);
  return `${Math.floor(total / 60)}h ${total % 60}m`;
}

function drawHeader(doc, title, subtitle) {
  doc.rect(0, 0, PAGE_WIDTH, 9).fill(gold);
  doc.rect(0, 9, PAGE_WIDTH, 103).fill(deepTeal);
  const logo = assetPath("client", "public", "Logo.png");
  const hasLogo = drawImage(doc, logo, LEFT, 31, { fit: [72, 45], align: "left", valign: "center" });
  const brandX = hasLogo ? 125 : LEFT;
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(12)
    .text("INNOVEX RESOURCE GROUP LIMITED", brandX, 37, { width: 290, lineBreak: false });
  doc.fillColor("#b9d8dc").font("Helvetica").fontSize(8)
    .text("Recruitment | Training | Website Development | SEO", brandX, 58, { width: 300, lineBreak: false });
  doc.fillColor("#d8eaec").fontSize(7.2)
    .text("Company No. 15975820 | Registered in England and Wales", brandX, 75, { width: 300, lineBreak: false });
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(20)
    .text(title, 365, 35, { width: 188, align: "right", lineBreak: false });
  doc.fillColor(gold).fontSize(8.5)
    .text(subtitle, 335, 68, { width: 218, align: "right", lineBreak: false, ellipsis: true });
}

function drawFooter(doc, pageNumber, totalPages, downloadedBy) {
  doc.moveTo(LEFT, 784).lineTo(LEFT + CONTENT_WIDTH, 784).strokeColor(line).lineWidth(0.8).stroke();
  doc.fillColor(muted).font("Helvetica").fontSize(6.3)
    .text(`Downloaded by ${downloadedBy.name}, ${downloadedBy.title}, Innovex Resource Group Limited`, LEFT, 793, { width: CONTENT_WIDTH, align: "center", lineBreak: false })
    .text("info@innovexresourcegroup.co.uk | 0330 0435 830", LEFT, 804, { width: CONTENT_WIDTH, align: "center", lineBreak: false });
  doc.fillColor(teal).font("Helvetica-Bold").fontSize(6.3)
    .text(`PAGE ${pageNumber} OF ${totalPages}`, 470, 819, { width: 83, align: "right", lineBreak: false });
}

function metaBox(doc, items, y) {
  const columnWidth = CONTENT_WIDTH / items.length;
  doc.roundedRect(LEFT, y, CONTENT_WIDTH, 62, 10).fill(soft).strokeColor(line).stroke();
  items.forEach(([label, value], index) => {
    const x = LEFT + index * columnWidth;
    if (index) doc.moveTo(x, y).lineTo(x, y + 62).strokeColor(line).stroke();
    doc.fillColor(muted).font("Helvetica-Bold").fontSize(6.6)
      .text(label.toUpperCase(), x + 12, y + 14, { width: columnWidth - 24, lineBreak: false });
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(8.6)
      .text(cleanText(value), x + 12, y + 33, { width: columnWidth - 24, lineBreak: false, ellipsis: true });
  });
}

function metric(doc, x, y, width, label, value) {
  doc.roundedRect(x, y, width, 58, 9).fill("#ffffff").strokeColor(line).stroke();
  doc.fillColor(muted).font("Helvetica-Bold").fontSize(6.4)
    .text(label.toUpperCase(), x + 11, y + 12, { width: width - 22, lineBreak: false, align: "center" });
  doc.fillColor(teal).font("Helvetica-Bold").fontSize(16)
    .text(String(value), x + 11, y + 31, { width: width - 22, lineBreak: false, align: "center" });
}

function sectionTitle(doc, title, y) {
  doc.fillColor(teal).font("Helvetica-Bold").fontSize(9).text(title, LEFT, y, { lineBreak: false });
  doc.moveTo(LEFT, y + 16).lineTo(LEFT + CONTENT_WIDTH, y + 16).strokeColor(gold).lineWidth(1.2).stroke();
  return y + 27;
}

function detailHeader(doc, y) {
  const columns = [
    ["DATE", 48, 58], ["EMPLOYEE", 106, 105], ["LOCATION", 211, 56],
    ["IN", 267, 45], ["OUT", 312, 45], ["HOURS", 357, 50],
    ["DOWNLOADED", 407, 68], ["SUBMITTED", 475, 68]
  ];
  doc.roundedRect(LEFT, y, CONTENT_WIDTH, 27, 6).fill(teal);
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(6.4);
  columns.forEach(([label, x, width]) => doc.text(label, x, y + 10, { width, align: x >= 267 ? "center" : "left", lineBreak: false }));
  return y + 27;
}

function detailRowHeight(doc, record) {
  const notes = cleanText(record.notes, "");
  if (!notes) return 29;
  doc.font("Helvetica-Oblique").fontSize(6.4);
  const notesHeight = doc.heightOfString(`Notes: ${notes}`, { width: CONTENT_WIDTH - 28, lineGap: 1 });
  return Math.max(45, 31 + notesHeight);
}

function drawDetailRow(doc, record, y, index, generatedAt) {
  const notes = cleanText(record.notes, "");
  const rowHeight = detailRowHeight(doc, record);
  if (index % 2 === 0) doc.rect(LEFT, y, CONTENT_WIDTH, rowHeight).fill(soft);
  doc.fillColor(ink).font("Helvetica").fontSize(7.1);
  doc.text(dateLabel(record.attendanceDate), 48, y + 9, { width: 58, lineBreak: false });
  doc.font("Helvetica-Bold").text(cleanText(record.employeeName), 106, y + 9, { width: 101, lineBreak: false, ellipsis: true });
  doc.font("Helvetica").text(cleanText(record.workLocation), 211, y + 9, { width: 56, lineBreak: false });
  const centered = [
    [timeLabel(record.checkInAt), 267, 45], [timeLabel(record.checkOutAt), 312, 45],
    [hoursLabel(minutesFor(record, generatedAt)), 357, 50], [record.cvsDownloaded ?? 0, 407, 68], [record.cvsSubmitted ?? 0, 475, 68]
  ];
  centered.forEach(([value, x, width]) => doc.text(String(value), x, y + 9, { width, align: "center", lineBreak: false }));
  if (notes) {
    doc.fillColor(muted).font("Helvetica-Oblique").fontSize(6.4)
      .text(`Notes: ${notes}`, LEFT + 14, y + 25, { width: CONTENT_WIDTH - 28, lineGap: 1 });
  }
  doc.moveTo(LEFT, y + rowHeight).lineTo(LEFT + CONTENT_WIDTH, y + rowHeight).strokeColor(line).lineWidth(0.5).stroke();
  return y + rowHeight;
}

export function generateAttendanceReportPdf(report, options = {}) {
  return new Promise((resolve, reject) => {
    const downloadedBy = {
      name: options.downloadedBy?.name || "Muhammad Ahsan Qasim",
      title: options.downloadedBy?.title || "Co-Founder and Director"
    };
    const generatedAt = options.generatedAt ? new Date(options.generatedAt) : new Date();
    const employeeLabel = options.employeeLabel || "All employees";
    const filters = report.filters || {};
    const records = Array.isArray(report.records) ? report.records : [];
    const summaries = Array.isArray(report.summaries) ? report.summaries : [];
    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      bufferPages: true,
      info: { Title: `Attendance Report - ${employeeLabel}`, Author: "Innovex Resource Group Limited" }
    });
    const chunks = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const periodLabel = `${dateLabel(filters.from)} to ${dateLabel(filters.to)}`;
    drawHeader(doc, "Attendance Report", employeeLabel);
    metaBox(doc, [
      ["Reporting period", periodLabel],
      ["Employee / candidate", employeeLabel],
      ["Generated", generatedAt.toLocaleString("en-GB", { timeZone: "Europe/London" })]
    ], 132);

    const totalMinutes = summaries.reduce((sum, item) => sum + Number(item.totalMinutes || 0), 0);
    const totalDownloaded = records.reduce((sum, item) => sum + Number(item.cvsDownloaded || 0), 0);
    const totalSubmitted = records.reduce((sum, item) => sum + Number(item.cvsSubmitted || 0), 0);
    const metricWidth = (CONTENT_WIDTH - 27) / 4;
    metric(doc, LEFT, 210, metricWidth, "Days present", records.length);
    metric(doc, LEFT + metricWidth + 9, 210, metricWidth, "Total hours", hoursLabel(totalMinutes));
    metric(doc, LEFT + (metricWidth + 9) * 2, 210, metricWidth, "CVs downloaded", totalDownloaded);
    metric(doc, LEFT + (metricWidth + 9) * 3, 210, metricWidth, "CVs submitted", totalSubmitted);

    let y = sectionTitle(doc, "DAILY ATTENDANCE DETAILS", 288);
    y = detailHeader(doc, y);
    if (!records.length) {
      doc.fillColor(muted).font("Helvetica").fontSize(8.5)
        .text("No attendance records were found for this reporting period.", LEFT, y + 18, { width: CONTENT_WIDTH, align: "center" });
      y += 56;
    } else {
      records.forEach((record, index) => {
        const requiredHeight = detailRowHeight(doc, record);
        if (y + requiredHeight > 758) {
          doc.addPage();
          drawHeader(doc, "Attendance Report", `${employeeLabel} - continued`);
          y = sectionTitle(doc, "DAILY ATTENDANCE DETAILS - CONTINUED", 136);
          y = detailHeader(doc, y);
        }
        y = drawDetailRow(doc, record, y, index, generatedAt);
      });
    }

    if (y + 135 > 758) {
      doc.addPage();
      drawHeader(doc, "Attendance Report", "Authorised download record");
      y = 145;
    } else {
      y += 22;
    }

    doc.roundedRect(LEFT, y, CONTENT_WIDTH, 116, 12).fill("#fffaf0").strokeColor("#efd38a").stroke();
    doc.fillColor(teal).font("Helvetica-Bold").fontSize(7.4)
      .text("AUTHORISED DOWNLOAD RECORD", LEFT + 16, y + 14, { lineBreak: false });
    doc.fillColor(ink).font("Helvetica").fontSize(8)
      .text("This attendance report was generated and downloaded from the Innovex administration portal.", LEFT + 16, y + 32, { width: 285, lineGap: 2 });
    const signature = assetPath("server", "assets", "director-signature-ahsan.png");
    drawImage(doc, signature, 350, y + 7, { fit: [178, 59], align: "center", valign: "center" });
    doc.moveTo(342, y + 69).lineTo(535, y + 69).strokeColor(line).stroke();
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(8.4)
      .text(downloadedBy.name, 342, y + 77, { width: 193, align: "center", lineBreak: false });
    doc.fillColor(muted).font("Helvetica").fontSize(7.1)
      .text(downloadedBy.title, 342, y + 90, { width: 193, align: "center", lineBreak: false })
      .text("Innovex Resource Group Limited", 342, y + 101, { width: 193, align: "center", lineBreak: false });
    doc.fillColor(muted).font("Helvetica").fontSize(6.7)
      .text(`Downloaded by ${downloadedBy.name}, ${downloadedBy.title}, Innovex Resource Group Limited`, LEFT + 16, y + 83, { width: 275, lineGap: 2 });

    const range = doc.bufferedPageRange();
    for (let page = range.start; page < range.start + range.count; page += 1) {
      doc.switchToPage(page);
      drawFooter(doc, page + 1, range.count, downloadedBy);
    }
    doc.end();
  });
}
