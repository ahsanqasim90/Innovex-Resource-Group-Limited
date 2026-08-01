import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";

const BRAND = {
  teal: "064F5E",
  tealDark: "033B47",
  tealSoft: "E9F7F6",
  gold: "F4B942",
  goldSoft: "FFF5D9",
  ink: "173840",
  muted: "647B82",
  line: "D9E8EA",
  white: "FFFFFF"
};

const columns = [
  ["Business name", "businessName", 28],
  ["Category", "businessCategory", 22],
  ["Contact person", "contactPerson", 22],
  ["Job title", "contactJobTitle", 20],
  ["Primary phone", "telephone", 18],
  ["Secondary phone", "secondaryPhone", 18],
  ["Primary email", "email", 30],
  ["Secondary email", "secondaryEmail", 30],
  ["Website", "websiteUrl", 28],
  ["Full address", "fullAddress", 34],
  ["Town / city", "townCity", 18],
  ["Region", "region", 18],
  ["Postcode", "postcode", 13],
  ["Status", "status", 21],
  ["Interested services", "interestedServices", 36],
  ["Initial response", "initialResponse", 30],
  ["Preferred contact", "preferredContactMethod", 18],
  ["Decision maker", "decisionMakerName", 22],
  ["Decision maker position", "decisionMakerPosition", 24],
  ["Existing supplier", "existingSupplier", 22],
  ["Website condition", "websiteCondition", 22],
  ["Budget indication", "budgetIndication", 20],
  ["Expected timeline", "expectedTimeline", 20],
  ["Agent / owner", "createdByName", 22],
  ["Created", "createdAt", 18],
  ["Last updated", "updatedAt", 18],
  ["Notes", "notes", 42]
];

const emailDirectoryColumns = [
  ["Business name", "businessName", 30],
  ["Contact person", "contactPerson", 24],
  ["Primary email", "email", 34],
  ["Secondary email", "secondaryEmail", 34],
  ["Primary phone", "telephone", 19],
  ["Status", "status", 21],
  ["Category", "businessCategory", 23],
  ["Agent / owner", "createdByName", 23],
  ["Last updated", "updatedAt", 19]
];

const successStatuses = new Set(["Won", "Accepted by Innovex", "Qualified", "Meeting Booked"]);
const warningStatuses = new Set(["Interested", "Email Requested", "Follow-Up Required", "Proposal Required", "Proposal Sent"]);
const dangerStatuses = new Set(["Lost", "Rejected by Innovex", "Not Interested", "Do Not Contact"]);

function normaliseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function rowValue(item, key) {
  if (key === "interestedServices") return (item.interestedServices || []).join(", ") || null;
  if (key === "createdAt" || key === "updatedAt") return normaliseDate(item[key]);
  return item[key] || null;
}

function logoPath() {
  const candidates = [
    path.resolve(process.cwd(), "client/public/Logo.png"),
    path.resolve(process.cwd(), "../client/public/Logo.png"),
    path.resolve(process.cwd(), "public/Logo.png")
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function addLogo(workbook, sheet, range = "A1:B4") {
  const filename = logoPath();
  if (!filename) return;
  const imageId = workbook.addImage({ filename, extension: "png" });
  sheet.addImage(imageId, range);
}

function styleTitle(sheet, title, subtitle, endColumn) {
  sheet.mergeCells(1, 3, 2, endColumn);
  const titleCell = sheet.getCell(1, 3);
  titleCell.value = title;
  titleCell.font = { name: "Aptos Display", size: 22, bold: true, color: { argb: BRAND.white } };
  titleCell.alignment = { vertical: "middle", horizontal: "left" };
  sheet.mergeCells(3, 3, 4, endColumn);
  const subtitleCell = sheet.getCell(3, 3);
  subtitleCell.value = subtitle;
  subtitleCell.font = { name: "Aptos", size: 10, color: { argb: "C8E4E7" } };
  subtitleCell.alignment = { vertical: "middle", wrapText: true };
  sheet.getRows(1, 4).forEach((row) => {
    row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.teal } };
  });
  sheet.getRow(1).height = 26;
  sheet.getRow(2).height = 18;
  sheet.getRow(3).height = 19;
  sheet.getRow(4).height = 19;
}

function addMetric(sheet, range, label, value, fill) {
  sheet.mergeCells(range.label);
  sheet.mergeCells(range.value);
  const labelCell = sheet.getCell(range.label.split(":")[0]);
  const valueCell = sheet.getCell(range.value.split(":")[0]);
  labelCell.value = label.toUpperCase();
  valueCell.value = value;
  labelCell.font = { name: "Aptos", size: 9, bold: true, color: { argb: BRAND.muted } };
  valueCell.font = { name: "Aptos Display", size: 20, bold: true, color: { argb: BRAND.ink } };
  [labelCell, valueCell].forEach((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });
}

function addSummarySheet(workbook, items, metadata) {
  const sheet = workbook.addWorksheet("Export Summary", {
    views: [{ showGridLines: false, zoomScale: 90 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 1 }
  });
  for (let column = 1; column <= 12; column += 1) sheet.getColumn(column).width = 13;
  styleTitle(sheet, "Prospect Export", "A secure, professional snapshot of the Innovex Web Leads CRM pipeline.", 12);
  addLogo(workbook, sheet);

  sheet.mergeCells("A6:L6");
  sheet.getCell("A6").value = `Generated ${metadata.generatedAt.toLocaleString("en-GB")}  |  Scope: ${metadata.scopeLabel}  |  Prepared for: ${metadata.preparedFor}`;
  sheet.getCell("A6").font = { name: "Aptos", size: 10, color: { argb: BRAND.muted } };
  sheet.getCell("A6").alignment = { vertical: "middle" };
  sheet.getRow(6).height = 25;

  const emailContacts = items.filter((item) => item.email).length;
  const activeFollowUps = items.reduce((total, item) => total + (item.followUps || []).filter((followUp) => !followUp.completed).length, 0);
  const positive = items.filter((item) => successStatuses.has(item.status)).length;
  addMetric(sheet, { label: "A8:C8", value: "A9:C10" }, "Total prospects", items.length, BRAND.tealSoft);
  addMetric(sheet, { label: "D8:F8", value: "D9:F10" }, "Email contacts", emailContacts, "EEF7FB");
  addMetric(sheet, { label: "G8:I8", value: "G9:I10" }, "Open follow-ups", activeFollowUps, BRAND.goldSoft);
  addMetric(sheet, { label: "J8:L8", value: "J9:L10" }, "Positive outcomes", positive, "E8F7EF");
  sheet.getRows(8, 3).forEach((row) => { row.height = row.number === 8 ? 21 : 22; });

  const statusCounts = new Map();
  const categoryCounts = new Map();
  items.forEach((item) => {
    statusCounts.set(item.status || "Unspecified", (statusCounts.get(item.status || "Unspecified") || 0) + 1);
    categoryCounts.set(item.businessCategory || "Unspecified", (categoryCounts.get(item.businessCategory || "Unspecified") || 0) + 1);
  });
  const statuses = [...statusCounts.entries()].sort((a, b) => b[1] - a[1]);
  const categories = [...categoryCounts.entries()].sort((a, b) => b[1] - a[1]);

  sheet.mergeCells("A12:F12");
  sheet.mergeCells("G12:L12");
  sheet.getCell("A12").value = "PIPELINE BY STATUS";
  sheet.getCell("G12").value = "PROSPECTS BY CATEGORY";
  ["A12", "G12"].forEach((address) => {
    const cell = sheet.getCell(address);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.tealDark } };
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: BRAND.white } };
    cell.alignment = { vertical: "middle" };
  });
  sheet.getRow(12).height = 24;

  const summaryRows = Math.max(statuses.length, categories.length, 1);
  for (let index = 0; index < summaryRows; index += 1) {
    const rowNumber = 13 + index;
    const status = statuses[index] || [null, null];
    const category = categories[index] || [null, null];
    sheet.mergeCells(rowNumber, 1, rowNumber, 5);
    sheet.getCell(rowNumber, 1).value = status[0];
    sheet.getCell(rowNumber, 6).value = status[1];
    sheet.mergeCells(rowNumber, 7, rowNumber, 11);
    sheet.getCell(rowNumber, 7).value = category[0];
    sheet.getCell(rowNumber, 12).value = category[1];
    [1, 6, 7, 12].forEach((column) => {
      const cell = sheet.getCell(rowNumber, column);
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: index % 2 ? "F7FBFB" : BRAND.white } };
      cell.font = { name: "Aptos", size: 10, color: { argb: BRAND.ink }, bold: column === 6 || column === 12 };
      cell.alignment = { vertical: "middle", horizontal: column === 6 || column === 12 ? "right" : "left" };
      cell.border = { bottom: { style: "hair", color: { argb: BRAND.line } } };
    });
    sheet.getRow(rowNumber).height = 21;
  }

  const noteRow = 14 + summaryRows;
  sheet.mergeCells(noteRow, 1, noteRow + 1, 12);
  const noteCell = sheet.getCell(noteRow, 1);
  noteCell.value = "Confidential CRM export. Handle in accordance with Innovex data-protection procedures. Use the Prospects sheet for filtering, searching and operational follow-up.";
  noteCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.goldSoft } };
  noteCell.font = { name: "Aptos", size: 9, italic: true, color: { argb: BRAND.ink } };
  noteCell.alignment = { vertical: "middle", wrapText: true };
  sheet.freezePanes = { ySplit: 6 };
  return sheet;
}

function addEmailDirectorySheet(workbook, items, metadata) {
  const sheet = workbook.addWorksheet("Email Directory", {
    views: [{ showGridLines: false, zoomScale: 90, state: "frozen", xSplit: 2, ySplit: 5, topLeftCell: "C6", activeCell: "A6" }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }
  });
  emailDirectoryColumns.forEach(([, , width], index) => { sheet.getColumn(index + 1).width = width; });
  styleTitle(sheet, "Prospect Email Directory", `${items.length.toLocaleString("en-GB")} records  |  Email contacts shown first for immediate access  |  Generated ${metadata.generatedAt.toLocaleDateString("en-GB")}`, emailDirectoryColumns.length);
  addLogo(workbook, sheet);

  const headerRow = sheet.getRow(5);
  headerRow.values = emailDirectoryColumns.map(([label]) => label);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.tealDark } };
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: BRAND.white } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: BRAND.gold } } };
  });

  items.forEach((item, itemIndex) => {
    const row = sheet.addRow(emailDirectoryColumns.map(([, key]) => rowValue(item, key)));
    row.height = 29;
    const fill = itemIndex % 2 ? "F7FBFB" : BRAND.white;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      cell.font = { name: "Aptos", size: 9, color: { argb: BRAND.ink } };
      cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      cell.border = { bottom: { style: "hair", color: { argb: BRAND.line } } };
      if (columnNumber === 9 && cell.value) cell.numFmt = "dd mmm yyyy hh:mm";
    });
    [3, 4].forEach((columnNumber) => {
      const cell = row.getCell(columnNumber);
      if (cell.value) {
        const address = String(cell.value);
        cell.value = { text: address, hyperlink: `mailto:${address}`, tooltip: `Email ${address}` };
        cell.font = { name: "Aptos", size: 9, color: { argb: "0D7182" }, underline: true };
      }
    });
    const statusCell = row.getCell(6);
    const status = String(statusCell.value || "");
    const statusFill = successStatuses.has(status) ? "DFF4E8" : dangerStatuses.has(status) ? "FCE2E2" : warningStatuses.has(status) ? BRAND.goldSoft : "E5F3F8";
    statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusFill } };
    statusCell.font = { name: "Aptos", size: 9, bold: true, color: { argb: BRAND.ink } };
  });

  const finalRow = Math.max(5 + items.length, 6);
  sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: finalRow, column: emailDirectoryColumns.length } };
  sheet.headerFooter.oddFooter = "&LInnovex Resource Group Limited&CConfidential email directory&RPage &P of &N";
  return sheet;
}

function addProspectsSheet(workbook, items, metadata) {
  const sheet = workbook.addWorksheet("Prospects", {
    views: [{ showGridLines: false, zoomScale: 80, state: "frozen", xSplit: 2, ySplit: 5, topLeftCell: "C6", activeCell: "A6" }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.25, right: 0.25, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }
  });
  columns.forEach(([, , width], index) => { sheet.getColumn(index + 1).width = width; });
  styleTitle(sheet, "Innovex Prospect Register", `${items.length.toLocaleString("en-GB")} records  |  ${metadata.scopeLabel}  |  Generated ${metadata.generatedAt.toLocaleDateString("en-GB")}`, columns.length);
  addLogo(workbook, sheet);

  const headerRow = sheet.getRow(5);
  headerRow.values = columns.map(([label]) => label);
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: BRAND.tealDark } };
    cell.font = { name: "Aptos", size: 10, bold: true, color: { argb: BRAND.white } };
    cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
    cell.border = { bottom: { style: "medium", color: { argb: BRAND.gold } } };
  });

  items.forEach((item, itemIndex) => {
    const row = sheet.addRow(columns.map(([, key]) => rowValue(item, key)));
    row.height = 31;
    const fill = itemIndex % 2 ? "F7FBFB" : BRAND.white;
    row.eachCell({ includeEmpty: true }, (cell, columnNumber) => {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      cell.font = { name: "Aptos", size: 9, color: { argb: BRAND.ink } };
      cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      cell.border = { bottom: { style: "hair", color: { argb: BRAND.line } } };
      if ([25, 26].includes(columnNumber) && cell.value) cell.numFmt = "dd mmm yyyy hh:mm";
    });
    [7, 8].forEach((columnNumber) => {
      const cell = row.getCell(columnNumber);
      if (cell.value) cell.value = { text: String(cell.value), hyperlink: `mailto:${cell.value}`, tooltip: `Email ${cell.value}` };
      cell.font = { name: "Aptos", size: 9, color: { argb: "0D7182" }, underline: Boolean(cell.value) };
    });
    const websiteCell = row.getCell(9);
    if (websiteCell.value) {
      const website = String(websiteCell.value);
      const hyperlink = /^https?:\/\//i.test(website) ? website : `https://${website}`;
      websiteCell.value = { text: website, hyperlink, tooltip: `Open ${website}` };
      websiteCell.font = { name: "Aptos", size: 9, color: { argb: "0D7182" }, underline: true };
    }
    const statusCell = row.getCell(14);
    const status = String(statusCell.value || "");
    const statusFill = successStatuses.has(status) ? "DFF4E8" : dangerStatuses.has(status) ? "FCE2E2" : warningStatuses.has(status) ? BRAND.goldSoft : "E5F3F8";
    statusCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: statusFill } };
    statusCell.font = { name: "Aptos", size: 9, bold: true, color: { argb: BRAND.ink } };
  });

  const finalRow = Math.max(5 + items.length, 6);
  sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: finalRow, column: columns.length } };
  sheet.headerFooter.oddFooter = "&LInnovex Resource Group Limited&CConfidential prospect register&RPage &P of &N";
  return sheet;
}

export async function generateWebLeadProspectsWorkbook(items = [], options = {}) {
  const metadata = {
    generatedAt: options.generatedAt ? new Date(options.generatedAt) : new Date(),
    scopeLabel: options.scopeLabel || "All accessible prospects",
    preparedFor: options.preparedFor || "Innovex CRM user"
  };
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Innovex Resource Group Limited";
  workbook.lastModifiedBy = metadata.preparedFor;
  workbook.company = "Innovex Resource Group Limited";
  workbook.subject = "Professional prospect register export";
  workbook.title = "Innovex Prospect Register";
  workbook.description = "Secure export generated by the Innovex Web Leads CRM.";
  workbook.created = metadata.generatedAt;
  workbook.modified = metadata.generatedAt;
  workbook.calcProperties.fullCalcOnLoad = true;
  workbook.views = [{ x: 0, y: 0, width: 16000, height: 9000, firstSheet: 0, activeTab: 0, visibility: "visible" }];
  addEmailDirectorySheet(workbook, items, metadata);
  addSummarySheet(workbook, items, metadata);
  addProspectsSheet(workbook, items, metadata);
  const output = await workbook.xlsx.writeBuffer();
  return Buffer.from(output);
}

export function prospectExportFilename(date = new Date()) {
  const stamp = new Date(date).toISOString().slice(0, 10);
  return `Innovex-Prospects-${stamp}.xlsx`;
}
