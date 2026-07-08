import express from "express";
import Candidate from "../models/Candidate.js";
import EmailLog from "../models/EmailLog.js";
import Job from "../models/Job.js";
import { allowedSenderAccountsForUser, canUseSender } from "../config/emailAccounts.js";
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

const validCandidateStatuses = new Set([
  "Available",
  "Contacted",
  "Interested",
  "Not Interested",
  "Shortlisted",
  "Submitted",
  "Placed",
  "Do Not Contact"
]);

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
  desiredr: "desiredRole",
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

function postcodePrefixes(value = "") {
  return [...new Set(
    String(value)
      .split(/[,;\n]+/)
      .map((item) => postcodePrefix(item))
      .filter((item) => item.length >= 2)
  )].slice(0, 20);
}

function postcodeConditions(value = "") {
  const prefixes = postcodePrefixes(value);
  return prefixes.flatMap((prefix) => {
    const expression = new RegExp(`^\\s*${escapeRegex(prefix)}`, "i");
    return [{ postcodePrefix: expression }, { postcode: expression }, { city: expression }];
  });
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

function visibleRowValue(row, key) {
  const value = row?.[key];
  return value === undefined || value === null || value === "" ? "-" : String(value).slice(0, 120);
}

function importIssue(row, field, message, value) {
  return {
    row: row.__rowNumber || "-",
    field,
    message,
    value: value === undefined || value === null || value === "" ? "-" : String(value).slice(0, 120)
  };
}

function validateCandidateImportRows(rows) {
  const issues = [];
  const warnings = [];
  const seenKeys = new Map();
  let emptyRows = 0;
  let importableRows = 0;
  let issueCount = 0;
  let warningCount = 0;

  rows.forEach((row) => {
    const hasMainData = Boolean(row.name || row.email || row.phone || row.desiredRole || row.postcode);
    if (!hasMainData) {
      emptyRows += 1;
      return;
    }

    importableRows += 1;
    const email = cleanEmail(row.email);
    const phone = String(row.phone || "").trim();

    if (!email && !phone) {
      issueCount += 1;
      if (issues.length < 250) issues.push(importIssue(row, "Email / phone", "Add either a valid email address or a phone number so this candidate can be saved.", `${visibleRowValue(row, "email")} / ${visibleRowValue(row, "phone")}`));
    }

    if (email) {
      try {
        validateEmail(email);
      } catch {
        issueCount += 1;
        if (issues.length < 250) issues.push(importIssue(row, "Email", "Email address format is not valid.", row.email));
      }
    }

    if (row.status && !validCandidateStatuses.has(String(row.status).trim())) {
      issueCount += 1;
      if (issues.length < 250) issues.push(importIssue(row, "Status", `Use one of: ${Array.from(validCandidateStatuses).join(", ")}.`, row.status));
    }

    const key = email ? `email:${email}` : phone ? `phone:${phone}` : "";
    if (key) {
      if (seenKeys.has(key)) {
        warningCount += 1;
        if (warnings.length < 250) warnings.push(importIssue(row, email ? "Email" : "Phone", `Duplicate inside this CSV. It will be merged with row ${seenKeys.get(key)}.`, email || phone));
      } else {
        seenKeys.set(key, row.__rowNumber || "-");
      }
    }
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

function selectedRoles(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed)
      ? parsed.map((role) => String(role || "").trim()).filter(Boolean).slice(0, 100)
      : [];
  } catch {
    return [];
  }
}

async function geocodePostcode(value = "") {
  const postcode = String(value).split(/[,;\n]+/)[0]?.trim();
  if (!postcode || postcode.replace(/\s+/g, "").length < 5) return null;
  try {
    const response = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`);
    if (!response.ok) return null;
    const data = await response.json();
    if (!data?.result?.latitude || !data?.result?.longitude) return null;
    return {
      postcode: data.result.postcode,
      latitude: Number(data.result.latitude),
      longitude: Number(data.result.longitude)
    };
  } catch {
    return null;
  }
}

function apiDistanceToMiles(value) {
  const distance = Number(value || 0);
  if (!Number.isFinite(distance)) return 0;
  return distance > 1000 ? distance / 1609.344 : distance / 1.609344;
}

function outwardCode(value = "") {
  const compact = String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!compact) return "";
  return compact.length > 3 ? compact.slice(0, -3) : compact;
}

async function nearbyOutcodes(value = "", miles = 20) {
  const outcode = outwardCode(String(value).split(/[,;\n]+/)[0]);
  if (!outcode) return [];
  try {
    const radiusMeters = Math.round(Number(miles || 20) * 1609.344);
    const response = await fetch(`https://api.postcodes.io/outcodes/${encodeURIComponent(outcode)}/nearest?limit=100&radius=${radiusMeters}`);
    if (!response.ok) return [outcode];
    const data = await response.json();
    const matches = Array.isArray(data?.result) ? data.result : [];
    const filtered = matches
      .map((item) => ({ ...item, distanceMiles: apiDistanceToMiles(item?.distance) }))
      .filter((item) => item?.outcode && (item.distance === undefined || item.distanceMiles <= miles))
      .map((item) => ({ outcode: String(item.outcode).toUpperCase(), distance: Number(item.distanceMiles || 0) }));
    return [{ outcode, distance: 0 }, ...filtered]
      .filter((item, index, array) => array.findIndex((match) => match.outcode === item.outcode) === index)
      .slice(0, 120);
  } catch {
    return [outcode].map((code) => ({ outcode: code, distance: 0 }));
  }
}

function outcodeConditions(outcodes = []) {
  return outcodes.map((item) => ({ postcodePrefix: new RegExp(`^${escapeRegex(item.outcode)}`, "i") }));
}

function areaFallbackOutcode(value = "") {
  const outcode = outwardCode(value);
  const match = outcode.match(/^[A-Z]+/);
  return match?.[0] || "";
}

const nearbyPostcodeAreas = {
  SO: ["SO", "PO", "BH", "SP", "RG", "GU"],
  PO: ["PO", "SO", "GU", "BN", "RH"],
  BH: ["BH", "SO", "SP", "DT"],
  GU: ["GU", "SO", "PO", "RG", "SL", "KT", "RH"],
  RG: ["RG", "SO", "GU", "SL", "OX", "SP"],
  FY: ["FY", "PR", "LA", "BB", "L", "WN", "BL"],
  PR: ["PR", "FY", "BB", "L", "WN", "BL", "LA"],
  L: ["L", "PR", "WN", "CH", "WA"],
  M: ["M", "SK", "OL", "BL", "WN", "WA"],
  B: ["B", "CV", "DY", "WS", "WV", "WR"],
  LE: ["LE", "CV", "NN", "DE", "NG"],
  NN: ["NN", "LE", "MK", "CV", "OX"],
  PE: ["PE", "CB", "NN", "LN"],
  CB: ["CB", "PE", "SG", "MK"],
  MK: ["MK", "NN", "LU", "OX", "SG"],
  LU: ["LU", "MK", "AL", "HP", "SG"],
  AL: ["AL", "LU", "SG", "EN", "WD"],
  WD: ["WD", "HA", "UB", "AL", "HP"],
  HA: ["HA", "UB", "WD", "NW"],
  UB: ["UB", "HA", "SL", "TW", "WD"],
  SL: ["SL", "UB", "RG", "GU", "TW", "HP"],
  TW: ["TW", "UB", "SL", "KT", "SW"],
  KT: ["KT", "TW", "GU", "RH", "SM", "SW"],
  RH: ["RH", "GU", "KT", "BN", "CR"],
  BN: ["BN", "RH", "PO", "TN"],
  TN: ["TN", "BN", "ME", "RH"],
  ME: ["ME", "TN", "DA", "CT"],
  CT: ["CT", "ME", "TN"],
  DA: ["DA", "ME", "BR", "SE"],
  BR: ["BR", "DA", "CR", "SE"],
  CR: ["CR", "BR", "RH", "SM", "SE"],
  SM: ["SM", "CR", "KT", "SW"],
  SW: ["SW", "SM", "KT", "TW", "SE"],
  SE: ["SE", "BR", "CR", "DA", "SW"],
  E: ["E", "IG", "RM", "N"],
  N: ["N", "EN", "E", "NW"],
  NW: ["NW", "HA", "N", "W"],
  W: ["W", "NW", "SW", "UB"],
  IG: ["IG", "E", "RM", "CM"],
  RM: ["RM", "IG", "E", "CM", "SS"],
  CM: ["CM", "IG", "RM", "SS", "CO"],
  SS: ["SS", "RM", "CM", "CO"],
  CO: ["CO", "CM", "SS", "IP"],
  IP: ["IP", "CO", "NR", "CB"],
  NR: ["NR", "IP", "PE"],
  OX: ["OX", "RG", "MK", "NN", "SN"],
  SN: ["SN", "OX", "RG", "GL", "BS"],
  BS: ["BS", "SN", "GL", "BA", "NP"],
  GL: ["GL", "BS", "SN", "WR", "HR"],
  WR: ["WR", "GL", "B", "HR"],
  HR: ["HR", "WR", "GL", "LD", "NP"],
  NP: ["NP", "CF", "BS", "HR"],
  CF: ["CF", "NP", "SA", "BS"],
  SA: ["SA", "CF", "LD"],
  DT: ["DT", "BH", "TA", "EX"],
  TA: ["TA", "DT", "EX", "BS"],
  EX: ["EX", "TA", "TQ", "PL"],
  TQ: ["TQ", "EX", "PL"],
  PL: ["PL", "EX", "TQ", "TR"],
  TR: ["TR", "PL"]
};

function areaFallbackOutcodes(value = "", miles = 20) {
  const area = areaFallbackOutcode(value);
  if (!area) return [];
  if (Number(miles || 0) < 20) return [area];
  return nearbyPostcodeAreas[area] || [area];
}

function areaConditions(areas = []) {
  return areas.map((area) => ({ postcodePrefix: new RegExp(`^${escapeRegex(area)}`, "i") }));
}

function radiusBounds(latitude, longitude, miles) {
  const latDelta = miles / 69;
  const lngDelta = miles / (69 * Math.cos((latitude * Math.PI) / 180) || 1);
  return {
    latitude: { $gte: latitude - latDelta, $lte: latitude + latDelta },
    longitude: { $gte: longitude - lngDelta, $lte: longitude + lngDelta }
  };
}

router.get("/", async (req, res, next) => {
  try {
    const page = Math.max(Number(req.query.page || 1), 1);
    const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 100);
    const skip = (page - 1) * limit;
    const filter = {};
    const radiusMiles = Math.min(Math.max(Number(req.query.radiusMiles || 0), 0), 100);
    let radiusOrigin = null;
    let radiusMeta = null;
    let radiusOutcodes = [];
    let radiusOutcodeDistances = new Map();
    let radiusAreaFallback = [];

    if (req.query.search) filter.$text = { $search: req.query.search };
    const roles = selectedRoles(req.query.roles);
    if (roles.length) {
      filter.desiredRole = { $in: roles.map((role) => new RegExp(`^\\s*${escapeRegex(role)}\\s*$`, "i")) };
    } else if (req.query.role) {
      filter.desiredRole = new RegExp(escapeRegex(req.query.role), "i");
    }
    if (req.query.postcode && radiusMiles > 0) {
      radiusOrigin = await geocodePostcode(req.query.postcode);
      if (radiusOrigin) {
        radiusOutcodes = await nearbyOutcodes(req.query.postcode, radiusMiles);
        radiusOutcodeDistances = new Map(radiusOutcodes.map((item) => [item.outcode, item.distance]));
        radiusAreaFallback = areaFallbackOutcodes(req.query.postcode, radiusMiles);
        const geoBounds = radiusBounds(radiusOrigin.latitude, radiusOrigin.longitude, radiusMiles);
        filter.$or = [
          ...(filter.$or || []),
          { latitude: geoBounds.latitude, longitude: geoBounds.longitude },
          ...outcodeConditions(radiusOutcodes),
          ...areaConditions(radiusAreaFallback)
        ];
        radiusMeta = {
          enabled: true,
          postcode: radiusOrigin.postcode,
          radiusMiles,
          outcodeMatches: radiusOutcodes.length,
          areaFallback: radiusAreaFallback.join(", ")
        };
      }
    }
    if (req.query.postcode && !radiusOrigin) {
      const locationConditions = postcodeConditions(req.query.postcode);
      if (locationConditions.length) filter.$or = locationConditions;
      if (radiusMiles > 0) {
        radiusMeta = {
          enabled: false,
          radiusMiles,
          warning: "Enter a full postcode for true mileage radius. Prefix matching has been applied instead."
        };
      }
    }
    if (req.query.status) filter.status = req.query.status;
    if (req.query.visaStatus) filter.visaStatus = new RegExp(escapeRegex(req.query.visaStatus), "i");
    if (req.query.availability) filter.availability = new RegExp(escapeRegex(req.query.availability), "i");

    if (radiusOrigin) {
      const candidates = await Candidate.find(filter).select("-outreachHistory.message").sort({ updatedAt: -1 }).limit(5000).lean();
      const scored = candidates
        .map((candidate) => {
          const exactDistance = haversineMiles(radiusOrigin.latitude, radiusOrigin.longitude, candidate.latitude, candidate.longitude);
          const candidateOutcode = outwardCode(candidate.postcode || candidate.postcodePrefix);
          const candidateArea = areaFallbackOutcode(candidateOutcode);
          const fallbackDistance = radiusOutcodeDistances.get(candidateOutcode);
          const areaFallbackDistance = radiusAreaFallback.includes(candidateArea) ? radiusMiles : undefined;
          const distance = exactDistance ?? fallbackDistance;
          const finalDistance = distance ?? areaFallbackDistance;
          return {
            ...candidate,
            distanceMiles: finalDistance === undefined || finalDistance === null ? null : Number(finalDistance.toFixed(1)),
            distanceSource: exactDistance !== null ? "exact" : fallbackDistance !== undefined ? "postcode area" : areaFallbackDistance !== undefined ? "area fallback" : null
          };
        })
        .filter((candidate) => candidate.distanceMiles !== null && candidate.distanceMiles <= radiusMiles)
        .sort((a, b) => a.distanceMiles - b.distanceMiles || new Date(b.updatedAt) - new Date(a.updatedAt));
      const items = scored.slice(skip, skip + limit);
      return res.json({
        items,
        total: scored.length,
        page,
        pages: Math.ceil(scored.length / limit) || 1,
        limit,
        radiusMeta: { ...radiusMeta, matchedCandidates: scored.length, matchedOutcodes: radiusOutcodes.map((item) => item.outcode).slice(0, 25) }
      });
    }

    const [items, total] = await Promise.all([
      Candidate.find(filter).select("-outreachHistory.message").sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(),
      Candidate.countDocuments(filter)
    ]);

    res.json({ items, total, page, pages: Math.ceil(total / limit), limit, radiusMeta });
  } catch (error) {
    next(error);
  }
});

router.get("/role-options", async (req, res, next) => {
  try {
    const prefixes = postcodePrefixes(req.query.postcode);
    if (!prefixes.length) return res.json({ postcodes: [], roles: [], total: 0 });
    const radiusMiles = Math.min(Math.max(Number(req.query.radiusMiles || 0), 0), 100);
    let matchConditions = postcodeConditions(req.query.postcode);
    let radiusMeta = null;

    if (radiusMiles > 0) {
      const origin = await geocodePostcode(req.query.postcode);
      if (origin) {
        const radiusOutcodes = await nearbyOutcodes(req.query.postcode, radiusMiles);
        const areaFallback = areaFallbackOutcodes(req.query.postcode, radiusMiles);
        matchConditions = [
          ...outcodeConditions(radiusOutcodes),
          ...areaConditions(areaFallback)
        ];
        radiusMeta = {
          enabled: true,
          postcode: origin.postcode,
          radiusMiles,
          outcodeMatches: radiusOutcodes.length,
          areaFallback: areaFallback.join(", "),
          matchedOutcodes: radiusOutcodes.map((item) => item.outcode).slice(0, 25)
        };
      } else {
        radiusMeta = {
          enabled: false,
          radiusMiles,
          warning: "Enter a full postcode for true mileage radius. Prefix matching has been applied instead."
        };
      }
    }

    const match = {
      $or: matchConditions,
      desiredRole: { $type: "string", $ne: "" }
    };
    if (req.query.status) match.status = req.query.status;
    if (req.query.visaStatus) match.visaStatus = new RegExp(escapeRegex(req.query.visaStatus), "i");
    if (req.query.availability) match.availability = new RegExp(escapeRegex(req.query.availability), "i");

    const roles = await Candidate.aggregate([
      { $match: match },
      {
        $project: {
          role: { $trim: { input: "$desiredRole" } },
          normalizedRole: { $toLower: { $trim: { input: "$desiredRole" } } }
        }
      },
      { $match: { normalizedRole: { $ne: "" } } },
      { $group: { _id: "$normalizedRole", label: { $first: "$role" }, count: { $sum: 1 } } },
      { $sort: { count: -1, label: 1 } },
      { $limit: 100 }
    ]);

    res.json({
      postcode: prefixes.join(", "),
      postcodes: prefixes,
      roles: roles.map(({ _id, label, count }) => ({ key: _id, label, count })),
      total: roles.reduce((sum, role) => sum + role.count, 0),
      radiusMeta
    });
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
    if (!rows.length) {
      return res.status(400).json({
        message: "CSV file has no candidate rows. Keep one header row and at least one data row.",
        importReport: { rowsRead: 0, importableRows: 0, emptyRows: 0, issueCount: 1, warningCount: 0, issues: [{ row: "-", field: "CSV", message: "No candidate data rows found.", value: "-" }], warnings: [] }
      });
    }
    const importReport = validateCandidateImportRows(rows);
    if (importReport.issueCount) {
      return res.status(422).json({
        message: `CSV scan found ${importReport.issueCount} issue${importReport.issueCount === 1 ? "" : "s"}. Fix the listed rows and upload again.`,
        importReport
      });
    }

    const candidatesByKey = new Map();
    let skipped = 0;
    let duplicatesMerged = 0;

    for (const row of rows) {
      if (!row.name && !row.email && !row.phone && !row.desiredRole && !row.postcode) {
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
      importReport: { ...importReport, duplicatesMerged },
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
    const allowedSenders = allowedSenderAccountsForUser(req.user);
    const fromEmail = String(req.body.fromEmail || allowedSenders[0]?.address || "").toLowerCase().trim();
    if (!fromEmail) return res.status(400).json({ message: "No sender mailbox is assigned to your account" });
    if (fromEmail && !canUseSender(req.user, fromEmail)) {
      return res.status(403).json({ message: "You are not allowed to send from this mailbox" });
    }

    const job = req.body.jobId ? await Job.findById(req.body.jobId).lean() : null;
    const candidates = await Candidate.find({ _id: { $in: candidateIds }, email: { $ne: "" }, status: { $ne: "Do Not Contact" } });
    let sent = 0;
    const failed = [];

    for (const candidate of candidates) {
      const subject = applyTemplate(req.body.subject, candidate, job || req.body);
      const message = applyTemplate(req.body.message, candidate, job || req.body);
      try {
        const result = await sendCandidateOutreachEmail({ candidate, subject, message, fromEmail });
        if (result.sent) sent += 1;
        else failed.push({ id: candidate._id, reason: result.reason });
        await EmailLog.create({
          fromEmail: result.fromEmail || fromEmail,
          fromName: "Innovex Resource Group Limited",
          to: [candidate.email].filter(Boolean),
          subject,
          message,
          targetType: "Candidate",
          targetId: candidate._id,
          status: result.sent ? "Sent" : "Failed",
          error: result.sent ? "" : result.reason || "Candidate outreach email was not sent",
          sentBy: {
            user: req.user?._id,
            name: req.user?.name || "Innovex Admin",
            email: req.user?.email || "",
            role: req.user?.role || ""
          }
        });
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
