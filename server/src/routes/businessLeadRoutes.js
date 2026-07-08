import express from "express";
import BusinessLead from "../models/BusinessLead.js";
import EmailLog from "../models/EmailLog.js";
import { allowedSenderAccountsForUser, canUseSender } from "../config/emailAccounts.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { uploadBusinessLeadCsv } from "../middleware/upload.js";
import { sendBusinessLeadOutreachEmail } from "../services/emailService.js";
import { pick, requireFields, validateEmail } from "../utils.js";

const router = express.Router();
router.use(protect, requirePermission("businessLeads.view"));

const leadFields = [
  "companyName",
  "category",
  "contactName",
  "emails",
  "phone",
  "postcode",
  "city",
  "website",
  "serviceInterests",
  "status",
  "source",
  "notes"
];

const categoryAliases = {
  carehome: "Care Home",
  carehomes: "Care Home",
  nursinghome: "Care Home",
  nursinghomes: "Care Home",
  childrenhome: "Children Home",
  childrenshome: "Children Home",
  childrenhomes: "Children Home",
  childrenshomes: "Children Home",
  supportedliving: "Supported Living",
  healthcarecompany: "Healthcare Company",
  healthcare: "Healthcare Company",
  websitelead: "Website Lead",
  webdevelopment: "Website Lead",
  webdevelopmentseo: "Website Lead",
  seolead: "SEO Lead",
  seo: "SEO Lead",
  traininglead: "Training Lead",
  courses: "Training Lead",
  compliancelead: "Compliance Lead",
  compliance: "Compliance Lead",
  other: "Other"
};

const validBusinessLeadStatuses = new Set(["New", "Contacted", "Interested", "Follow-up", "Converted", "Not Interested", "Do Not Contact"]);
const validBusinessLeadCategories = new Set([
  "Care Home",
  "Children Home",
  "Supported Living",
  "Healthcare Company",
  "Website Lead",
  "SEO Lead",
  "Training Lead",
  "Compliance Lead",
  "Other"
]);

const headerMap = {
  company: "companyName",
  companyname: "companyName",
  carename: "companyName",
  carehomename: "companyName",
  childrenhome: "companyName",
  childrenhomename: "companyName",
  businessname: "companyName",
  name: "companyName",
  category: "category",
  type: "category",
  niche: "category",
  sector: "category",
  leadtype: "category",
  organisationtype: "category",
  organizationtype: "category",
  contact: "contactName",
  contactname: "contactName",
  manager: "contactName",
  email: "emails",
  emails: "emails",
  emailaddress: "emails",
  email1: "email1",
  email2: "email2",
  email3: "email3",
  email4: "email4",
  email5: "email5",
  phone: "phone",
  phonenumber: "phone",
  number: "phone",
  telephone: "phone",
  contactnumber: "phone",
  postcode: "postcode",
  post_code: "postcode",
  postalcode: "postcode",
  city: "city",
  town: "city",
  location: "city",
  website: "website",
  websiteurl: "website",
  url: "website",
  service: "serviceInterests",
  services: "serviceInterests",
  serviceinterest: "serviceInterests",
  serviceinterests: "serviceInterests",
  interest: "serviceInterests",
  status: "status",
  source: "source",
  notes: "notes"
};

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeHeader(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeCompany(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function cleanPostcode(value = "") {
  return String(value).toUpperCase().replace(/\s+/g, " ").trim();
}

function postcodePrefix(value = "") {
  return cleanPostcode(value).replace(/\s+/g, "").slice(0, 4);
}

function cleanEmail(value = "") {
  return String(value).replace(/\s+/g, "").trim().toLowerCase();
}

function normalizeCategory(value = "") {
  return categoryAliases[normalizeHeader(value)] || "";
}

function looksLikeUkPostcode(value = "") {
  const cleaned = String(value || "").toUpperCase().replace(/\s+/g, "");
  return /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/.test(cleaned);
}

function splitList(value = "") {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value || "").split(/[;,|]/).map((item) => item.trim()).filter(Boolean);
}

function rawEmailValues(input = {}) {
  const values = [];
  if (Array.isArray(input.emails)) {
    input.emails.forEach((item) => values.push(typeof item === "string" ? item : item?.email));
  } else if (input.emails) {
    values.push(...splitList(input.emails));
  }
  ["email", "email1", "email2", "email3", "email4", "email5"].forEach((field) => {
    if (input[field]) values.push(...splitList(input[field]));
  });
  return values.map((item) => String(item || "").trim()).filter(Boolean);
}

function parseEmails(input = {}) {
  const seen = new Set();
  return rawEmailValues(input)
    .map(cleanEmail)
    .filter(Boolean)
    .map((email, index) => {
      try {
        validateEmail(email);
      } catch {
        return null;
      }
      if (seen.has(email)) return null;
      seen.add(email);
      return { email, label: index === 0 ? "Primary" : `Email ${index + 1}`, primary: index === 0 };
    })
    .filter(Boolean);
}

function invalidEmailValues(input = {}) {
  return rawEmailValues(input).filter((email) => !parseEmails({ emails: email }).length);
}

function visibleRowValue(row, fields = []) {
  return fields
    .map((field) => String(row[field] || "").trim())
    .filter(Boolean)
    .join(" | ");
}

function importIssue(row, field, message, value = "") {
  return {
    row: row.__rowNumber,
    field,
    value: value || visibleRowValue(row, ["companyName", "emails", "email1", "phone", "postcode"]),
    message
  };
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, ""));
}

function splitCsvRows(text) {
  const rows = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += char + next;
      index += 1;
      continue;
    }
    if (char === '"') quoted = !quoted;
    if ((char === "\n" || char === "\r") && !quoted) {
      if (current.trim()) rows.push(current);
      current = "";
      if (char === "\r" && next === "\n") index += 1;
    } else {
      current += char;
    }
  }
  if (current.trim()) rows.push(current);
  return rows;
}

function parseCsv(buffer) {
  const text = buffer.toString("utf8").replace(/^\uFEFF/, "");
  const rows = splitCsvRows(text);
  if (rows.length < 2) return [];
  const headers = parseCsvLine(rows[0]).map((header) => headerMap[normalizeHeader(header)] || normalizeHeader(header));
  return rows.slice(1).map((line, rowIndex) => {
    const values = parseCsvLine(line);
    const record = headers.reduce((result, header, index) => {
      if (!header) return result;
      result[header] = values[index] || "";
      return result;
    }, {});
    record.__rowNumber = rowIndex + 2;
    return record;
  });
}

function sanitizeLead(input, options = {}) {
  const data = pick(input, leadFields);
  const categoryFromInput = normalizeCategory(data.category);
  const categoryFromPostcode = normalizeCategory(data.postcode);

  if (categoryFromInput) {
    data.category = categoryFromInput;
  } else if (data.category && !categoryFromInput) {
    data.category = "Other";
  }

  if (categoryFromPostcode && !looksLikeUkPostcode(data.postcode)) {
    data.category = categoryFromPostcode;
    data.postcode = "";
  }

  if (data.postcode) {
    data.postcode = cleanPostcode(data.postcode);
    data.postcodePrefix = postcodePrefix(data.postcode);
  }
  if (data.companyName) data.companyKey = normalizeCompany(data.companyName);
  if (data.emails || input.email || input.email1 || input.email2 || input.email3 || input.email4 || input.email5) {
    data.emails = parseEmails(input);
  }
  if (data.serviceInterests !== undefined) data.serviceInterests = splitList(data.serviceInterests);
  return data;
}

function validateBusinessLeadImportRows(rows = []) {
  const issues = [];
  const warnings = [];
  const seenRows = new Map();
  const maxReportItems = 250;
  let emptyRows = 0;
  let importableRows = 0;
  let issueCount = 0;
  let warningCount = 0;

  rows.forEach((row) => {
    const hasData = Boolean(
      row.companyName ||
      row.contactName ||
      row.phone ||
      row.postcode ||
      row.city ||
      row.website ||
      row.serviceInterests ||
      row.emails ||
      row.email1 ||
      row.email2 ||
      row.email3 ||
      row.email4 ||
      row.email5
    );
    if (!hasData) {
      emptyRows += 1;
      return;
    }

    importableRows += 1;
    const rowIssues = [];
    const companyName = String(row.companyName || "").trim();
    const phone = String(row.phone || "").trim();
    const validEmails = parseEmails(row);
    const invalidEmails = invalidEmailValues(row);
    const category = String(row.category || "").trim();
    const normalizedCategory = normalizeCategory(category);
    const status = String(row.status || "").trim();

    if (!companyName) {
      rowIssues.push(importIssue(row, "Company Name", "Company name is required for business leads."));
    }

    if (!validEmails.length && !phone) {
      rowIssues.push(importIssue(row, "Email / Phone", "At least one valid email address or phone number is required."));
    }

    invalidEmails.forEach((email) => {
      rowIssues.push(importIssue(row, "Email", "Invalid email address format.", email));
    });

    if (category && !normalizedCategory && !validBusinessLeadCategories.has(category)) {
      // category may still be handled as Other by sanitizeLead, so this is a warning not a blocker.
      warningCount += 1;
      if (warnings.length < maxReportItems) {
        warnings.push(importIssue(row, "Category", "Category was not recognised and will be imported as Other.", category));
      }
    }

    if (status && !validBusinessLeadStatuses.has(status)) {
      rowIssues.push(importIssue(row, "Status", `Status must be one of: ${Array.from(validBusinessLeadStatuses).join(", ")}.`, status));
    }

    const duplicateKey = `${normalizeCompany(companyName)}|${postcodePrefix(row.postcode || "")}`;
    if (companyName && seenRows.has(duplicateKey)) {
      warningCount += 1;
      if (warnings.length < maxReportItems) {
        warnings.push({
          row: row.__rowNumber,
          field: "Duplicate company",
          value: companyName,
          message: `This appears to duplicate row ${seenRows.get(duplicateKey)} and will be merged into one company record.`
        });
      }
    } else if (companyName) {
      seenRows.set(duplicateKey, row.__rowNumber);
    }

    rowIssues.forEach((issue) => {
      issueCount += 1;
      if (issues.length < maxReportItems) issues.push(issue);
    });
  });

  return {
    rowsRead: rows.length,
    importableRows,
    emptyRows,
    issueCount,
    warningCount,
    issues,
    warnings,
    truncated: issueCount > issues.length || warningCount > warnings.length
  };
}

function mergeEmailLists(existing = [], incoming = []) {
  const map = new Map();
  [...existing, ...incoming].forEach((item) => {
    const email = cleanEmail(item?.email || item);
    if (!email || map.has(email)) return;
    map.set(email, { email, label: item?.label || (map.size ? `Email ${map.size + 1}` : "Primary"), primary: map.size === 0 });
  });
  return Array.from(map.values()).map((item, index) => ({ ...item, primary: index === 0 }));
}

function applyTemplate(template, lead) {
  const primaryEmail = lead.emails?.find((item) => item.primary)?.email || lead.emails?.[0]?.email || "";
  const values = {
    companyName: lead.companyName || "",
    contactName: lead.contactName || "there",
    category: lead.category || "",
    city: lead.city || "",
    postcode: lead.postcode || "",
    primaryEmail
  };
  return String(template || "").replace(/\{\{\s*(companyName|contactName|category|city|postcode|primaryEmail)\s*\}\}/gi, (_, key) => values[key] || "");
}

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);
    const skip = (page - 1) * limit;
    const filter = {};

    if (req.query.search) {
      const regex = new RegExp(escapeRegex(req.query.search), "i");
      filter.$or = [
        { companyName: regex },
        { contactName: regex },
        { "emails.email": regex },
        { phone: regex },
        { postcode: regex },
        { city: regex },
        { website: regex },
        { notes: regex }
      ];
    }
    if (req.query.category) filter.category = req.query.category;
    if (req.query.status) filter.status = req.query.status;
    if (req.query.service) filter.serviceInterests = new RegExp(escapeRegex(req.query.service), "i");
    if (req.query.postcode) filter.postcodePrefix = new RegExp(`^${escapeRegex(String(req.query.postcode).replace(/\s+/g, ""))}`, "i");

    const [items, total] = await Promise.all([
      BusinessLead.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      BusinessLead.countDocuments(filter)
    ]);

    res.json({ items, total, page, pages: Math.ceil(total / limit) || 1, limit });
  } catch (error) {
    next(error);
  }
});

router.get("/stats/summary", async (req, res, next) => {
  try {
    const [total, careHomes, childrenHomes, websiteLeads, seoLeads, contacted, converted] = await Promise.all([
      BusinessLead.countDocuments(),
      BusinessLead.countDocuments({ category: "Care Home" }),
      BusinessLead.countDocuments({ category: "Children Home" }),
      BusinessLead.countDocuments({ category: "Website Lead" }),
      BusinessLead.countDocuments({ category: "SEO Lead" }),
      BusinessLead.countDocuments({ status: "Contacted" }),
      BusinessLead.countDocuments({ status: "Converted" })
    ]);
    res.json({ total, careHomes, childrenHomes, websiteLeads, seoLeads, contacted, converted });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    requireFields(req.body, ["companyName"]);
    const lead = await BusinessLead.create(sanitizeLead(req.body));
    res.status(201).json(lead);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const lead = await BusinessLead.findByIdAndUpdate(req.params.id, sanitizeLead(req.body), { new: true, runValidators: true });
    if (!lead) return res.status(404).json({ message: "Business lead not found" });
    res.json(lead);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const lead = await BusinessLead.findByIdAndDelete(req.params.id);
    if (!lead) return res.status(404).json({ message: "Business lead not found" });
    res.json({ message: "Business lead deleted" });
  } catch (error) {
    next(error);
  }
});

router.post("/import", uploadBusinessLeadCsv.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "CSV file is required" });
    const defaultCategory = req.body.category || "Care Home";
    const rows = parseCsv(req.file.buffer);
    const importReport = validateBusinessLeadImportRows(rows);
    if (!rows.length) {
      return res.status(400).json({
        message: "No importable rows were found in this CSV file.",
        importReport
      });
    }
    if (importReport.issueCount) {
      return res.status(422).json({
        message: `${importReport.issueCount} issue${importReport.issueCount === 1 ? "" : "s"} found in this CSV. Please correct the highlighted rows and upload again.`,
        importReport
      });
    }

    const leadsByKey = new Map();
    let skipped = 0;
    let duplicatesMerged = 0;

    for (const row of rows) {
      if (!row.companyName && !row.contactName && !row.phone && !row.postcode && !row.city && !row.website && !row.serviceInterests && !row.emails && !row.email1) {
        skipped += 1;
        continue;
      }
      const data = sanitizeLead({ category: defaultCategory, source: "CSV Import", ...row }, { rowNumber: row.__rowNumber });
      if (!data.companyName) data.companyName = data.emails?.[0]?.email || data.phone || "Unnamed company";
      data.companyKey = normalizeCompany(data.companyName);
      const leadKey = `${data.companyKey}|${data.postcodePrefix || ""}`;

      if (leadsByKey.has(leadKey)) {
        duplicatesMerged += 1;
        const existing = leadsByKey.get(leadKey);
        existing.data = {
          ...existing.data,
          ...Object.fromEntries(Object.entries(data).filter(([, value]) => value !== undefined && value !== "")),
          serviceInterests: Array.from(new Set([...(existing.data.serviceInterests || []), ...(data.serviceInterests || [])])),
          emails: mergeEmailLists(existing.data.emails, data.emails)
        };
        continue;
      }
      leadsByKey.set(leadKey, { data });
    }

    let created = 0;
    let updated = 0;
    for (const { data } of leadsByKey.values()) {
      const existingFilter = data.postcodePrefix
        ? { companyKey: data.companyKey, postcodePrefix: data.postcodePrefix }
        : { companyKey: data.companyKey };
      const existing = await BusinessLead.findOne(existingFilter);
      if (existing) {
        existing.set({
          ...data,
          emails: mergeEmailLists(existing.emails, data.emails),
          serviceInterests: Array.from(new Set([...(existing.serviceInterests || []), ...(data.serviceInterests || [])]))
        });
        await existing.save();
        updated += 1;
      } else {
        await BusinessLead.create(data);
        created += 1;
      }
    }

    res.status(201).json({
      rowsRead: rows.length,
      uniqueLeads: leadsByKey.size,
      created,
      updated,
      duplicatesMerged,
      skipped,
      importReport: { ...importReport, duplicatesMerged },
      message: "Business lead import completed"
    });
  } catch (error) {
    next(error);
  }
});

router.post("/outreach", async (req, res, next) => {
  try {
    const leadIds = Array.isArray(req.body.leadIds) ? req.body.leadIds.slice(0, 100) : [];
    requireFields(req.body, ["subject", "message"]);
    if (!leadIds.length) return res.status(400).json({ message: "Select at least one business lead" });
    const allowedSenders = allowedSenderAccountsForUser(req.user);
    const fromEmail = String(req.body.fromEmail || allowedSenders[0]?.address || "").toLowerCase().trim();
    if (!fromEmail) return res.status(400).json({ message: "No sender mailbox is assigned to your account" });
    if (fromEmail && !canUseSender(req.user, fromEmail)) {
      return res.status(403).json({ message: "You are not allowed to send from this mailbox" });
    }

    const leads = await BusinessLead.find({ _id: { $in: leadIds }, status: { $ne: "Do Not Contact" } });
    let sent = 0;
    const failed = [];

    for (const lead of leads) {
      const subject = applyTemplate(req.body.subject, lead);
      const message = applyTemplate(req.body.message, lead);
      const result = await sendBusinessLeadOutreachEmail({ lead, subject, message, fromEmail });
      const sentTo = lead.emails.map((item) => item.email).filter(Boolean);
      await EmailLog.create({
        fromEmail: result.fromEmail || fromEmail,
        fromName: "Innovex Resource Group Limited",
        to: sentTo,
        subject,
        message,
        targetType: "BusinessLead",
        targetId: lead._id,
        status: result.sent ? "Sent" : "Failed",
        error: result.sent ? "" : result.reason || "Business lead outreach email was not sent",
        sentBy: {
          user: req.user?._id,
          name: req.user?.name || "Innovex Admin",
          email: req.user?.email || "",
          role: req.user?.role || ""
        }
      });
      if (result.sent) {
        lead.status = "Contacted";
        lead.lastContactedAt = new Date();
        lead.outreachHistory.push({ service: req.body.service || "", subject, message, sentTo });
        await lead.save();
        sent += 1;
      } else {
        failed.push({ id: lead._id, companyName: lead.companyName, reason: result.reason });
      }
    }

    res.json({ sent, failed, message: `Sent ${sent} business lead email${sent === 1 ? "" : "s"}.` });
  } catch (error) {
    next(error);
  }
});

router.patch("/bulk-status", async (req, res, next) => {
  try {
    const leadIds = Array.isArray(req.body.leadIds) ? req.body.leadIds.slice(0, 500) : [];
    requireFields(req.body, ["status"]);
    if (!leadIds.length) return res.status(400).json({ message: "Select at least one business lead" });

    const update = { status: req.body.status };
    if (req.body.status === "Contacted") update.lastContactedAt = new Date();

    const result = await BusinessLead.updateMany({ _id: { $in: leadIds } }, { $set: update });
    const updated = result.modifiedCount || result.matchedCount || 0;
    res.json({ updated, message: `Updated ${updated} business lead${updated === 1 ? "" : "s"}.` });
  } catch (error) {
    next(error);
  }
});

export default router;
