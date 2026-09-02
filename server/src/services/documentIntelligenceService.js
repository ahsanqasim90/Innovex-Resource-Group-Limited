import crypto from "crypto";
import mammoth from "mammoth";
import pdf from "pdf-parse/lib/pdf-parse.js";
import { outwardCode } from "./postcodeIntelligenceService.js";
import { scanRecruitmentDocument } from "./malwareScanService.js";

const MAX_EXTRACTED_TEXT = 160_000;
const stopWords = new Set([
  "and", "the", "for", "with", "that", "this", "from", "will", "your", "you", "our", "are", "have", "has", "job", "role", "work", "working", "candidate", "required", "essential", "desirable", "must", "should", "within", "including", "about", "into", "their", "they", "them", "who", "what", "when", "where", "which", "been", "being", "than", "then", "also", "only", "across", "based", "provide", "support"
]);

const skillCatalog = [
  "adult social care", "agency recruitment", "business development", "care assistant", "care planning", "care worker", "clinical governance", "communication", "compliance", "crm", "customer service", "dementia care", "domiciliary care", "driver", "email marketing", "excel", "first aid", "health and safety", "healthcare", "lead generation", "leadership", "learning disabilities", "manual handling", "medication administration", "mental health", "microsoft office", "nursing", "palliative care", "payroll", "person centred care", "recruitment", "risk assessment", "safeguarding", "sales", "scheduling", "social care", "stakeholder management", "support worker", "team management", "training", "whatsapp", "linkedin", "cold calling", "candidate sourcing", "temporary staffing", "permanent recruitment", "care coordinator", "registered manager", "deputy manager", "registered nurse", "senior carer", "warehouse", "administration", "bookkeeping", "finance", "marketing", "seo", "web development", "javascript", "react", "node.js", "python", "project management"
];

const qualificationCatalog = [
  "nmc pin", "nmc registration", "nvq level 2", "nvq level 3", "nvq level 4", "nvq level 5", "care certificate", "dbs", "enhanced dbs", "first aid certificate", "driving licence", "right to work", "cipd", "acca", "cima", "degree", "diploma"
];

const conceptAliases = {
  "registered nurse": ["registered nurse", "rgn", "rmn", "rn adult", "staff nurse"],
  "care assistant": ["care assistant", "healthcare assistant", "health care assistant", "hca", "care worker"],
  "support worker": ["support worker", "care support worker"],
  "registered manager": ["registered manager", "care home manager", "home manager"],
  "deputy manager": ["deputy manager", "deputy home manager"],
  "care planning": ["care planning", "care plans", "care plan management", "person centred planning"],
  safeguarding: ["safeguarding", "adult safeguarding", "child safeguarding"],
  leadership: ["leadership", "team leader", "staff supervision", "supervising staff", "people management"],
  "medication administration": ["medication administration", "medication management", "administer medication", "mar charts", "mar chart"],
  "clinical governance": ["clinical governance", "clinical compliance", "quality governance"],
  "person centred care": ["person centred care", "person-centered care", "individualised care"],
  "risk assessment": ["risk assessment", "risk assessments", "risk management"],
  "dementia care": ["dementia care", "dementia support"],
  recruitment: ["recruitment", "talent acquisition", "staffing"],
  "candidate sourcing": ["candidate sourcing", "talent sourcing", "candidate search", "headhunting"],
  sales: ["sales", "business development", "bd executive"],
  "lead generation": ["lead generation", "prospecting", "new business leads"],
  "cold calling": ["cold calling", "outbound calling", "telesales"],
  crm: ["crm", "customer relationship management", "pipeline management"],
  excel: ["excel", "microsoft excel", "spreadsheets"],
  communication: ["communication", "communicator", "verbal and written"],
  "project management": ["project management", "project delivery", "programme management"],
  javascript: ["javascript", "js", "ecmascript"],
  react: ["react", "react.js", "reactjs"],
  "node.js": ["node.js", "nodejs", "node js"]
};

const qualificationAliases = {
  "NMC registration": ["nmc pin", "nmc registration", "nmc registered", "registered with the nmc", "active nmc", "valid nmc"],
  "Enhanced DBS": ["enhanced dbs", "dbs on update service", "dbs certificate"],
  "NVQ Level 2": ["nvq level 2", "nvq2", "level 2 health and social care"],
  "NVQ Level 3": ["nvq level 3", "nvq3", "level 3 health and social care"],
  "NVQ Level 5": ["nvq level 5", "nvq5", "level 5 leadership and management"],
  "Driving licence": ["driving licence", "driver's licence", "drivers licence", "full uk licence"],
  "Right to Work": ["right to work", "eligible to work in the uk", "permission to work in the uk", "work permit"],
  Degree: ["degree", "bachelor", "bsc", "ba hons", "master", "msc", "mba"]
};

function cleanText(value = "") {
  return String(value).replace(/\u0000/g, " ").replace(/\s+/g, " ").trim().slice(0, MAX_EXTRACTED_TEXT);
}

function cleanDocumentText(value = "") {
  return String(value)
    .replace(/\u0000/g, " ")
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) => line.replace(/[\t ]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_EXTRACTED_TEXT);
}

export function structureDocumentReviewText(value = "") {
  const headings = [
    "Professional Profile", "Personal Profile", "Professional Summary", "Career Summary",
    "Key Clinical Skills", "Core Skills", "Key Skills", "Employment History", "Work Experience",
    "Professional Experience", "Education", "Education and Qualifications", "Qualifications", "Training",
    "Certifications", "Professional Registration", "Achievements", "References", "Additional Information"
  ];
  const headingPattern = headings.map((heading) => heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  return cleanDocumentText(value)
    .replace(new RegExp(`\\s+(${headingPattern})\\s*:?\\s+`, "gi"), "\n\n$1\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normal(value = "") {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9+#. ]/g, " ").replace(/\s+/g, " ").trim();
}

function unique(values = [], limit = 80) {
  return [...new Set(values.map((value) => cleanText(value)).filter(Boolean))].slice(0, limit);
}

function documentType(file) {
  const buffer = file?.buffer;
  if (!buffer?.length) return null;
  if (buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "pdf";
  if (buffer[0] === 0x50 && buffer[1] === 0x4b && [0x03, 0x05, 0x07].includes(buffer[2])) return "docx";
  return null;
}

export function validateRecruitmentDocument(file, { pdfOnly = false } = {}) {
  if (!file) {
    const error = new Error("A recruitment document is required");
    error.statusCode = 400;
    throw error;
  }
  const verifiedType = documentType(file);
  if (!verifiedType || (pdfOnly && verifiedType !== "pdf")) {
    const error = new Error(pdfOnly ? "For secure preview, upload a genuine PDF file" : "Upload a genuine PDF or DOCX file. Renamed or unsupported files are rejected.");
    error.statusCode = 400;
    throw error;
  }
  const expectedExtension = verifiedType === "pdf" ? /\.pdf$/i : /\.docx$/i;
  if (!expectedExtension.test(file.originalname || "")) {
    const error = new Error(`File content does not match its ${verifiedType.toUpperCase()} extension`);
    error.statusCode = 400;
    throw error;
  }
  if (verifiedType === "pdf") {
    const raw = file.buffer.toString("latin1");
    if (/\/(JavaScript|JS|Launch|EmbeddedFile)\b/i.test(raw)) {
      const error = new Error("This PDF contains active or embedded content and was rejected for security");
      error.statusCode = 400;
      throw error;
    }
  }
  return verifiedType;
}

export async function extractDocumentText(file) {
  const verifiedType = validateRecruitmentDocument(file);
  if (verifiedType === "pdf") {
    const result = await pdf(file.buffer);
    return { text: cleanDocumentText(result.text), verifiedType };
  }
  const result = await mammoth.extractRawText({ buffer: file.buffer });
  return { text: cleanDocumentText(result.value), verifiedType };
}

export async function secureDocumentMeta(file, user, { extract = true } = {}) {
  const verifiedType = validateRecruitmentDocument(file);
  const securityScan = await scanRecruitmentDocument(file.buffer);
  if (securityScan.status === "Rejected") {
    const error = new Error("The uploaded file was rejected by the antivirus scanner");
    error.statusCode = 422;
    throw error;
  }
  let extractedText = "";
  if (extract && securityScan.status === "Clean") extractedText = (await extractDocumentText(file)).text;
  return {
    filename: `${Date.now()}-${crypto.randomUUID()}-${verifiedType}`,
    originalName: cleanText(file.originalname).slice(0, 180),
    mimetype: verifiedType === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    size: file.size,
    data: file.buffer,
    extractedText,
    indexedAt: extractedText ? new Date() : undefined,
    contentHash: crypto.createHash("sha256").update(file.buffer).digest("hex"),
    verifiedType,
    scanStatus: securityScan.status,
    scanEngine: securityScan.engine,
    scannedAt: securityScan.status === "Clean" ? new Date() : undefined,
    quarantineReason: securityScan.reason,
    uploadedAt: new Date(),
    uploadedBy: user ? { user: user._id, name: user.name, email: user.email } : undefined
  };
}

function linesFromDescription(value = "") {
  return String(value).split(/[\r\n•]+/).map((line) => cleanText(line.replace(/^[-*\d.)\s]+/, ""))).filter((line) => line.length >= 8);
}

function yearsFromText(value = "") {
  const matches = [...normal(value).matchAll(/(\d{1,2})\s*(?:\+\s*)?(?:years?|yrs?)/g)].map((match) => Number(match[1])).filter((number) => number <= 30);
  return matches.length ? Math.max(...matches) : 0;
}

function topKeywords(value = "", limit = 24) {
  const counts = new Map();
  normal(value).split(/\s+/).filter((word) => word.length >= 4 && !stopWords.has(word) && !/^\d+$/.test(word)).forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit).map(([word]) => word);
}

export function analyseJobDescription(description = "", details = {}) {
  const text = cleanText(description);
  const normalized = normal(`${details.title || ""} ${text}`);
  const lines = linesFromDescription(description);
  const essentialRequirements = lines.filter((line) => /\b(must|required|essential|mandatory|minimum|need to|licen[cs]e|registration)\b/i.test(line)).slice(0, 16);
  const desirableRequirements = lines.filter((line) => /\b(desirable|preferred|advantage|ideally|beneficial)\b/i.test(line)).slice(0, 12);
  const semanticSkills = Object.entries(conceptAliases).filter(([, aliases]) => aliases.some((alias) => normalized.includes(normal(alias)))).map(([concept]) => concept);
  const semanticQualifications = Object.entries(qualificationAliases).filter(([, aliases]) => aliases.some((alias) => normalized.includes(normal(alias)))).map(([concept]) => concept);
  const skills = unique([...semanticSkills, ...skillCatalog.filter((skill) => normalized.includes(skill))], 40);
  const qualifications = unique([...semanticQualifications, ...qualificationCatalog.filter((qualification) => normalized.includes(qualification))], 24);
  const keywords = unique([...skills, ...qualifications, ...topKeywords(text)], 40);
  const firstSentences = text.split(/(?<=[.!?])\s+/).filter(Boolean).slice(0, 2).join(" ");
  return {
    summary: firstSentences.slice(0, 600) || `${details.title || "Vacancy"} in ${details.location || "the selected location"}`,
    skills,
    qualifications,
    essentialRequirements,
    desirableRequirements,
    keywords,
    experienceYears: yearsFromText(text),
    analysedAt: new Date(),
    method: "Privacy-safe explainable matching"
  };
}

export function buildCriteriaReview(description = "", details = {}, intelligence = analyseJobDescription(description, details)) {
  const normalized = normal(`${details.title || ""} ${description}`);
  const explicitRequirements = Array.isArray(details.requirements) ? details.requirements : [];
  const mandatoryText = `${intelligence.essentialRequirements.join(" ")} ${explicitRequirements.join(" ")}`;
  const desirableText = intelligence.desirableRequirements.join(" ");
  const mandatorySkills = unique([
    ...Object.entries(conceptAliases).filter(([, aliases]) => aliases.some((alias) => normal(mandatoryText).includes(normal(alias)))).map(([concept]) => concept),
    ...intelligence.skills.filter((skill) => /\b(must|required|essential|mandatory)\b/i.test(mandatoryText) && normal(mandatoryText).includes(normal(skill)))
  ], 24);
  const desirableSkills = unique(Object.entries(conceptAliases).filter(([, aliases]) => aliases.some((alias) => normal(desirableText).includes(normal(alias)))).map(([concept]) => concept), 24);
  const nurseRole = /\b(registered nurse|rgn|rmn|staff nurse|nurse)\b/.test(normalized);
  const registrationRequired = nurseRole || /\b(nmc pin|nmc registration|registered with (?:the )?nmc)\b/.test(normalized);
  const drivingRequired = /\b(must|required|essential)\b.{0,55}\b(driv(?:e|er|ing)|licen[cs]e|own vehicle)\b|\b(driv(?:e|er|ing)|licen[cs]e|own vehicle)\b.{0,55}\b(must|required|essential)\b/.test(normalized);
  return {
    mandatorySkills,
    desirableSkills: desirableSkills.filter((skill) => !mandatorySkills.includes(skill)),
    qualifications: unique(intelligence.qualifications, 24),
    minimumExperienceYears: intelligence.experienceYears || 0,
    registrationRequired,
    registrationTerms: registrationRequired ? ["NMC registration"] : [],
    rightToWorkRequired: true,
    drivingRequired,
    availabilityRequirement: cleanText(details.shift || ""),
    reviewStatus: "Needs review"
  };
}

export function defaultScoreProfile(title = "") {
  const normalized = normal(title);
  if (/\b(nurse|rgn|rmn|clinical)\b/.test(normalized)) return { name: "Clinical", skills: 25, experience: 25, qualifications: 25, location: 15, availability: 5, recency: 5 };
  if (/\b(manager|lead|director|head)\b/.test(normalized)) return { name: "Leadership", skills: 30, experience: 30, qualifications: 15, location: 10, availability: 5, recency: 10 };
  if (/\b(sales|business development|recruit|resourc)\b/.test(normalized)) return { name: "Commercial", skills: 35, experience: 25, qualifications: 5, location: 15, availability: 10, recency: 10 };
  return { name: "Balanced", skills: 30, experience: 25, qualifications: 20, location: 15, availability: 5, recency: 5 };
}

function termSet(value = "") {
  return new Set(normal(value).split(/\s+/).filter((word) => word.length >= 3 && !stopWords.has(word)));
}

function overlapScore(required = [], candidateText = "") {
  const terms = Array.isArray(required) ? required : [...required];
  if (!terms.length) return 65;
  const normalized = normal(candidateText);
  const matched = terms.filter((item) => normalized.includes(normal(item)));
  return Math.round((matched.length / terms.length) * 100);
}

function aliasesFor(term = "") {
  const normalized = normal(term);
  for (const [concept, aliases] of [...Object.entries(conceptAliases), ...Object.entries(qualificationAliases)]) {
    if (normal(concept) === normalized || aliases.some((alias) => normal(alias) === normalized)) return unique([concept, ...aliases], 20);
  }
  return [term];
}

function hasPositiveMention(text = "", term = "") {
  const source = normal(text);
  return aliasesFor(term).some((alias) => {
    const needle = normal(alias);
    let index = source.indexOf(needle);
    while (index >= 0) {
      const prefix = source.slice(Math.max(0, index - 28), index);
      if (!/\b(no|not|without|lack|lacks|lacking|expired|unregistered)\b/.test(prefix)) return true;
      index = source.indexOf(needle, index + needle.length);
    }
    return false;
  });
}

function semanticOverlap(required = [], candidateText = "") {
  const terms = unique(required, 50);
  if (!terms.length) return { score: 75, matched: [], missing: [] };
  const matched = terms.filter((term) => hasPositiveMention(candidateText, term));
  return { score: Math.round((matched.length / terms.length) * 100), matched, missing: terms.filter((term) => !matched.includes(term)) };
}

function roleScore(job, candidateText) {
  const required = termSet(`${job.title} ${(job.intelligence?.keywords || []).join(" ")}`);
  const present = termSet(candidateText);
  if (!required.size) return 60;
  const matches = [...required].filter((term) => present.has(term)).length;
  return Math.min(100, Math.round((matches / Math.min(required.size, 18)) * 100));
}

function distanceScore(distance, radius) {
  if (distance <= radius) return 100;
  if (distance <= radius * 1.25) return 65;
  if (distance <= radius * 1.75) return 40;
  return 15;
}

function locationScore(job, candidate, context = {}) {
  const vacancy = normal(`${job.location || ""} ${job.postcode || ""}`);
  if (/\b(remote|home based|nationwide)\b/.test(vacancy)) return { score: 100, label: "Remote / nationwide" };
  const candidateLocation = normal(`${candidate.city || ""} ${candidate.postcode || ""} ${candidate.postcodePrefix || ""}`);
  if (!candidateLocation) return { score: 45, label: "Candidate location not recorded", distanceMiles: null, source: null };
  const radius = Number(job.radiusMiles || 25);
  let distance = null;
  let source = null;
  if (context.origin && Number.isFinite(candidate.latitude) && Number.isFinite(candidate.longitude)) {
    distance = context.haversineMiles?.(context.origin.latitude, context.origin.longitude, Number(candidate.latitude), Number(candidate.longitude));
    source = "exact postcode";
  }
  if (distance === null && context.outcodeDistances) {
    const outcode = outwardCode(candidate.postcode || candidate.postcodePrefix);
    if (outcode && context.outcodeDistances.has(outcode)) {
      distance = context.outcodeDistances.get(outcode);
      source = "postcode area";
    }
  }
  if (distance !== null && Number.isFinite(distance)) {
    const rounded = Number(distance.toFixed(1));
    return { score: distanceScore(rounded, radius), label: `${rounded} miles from vacancy (${source})`, distanceMiles: rounded, source };
  }
  const vacancyTokens = [...termSet(vacancy)];
  const exact = vacancyTokens.some((term) => candidateLocation.includes(term));
  const postcodeMatch = job.postcode && candidate.postcodePrefix && normal(job.postcode).replace(/\s/g, "").startsWith(normal(candidate.postcodePrefix).replace(/\s/g, "").slice(0, 2));
  return exact || postcodeMatch
    ? { score: 90, label: "Location text aligned; exact mileage unavailable", distanceMiles: null, source: "text" }
    : { score: 30, label: "Location requires recruiter review", distanceMiles: null, source: null };
}

function evidenceFor(text = "", matched = []) {
  const source = cleanText(text);
  const lower = source.toLowerCase();
  const snippets = [];
  for (const term of matched.slice(0, 4)) {
    const index = lower.indexOf(term.toLowerCase());
    if (index < 0) continue;
    const start = Math.max(0, index - 65);
    snippets.push(source.slice(start, Math.min(source.length, index + term.length + 95)).trim());
  }
  return unique(snippets, 4);
}

function recencyScore(value) {
  if (!value) return 35;
  const days = Math.max(0, (Date.now() - new Date(value).getTime()) / 86400000);
  if (days <= 90) return 100;
  if (days <= 180) return 85;
  if (days <= 365) return 70;
  if (days <= 730) return 50;
  return 30;
}

function confidenceFor(candidate, cvText, location) {
  let score = Math.min(45, Math.round((cvText.length / 5000) * 45));
  if (candidate.desiredRole) score += 10;
  if (candidate.experience) score += 10;
  if (candidate.availability || candidate.shiftPreference) score += 8;
  if (candidate.email) score += 7;
  if (candidate.postcode || candidate.city) score += 10;
  if (location.distanceMiles !== null) score += 10;
  score = Math.min(100, score);
  return { score, label: score >= 80 ? "High confidence" : score >= 55 ? "Medium confidence" : "Low confidence" };
}

function eligibilityFor(job, profileText, skillMatch, qualificationMatch) {
  const criteria = job.criteriaReview || {};
  const checks = [];
  skillMatch.missing.forEach((skill) => checks.push({ key: skill, label: skill, status: "Review", reason: "Mandatory skill evidence not found" }));
  qualificationMatch.missing.forEach((qualification) => checks.push({ key: qualification, label: qualification, status: "Review", reason: "Qualification evidence not found" }));
  const registrationTerms = criteria.registrationTerms?.length ? criteria.registrationTerms : criteria.registrationRequired ? ["NMC registration"] : [];
  if (criteria.registrationRequired && !registrationTerms.some((term) => hasPositiveMention(profileText, term))) checks.push({ key: "registration", label: registrationTerms.join(" / ") || "Professional registration", status: "Review", reason: "Registration must be verified" });
  if (criteria.rightToWorkRequired && !Object.keys(qualificationAliases).filter((key) => key === "Right to Work").some((term) => hasPositiveMention(profileText, term))) checks.push({ key: "right-to-work", label: "Right to Work", status: /\b(no|not|without) (?:valid )?right to work\b/.test(normal(profileText)) ? "Fail" : "Review", reason: "Right to Work evidence must be verified" });
  if (criteria.drivingRequired && !hasPositiveMention(profileText, "Driving licence")) checks.push({ key: "driving", label: "Driving licence", status: "Review", reason: "Driving requirement evidence not found" });
  const status = checks.some((check) => check.status === "Fail") ? "Fail" : checks.length ? "Review" : "Pass";
  return { status, checks, passed: Math.max(0, (criteria.mandatorySkills?.length || 0) + (criteria.qualifications?.length || 0) - checks.length), total: (criteria.mandatorySkills?.length || 0) + (criteria.qualifications?.length || 0) + Number(Boolean(criteria.registrationRequired)) + Number(Boolean(criteria.rightToWorkRequired)) + Number(Boolean(criteria.drivingRequired)) };
}

export function rankCandidateForJob(job, candidate, context = {}) {
  const cvText = cleanText(candidate.cv?.extractedText || "");
  const profileText = `${candidate.desiredRole || ""} ${candidate.experience || ""} ${(candidate.tags || []).join(" ")} ${candidate.availability || ""} ${candidate.shiftPreference || ""} ${cvText}`;
  const criteria = job.criteriaReview || {};
  const mandatorySkills = criteria.mandatorySkills?.length ? criteria.mandatorySkills : (job.intelligence?.skills || []).slice(0, 10);
  const desirableSkills = criteria.desirableSkills || [];
  const skillMatch = semanticOverlap(mandatorySkills, profileText);
  const desirableMatch = semanticOverlap(desirableSkills, profileText);
  const matchedSkills = unique([...skillMatch.matched, ...desirableMatch.matched], 30);
  const missingSkills = skillMatch.missing;
  const skills = Math.round(skillMatch.score * 0.8 + desirableMatch.score * 0.2);
  const roleExperience = roleScore(job, profileText);
  const location = locationScore(job, candidate, context);
  const availabilityRequirement = criteria.availabilityRequirement || job.shift || job.type;
  const availability = candidate.availability || candidate.shiftPreference ? overlapScore(termSet(availabilityRequirement), `${candidate.availability || ""} ${candidate.shiftPreference || ""}`) : 45;
  const requiredQualifications = criteria.qualifications?.length ? criteria.qualifications : (job.intelligence?.qualifications || []);
  const qualificationMatch = semanticOverlap(requiredQualifications, profileText);
  const qualifications = qualificationMatch.score;
  const recency = recencyScore(candidate.cv?.indexedAt);
  const breakdown = {
    skills,
    roleExperience,
    location: location.score,
    availability,
    qualifications,
    recency
  };
  const weights = { ...defaultScoreProfile(job.title), ...(job.scoreProfile || {}) };
  const totalWeight = ["skills", "experience", "qualifications", "location", "availability", "recency"].reduce((sum, key) => sum + Number(weights[key] || 0), 0) || 100;
  let matchScore = Math.round((skills * Number(weights.skills || 0) + roleExperience * Number(weights.experience || 0) + qualifications * Number(weights.qualifications || 0) + location.score * Number(weights.location || 0) + availability * Number(weights.availability || 0) + recency * Number(weights.recency || 0)) / totalWeight);
  const eligibility = eligibilityFor(job, profileText, skillMatch, qualificationMatch);
  if (eligibility.status === "Fail") matchScore = Math.min(matchScore, 49);
  if (eligibility.status === "Review" && requiredQualifications.length && qualifications === 0) matchScore = Math.min(matchScore, 64);
  matchScore = Math.max(0, Math.min(100, matchScore));
  const confidence = confidenceFor(candidate, cvText, location);
  const dataQualityIssues = [];
  if (cvText.length < 500) dataQualityIssues.push("CV text is limited");
  if (!candidate.postcode && !candidate.city) dataQualityIssues.push("Location not recorded");
  if (!candidate.availability && !candidate.shiftPreference) dataQualityIssues.push("Availability not recorded");
  if (!candidate.experience) dataQualityIssues.push("Experience summary not recorded");
  return {
    candidateId: candidate._id,
    recordId: `IRG-${String(candidate._id).slice(-8).toUpperCase()}`,
    name: candidate.name,
    email: candidate.email,
    phone: candidate.phone,
    desiredRole: candidate.desiredRole,
    city: candidate.city,
    postcode: candidate.postcode,
    availability: candidate.availability,
    status: candidate.status,
    cv: candidate.cv ? { originalName: candidate.cv.originalName, indexedAt: candidate.cv.indexedAt, verifiedType: candidate.cv.verifiedType } : null,
    matchScore,
    recommendation: eligibility.status === "Fail" ? "Eligibility issue" : matchScore >= 80 && eligibility.status === "Pass" ? "Strong match" : matchScore >= 65 ? "Good potential" : matchScore >= 50 ? "Review required" : "Low alignment",
    breakdown,
    matchedSkills,
    missingSkills: missingSkills.slice(0, 8),
    locationAssessment: location.label,
    distanceMiles: location.distanceMiles,
    distanceSource: location.source,
    eligibility,
    confidence,
    dataQualityIssues,
    scoreProfile: weights.name || "Balanced",
    evidence: evidenceFor(cvText, matchedSkills),
    safeguards: "Protected characteristics were not used in this score. Human review is required."
  };
}
