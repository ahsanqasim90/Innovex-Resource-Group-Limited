import Job from "../models/Job.js";
import { analyseJobDescription, rankCandidateForJob } from "./documentIntelligenceService.js";
import { haversineMiles, outwardCode } from "./postcodeIntelligenceService.js";
import { extractPostcode } from "../utils/jobQuality.js";

// Free, rule-based CV-to-vacancy matching. No paid AI service is used:
// text comes from the CV itself, distances come from the free postcodes.io lookup,
// and scoring reuses the explainable vacancy-intelligence engine.

const POSTCODES_API = "https://api.postcodes.io";
const FULL_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2}$/;
const compact = (value) => String(value || "").toUpperCase().replace(/\s+/g, "");

async function lookup(url, options = {}) {
  try {
    const response = await fetch(url, { ...options, signal: AbortSignal.timeout(6000) });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
}

function coordinates(result) {
  const latitude = Number(result?.latitude);
  const longitude = Number(result?.longitude);
  return Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : null;
}

// Returns a Map of compact full postcode or outward code -> { latitude, longitude }.
export async function geocodePostcodes(values = []) {
  const keys = [...new Set(values.map(compact).filter(Boolean))];
  const fullKeys = keys.filter((key) => FULL_POSTCODE.test(key));
  const found = new Map();
  for (let index = 0; index < fullKeys.length; index += 100) {
    const data = await lookup(`${POSTCODES_API}/postcodes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ postcodes: fullKeys.slice(index, index + 100) }) });
    for (const item of data?.result || []) {
      const point = coordinates(item.result);
      if (point) found.set(compact(item.query), point);
    }
  }
  const outcodes = new Set();
  for (const key of keys) {
    if (FULL_POSTCODE.test(key) && found.has(key)) continue;
    const code = outwardCode(key);
    if (code) outcodes.add(code);
  }
  await Promise.all([...outcodes].slice(0, 80).map(async (code) => {
    const data = await lookup(`${POSTCODES_API}/outcodes/${encodeURIComponent(code)}`);
    const point = coordinates(data?.result);
    if (point) found.set(code, point);
  }));
  return found;
}

function pointFor(value, geo) {
  const key = compact(value);
  if (!key) return null;
  return geo.get(key) || geo.get(outwardCode(key)) || null;
}

// A job's dedicated Postcode field is often blank (older records, or created before that
// field existed); fall back to whatever postcode/outward code can be recovered from its
// free-text Location so distance still gets calculated instead of "recruiter review".
function jobPostcode(job) {
  return job.postcode || extractPostcode(job.location);
}

function reasonsFor(match) {
  const reasons = [];
  if (Number.isFinite(match.distanceMiles)) reasons.push(`${match.distanceMiles} miles from the candidate (${match.distanceSource || "postcode"})`);
  else if (match.locationAssessment) reasons.push(match.locationAssessment);
  if (match.matchedSkills?.length) reasons.push(`Skills found in the CV: ${match.matchedSkills.slice(0, 6).join(", ")}`);
  if (match.breakdown?.roleExperience >= 70) reasons.push("Job title and experience line up with the CV");
  if (match.breakdown?.availability >= 80) reasons.push("Shift or availability fits");
  for (const check of match.eligibility?.checks || []) reasons.push(`${check.status === "Fail" ? "Not met" : "Check"}: ${check.label}${check.reason ? ` (${check.reason})` : ""}`);
  if (match.missingSkills?.length) reasons.push(`Not found in the CV: ${match.missingSkills.slice(0, 5).join(", ")}`);
  return reasons;
}

export async function matchCandidateToVacancies(candidateInput, { limit = 15, minimumScore = 0 } = {}) {
  const now = new Date();
  const jobs = await Job.find({
    isActive: { $ne: false },
    vacancyStatus: { $nin: ["Closed", "Filled", "Paused"] },
    $or: [{ closingDate: null }, { closingDate: { $exists: false } }, { closingDate: { $gte: now } }]
  }).select("-sourceDocument.data +clientName").limit(600).lean();

  const geo = await geocodePostcodes([candidateInput.postcode, ...jobs.map((job) => jobPostcode(job))]);
  const candidatePoint = pointFor(candidateInput.postcode, geo);
  const candidate = {
    _id: "manual-match",
    status: "Manual match",
    ...candidateInput,
    postcodePrefix: outwardCode(candidateInput.postcode || ""),
    latitude: candidatePoint?.latitude,
    longitude: candidatePoint?.longitude,
    cv: { ...(candidateInput.cv || {}), indexedAt: now }
  };

  const matches = jobs.map((job) => {
    const prepared = job.intelligence?.analysedAt ? job : { ...job, intelligence: analyseJobDescription(job.description, { title: job.title, location: job.location }) };
    const origin = pointFor(jobPostcode(job), geo);
    const context = { origin, outcodeDistances: new Map(), haversineMiles };
    const ranked = rankCandidateForJob(prepared, candidate, context);
    return {
      vacancy: {
        id: job._id,
        reference: job.reference,
        title: job.title,
        location: job.location,
        postcode: job.postcode,
        salary: job.salary,
        type: job.type,
        shift: job.shift,
        clientName: job.clientName || "",
        openings: job.openings
      },
      matchScore: ranked.matchScore,
      recommendation: ranked.recommendation,
      distanceMiles: ranked.distanceMiles ?? null,
      distanceSource: ranked.distanceSource || null,
      locationAssessment: ranked.locationAssessment,
      breakdown: ranked.breakdown,
      matchedSkills: ranked.matchedSkills,
      missingSkills: ranked.missingSkills,
      eligibility: ranked.eligibility,
      confidence: ranked.confidence,
      dataQualityIssues: ranked.dataQualityIssues,
      evidence: ranked.evidence,
      reasons: reasonsFor(ranked)
    };
  });

  const sorted = matches
    .filter((match) => match.matchScore >= minimumScore)
    .sort((a, b) => b.matchScore - a.matchScore || (a.distanceMiles ?? 9999) - (b.distanceMiles ?? 9999))
    .slice(0, limit);

  return {
    matches: sorted,
    analysedVacancies: jobs.length,
    candidateLocation: candidatePoint ? { postcode: candidateInput.postcode, found: true } : { postcode: candidateInput.postcode || "", found: false }
  };
}
