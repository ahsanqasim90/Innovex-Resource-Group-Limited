import express from "express";
import Candidate from "../models/Candidate.js";
import Job from "../models/Job.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { uploadCandidateCsv } from "../middleware/upload.js";
import { sendCandidateOutreachEmail } from "../services/emailService.js";
import { pick, requireFields, validateEmail } from "../utils.js";

const router = express.Router();
router.use(protect, requirePermission("talentPool.view"));

const candidateFields = [
  "name",
  "email",
  "phone",
  "postcode",
  "city",
  "desiredRole",
  "experience",
  "visaStatus",
  "availability",
  "shiftPreference",
  "payExpectation",
  "latitude",
  "longitude",
  "status",
  "source",
  "tags",
  "notes"
];

const headerMap = {
  name: "name",
  fullname: "name",
  candidatename: "name",
  email: "email",
  emailaddress: "email",
  phone: "phone",
  phonenumber: "phone",
  number: "phone",
  contactnumber: "phone",
  mobile: "phone",
  mobilenumber: "phone",
  postcode: "postcode",
  post_code: "postcode",
  postalcode: "postcode",
  city: "city",
  town: "city",
  location: "city",
  desiredrole: "desiredRole",
  role: "desiredRole",
  jobtitle: "desiredRole",
  position: "desiredRole",
  experience: "experience",
  visastatus: "visaStatus",
  visastatu: "visaStatus",
  visastat: "visaStatus",
  visa: "visaStatus",
  availability: "availability",
  availabi: "availability",
  available: "availability",
  availablefrom: "availability",
  shift: "shiftPreference",
  shiftpref: "shiftPreference",
  shiftpreference: "shiftPreference",
  pay: "payExpectation",
  payexpec: "payExpectation",
  payexpectation: "payExpectation",
  expectedpay: "payExpectation",
  latitude: "latitude",
  lat: "latitude",
  longitude: "longitude",
  lng: "longitude",
  lon: "longitude",
  status: "status",
  source: "source",
  tags: "tags",
  notes: "notes"
};

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanPostcode(value = "") {
  return String(value).toUpperCase().replace(/\s+/g, " ").trim();
}

function postcodePrefix(value = "") {
  return cleanPostcode(value).replace(/\s+/g, "").slice(0, 4);
}

function normalizeHeader(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizeRole(value = "") {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function cleanEmail(value = "") {
  return String(value).replace(/\s+/g, "").trim().toLowerCase();
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

function sanitizeCandidate(input, options = {}) {
  const data = pick(input, candidateFields);
  if (data.email) data.email = cleanEmail(data.email);
  if (data.email) {
    try {
      validateEmail(data.email);
    } catch (error) {
      if (options.rowNumber) {
        error.message = `Row ${options.rowNumber}: A valid email address is required (${data.email})`;
      }
      throw error;
    }
  }
  if (data.postcode) {
    data.postcode = cleanPostcode(data.postcode);
    data.postcodePrefix = postcodePrefix(data.postcode);
  }
  if (typeof data.tags === "string") data.tags = data.tags.split(/[;,]/).map((tag) => tag.trim()).filter(Boolean);
  if (data.latitude !== undefined && data.latitude !== "") data.latitude = Number(data.latitude);
  if (data.longitude !== undefined && data.longitude !== "") data.longitude = Number(data.longitude);
  return data;
}

function haversineMiles(aLat, aLng, bLat, bLng) {
  if ([aLat, aLng, bLat, bLng].some((value) => typeof value !== "number" || Number.isNaN(value))) return null;
  const toRad = (value) => (value * Math.PI) / 180;
  const earthMiles = 3958.8;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const lat1 = toRad(aLat);
  const lat2 = toRad(bLat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthMiles * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function applyTemplate(template, candidate, job = {}) {
  const values = {
    name: candidate.name || "there",
    jobTitle: job.title || job.jobTitle || "",
    location: job.location || "",
    salary: job.salary || "",
    company: job.company || "Innovex Resource Group Limited",
    role: candidate.desiredRole || ""
  };
  return String(template || "").replace(/\{\{\s*(name|jobTitle|location|salary|company|role)\s*\}\}/gi, (_, key) => values[key] || "");
}

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);
    const skip = (page - 1) * limit;
    const filter = {};

    if (req.query.search) filter.$text = { $search: req.query.search };
    if (req.query.role) filter.desiredRole = new RegExp(escapeRegex(req.query.role), "i");
    if (req.query.postcode) filter.postcodePrefix = new RegExp(`^${escapeRegex(postcodePrefix(req.query.postcode))}`, "i");
    if (req.query.status) filter.status = req.query.status;
    if (req.query.visaStatus) filter.visaStatus = new RegExp(escapeRegex(req.query.visaStatus), "i");
    if (req.query.availability) filter.availability = new RegExp(escapeRegex(req.query.availability), "i");

    const [items, total] = await Promise.all([
      Candidate.find(filter).select("-outreachHistory.message").sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      Candidate.countDocuments(filter)
    ]);

    res.json({ items, total, page, pages: Math.ceil(total / limit), limit });
  } catch (error) {
    next(error);
  }
});

router.get("/stats/summary", async (req, res, next) => {
  try {
    const [total, available, contacted, interested, shortlisted, placed] = await Promise.all([
      Candidate.countDocuments(),
      Candidate.countDocuments({ status: "Available" }),
      Candidate.countDocuments({ status: "Contacted" }),
      Candidate.countDocuments({ status: "Interested" }),
      Candidate.countDocuments({ status: "Shortlisted" }),
      Candidate.countDocuments({ status: "Placed" })
    ]);
    res.json({ total, available, contacted, interested, shortlisted, placed });
  } catch (error) {
    next(error);
  }
});

router.get("/match", async (req, res, next) => {
  try {
    const job = req.query.jobId ? await Job.findById(req.query.jobId).lean() : null;
    const role = req.query.role || job?.title || "";
    const location = req.query.location || job?.location || "";
    const prefix = postcodePrefix(req.query.postcode || location);
    const lat = req.query.latitude ? Number(req.query.latitude) : null;
    const lng = req.query.longitude ? Number(req.query.longitude) : null;
    const radius = Number(req.query.radius || 30);

    const searchTerms = normalizeRole(role).split(/\s+/).filter((term) => term.length >= 3).slice(0, 8);
    const filter = {
      status: { $ne: "Do Not Contact" },
      $or: [
        ...(role ? [{ desiredRole: new RegExp(searchTerms.map(escapeRegex).join("|") || escapeRegex(role), "i") }] : []),
        ...(prefix ? [{ postcodePrefix: new RegExp(`^${escapeRegex(prefix.slice(0, 2))}`, "i") }] : [])
      ]
    };
    if (!filter.$or.length) delete filter.$or;

    const candidates = await Candidate.find(filter)
      .select("-outreachHistory.message")
      .sort({ updatedAt: -1 })
      .limit(500)
      .lean();

    const scored = candidates
      .map((candidate) => {
        const candidateRole = normalizeRole(candidate.desiredRole);
        const roleScore = searchTerms.reduce((score, term) => score + (candidateRole.includes(term) ? 12 : 0), 0);
        const prefixScore = prefix && candidate.postcodePrefix?.startsWith(prefix.slice(0, 2)) ? 24 : 0;
        const exactPrefixScore = prefix && candidate.postcodePrefix?.startsWith(prefix) ? 18 : 0;
        const activeScore = ["Available", "Interested", "Shortlisted"].includes(candidate.status) ? 16 : 0;
        const distance = haversineMiles(lat, lng, candidate.latitude, candidate.longitude);
        const distanceScore = distance === null ? 0 : Math.max(0, 35 - distance);
        return {
          ...candidate,
          distanceMiles: distance === null ? null : Number(distance.toFixed(1)),
          matchScore: Math.min(100, Math.round(20 + roleScore + prefixScore + exactPrefixScore + activeScore + distanceScore))
        };
      })
      .filter((candidate) => candidate.distanceMiles === null || candidate.distanceMiles <= radius)
      .sort((a, b) => b.matchScore - a.matchScore || (a.distanceMiles || 999) - (b.distanceMiles || 999))
      .slice(0, Number(req.query.limit || 50));

    res.json({ job, items: scored, count: scored.length });
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    requireFields(req.body, ["name"]);
    const candidate = await Candidate.create(sanitizeCandidate(req.body));
    res.status(201).json(candidate);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const candidate = await Candidate.findByIdAndUpdate(req.params.id, sanitizeCandidate(req.body), { new: true, runValidators: true });
    if (!candidate) return res.status(404).json({ message: "Candidate not found" });
    res.json(candidate);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const candidate = await Candidate.findByIdAndDelete(req.params.id);
    if (!candidate) return res.status(404).json({ message: "Candidate not found" });
    res.json({ message: "Candidate deleted" });
  } catch (error) {
    next(error);
  }
});

router.post("/import", uploadCandidateCsv.single("file"), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: "CSV file is required" });
    const rows = parseCsv(req.file.buffer);
    const candidatesByKey = new Map();
    let skipped = 0;
    let duplicatesMerged = 0;

    for (const row of rows) {
      if (!row.name && !row.email && !row.phone) {
        skipped += 1;
        continue;
      }
      const data = sanitizeCandidate({ source: "CSV Import", ...row }, { rowNumber: row.__rowNumber });
      if (!data.name) data.name = data.email || data.phone || "Unnamed candidate";
      const identifier = data.email ? { email: data.email } : data.phone ? { phone: data.phone } : null;
      if (!identifier) {
        skipped += 1;
        continue;
      }
      const candidateKey = data.email ? `email:${data.email}` : `phone:${data.phone}`;
      if (candidatesByKey.has(candidateKey)) duplicatesMerged += 1;
      candidatesByKey.set(candidateKey, { identifier, data });
    }

    const operations = Array.from(candidatesByKey.values()).map(({ identifier, data }) => ({
      updateOne: {
        filter: identifier,
        update: { $set: data, $setOnInsert: { createdAt: new Date() } },
        upsert: true
      }
    }));

    let result = { upsertedCount: 0, modifiedCount: 0, matchedCount: 0 };
    for (let index = 0; index < operations.length; index += 1000) {
      const batch = operations.slice(index, index + 1000);
      const batchResult = await Candidate.bulkWrite(batch, { ordered: false });
      result.upsertedCount += batchResult.upsertedCount || 0;
      result.modifiedCount += batchResult.modifiedCount || 0;
      result.matchedCount += batchResult.matchedCount || 0;
    }

    res.status(201).json({
      rowsRead: rows.length,
      imported: operations.length,
      uniqueCandidates: operations.length,
      created: result.upsertedCount,
      updated: result.modifiedCount,
      duplicatesMerged,
      skipped,
      message: "Candidate import completed"
    });
  } catch (error) {
    next(error);
  }
});

router.post("/outreach", async (req, res, next) => {
  try {
    const candidateIds = Array.isArray(req.body.candidateIds) ? req.body.candidateIds.slice(0, 100) : [];
    requireFields(req.body, ["subject", "message"]);
    if (!candidateIds.length) return res.status(400).json({ message: "Select at least one candidate" });

    const job = req.body.jobId ? await Job.findById(req.body.jobId).lean() : null;
    const candidates = await Candidate.find({ _id: { $in: candidateIds }, email: { $ne: "" }, status: { $ne: "Do Not Contact" } });
    let sent = 0;
    const failed = [];

    for (const candidate of candidates) {
      const subject = applyTemplate(req.body.subject, candidate, job || req.body);
      const message = applyTemplate(req.body.message, candidate, job || req.body);
      try {
        const result = await sendCandidateOutreachEmail({ candidate, subject, message });
        if (result.sent) sent += 1;
        else failed.push({ id: candidate._id, reason: result.reason });
        candidate.status = candidate.status === "Available" ? "Contacted" : candidate.status;
        candidate.lastContactedAt = new Date();
        candidate.outreachHistory.unshift({
          job: job?._id,
          jobTitle: job?.title || req.body.jobTitle,
          subject,
          message,
          status: "Emailed"
        });
        candidate.outreachHistory = candidate.outreachHistory.slice(0, 20);
        await candidate.save();
      } catch (error) {
        failed.push({ id: candidate._id, reason: error.message });
      }
    }

    res.json({ sent, failed, message: sent ? `Sent ${sent} personalised emails.` : "No emails were sent." });
  } catch (error) {
    next(error);
  }
});

router.patch("/bulk-status", async (req, res, next) => {
  try {
    const candidateIds = Array.isArray(req.body.candidateIds) ? req.body.candidateIds.slice(0, 500) : [];
    requireFields(req.body, ["status"]);
    if (!candidateIds.length) return res.status(400).json({ message: "Select at least one candidate" });

    const update = { status: req.body.status };
    if (req.body.status === "Contacted") update.lastContactedAt = new Date();

    const result = await Candidate.updateMany({ _id: { $in: candidateIds } }, { $set: update });
    const updated = result.modifiedCount || result.matchedCount || 0;
    res.json({ updated, message: `Updated ${updated} candidate${updated === 1 ? "" : "s"}.` });
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const candidate = await Candidate.findById(req.params.id).lean();
    if (!candidate) return res.status(404).json({ message: "Candidate not found" });
    res.json(candidate);
  } catch (error) {
    next(error);
  }
});

export default router;
