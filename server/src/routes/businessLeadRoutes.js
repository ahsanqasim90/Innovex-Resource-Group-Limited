import express from "express";
import BusinessLead from "../models/BusinessLead.js";
import { protect } from "../middleware/auth.js";
import { uploadBusinessLeadCsv } from "../middleware/upload.js";
import { sendBusinessLeadOutreachEmail } from "../services/emailService.js";
import { pick, requireFields, validateEmail } from "../utils.js";

const router = express.Router();
router.use(protect);

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

function splitList(value = "") {
  if (Array.isArray(value)) return value.map((item) => String(item || "").trim()).filter(Boolean);
  return String(value || "").split(/[;,|]/).map((item) => item.trim()).filter(Boolean);
}

function parseEmails(input = {}) {
  const values = [];
  if (Array.isArray(input.emails)) {
    input.emails.forEach((item) => values.push(typeof item === "string" ? item : item?.email));
  } else if (input.emails) {
    values.push(...splitList(input.emails));
  }
  ["email", "email1", "email2", "email3", "email4", "email5"].forEach((field) => {
    if (input[field]) values.push(...splitList(input[field]));
  });

  const seen = new Set();
  return values
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
  if (data.postcode) {
    data.postcode = cleanPostcode(data.postcode);
    data.postcodePrefix = postcodePrefix(data.postcode);
  }
  if (data.companyName) data.companyKey = normalizeCompany(data.companyName);
  if (data.emails || input.email || input.email1 || input.email2 || input.email3 || input.email4 || input.email5) {
    data.emails = parseEmails(input);
    const invalidEmails = [
      ...splitList(input.emails),
      ...["email", "email1", "email2", "email3", "email4", "email5"].flatMap((field) => splitList(input[field]))
    ].filter((email) => email && !parseEmails({ emails: email }).length);
    if (invalidEmails.length && options.rowNumber) {
      const error = new Error(`Row ${options.rowNumber}: Invalid email found (${invalidEmails[0]})`);
      error.statusCode = 400;
      throw error;
    }
  }
  if (data.serviceInterests !== undefined) data.serviceInterests = splitList(data.serviceInterests);
  return data;
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
    const leadsByKey = new Map();
    let skipped = 0;
    let duplicatesMerged = 0;

    for (const row of rows) {
      if (!row.companyName && !row.phone && !row.postcode && !row.emails && !row.email1) {
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

    const leads = await BusinessLead.find({ _id: { $in: leadIds }, status: { $ne: "Do Not Contact" } });
    let sent = 0;
    const failed = [];

    for (const lead of leads) {
      const subject = applyTemplate(req.body.subject, lead);
      const message = applyTemplate(req.body.message, lead);
      const result = await sendBusinessLeadOutreachEmail({ lead, subject, message });
      if (result.sent) {
        const sentTo = lead.emails.map((item) => item.email).filter(Boolean);
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

export default router;
