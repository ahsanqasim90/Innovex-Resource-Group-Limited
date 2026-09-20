// Small guard rails so vacancies reach candidates looking consistent and professional.
// They only tidy obvious formatting slips and reject figures that are almost certainly a mistake.

const UK_POSTCODE = /\b([A-Z]{1,2}\d[A-Z\d]?)(?:\s*(\d[A-Z]{2}))?\b/i;

export function tidyText(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function titleCase(value) {
  return value.toLowerCase().replace(/(^|[\s(/–-])([a-z])/g, (_, lead, letter) => `${lead}${letter.toUpperCase()}`);
}

// Pulls a UK postcode (full, or just the outward part such as "PR9") out of free text like "Southport, PR9".
export function extractPostcode(text) {
  const match = String(text || "").toUpperCase().match(UK_POSTCODE);
  if (!match) return "";
  return match[2] ? `${match[1]} ${match[2]}` : match[1];
}

export function normaliseSalary(salary) {
  const text = tidyText(salary);
  // "60,000 per annum" or "16 per hour" is missing its currency symbol.
  return /^\d/.test(text) ? `£${text}` : text;
}

// Returns a message when the pay figure and the pay period clearly disagree, otherwise "".
export function salaryProblem(salary) {
  const text = tidyText(salary).toLowerCase();
  let amounts = [...text.matchAll(/(\d[\d,]*(?:\.\d+)?)/g)].map((match) => Number(match[1].replace(/,/g, ""))).filter(Number.isFinite);
  if (!amounts.length) return "";
  // "55-65K" writes the K once for the whole range.
  if (/\d\s*k\b/.test(text)) amounts = amounts.map((amount) => (amount < 1000 ? amount * 1000 : amount));
  if (/(per annum|per year|a year|annum|p\.a\.)/.test(text) && Math.max(...amounts) < 1000) {
    return `The salary "${salary}" looks like an hourly rate. Write "per hour", or enter the full annual figure.`;
  }
  if (/(per hour|an hour|\/hr|hourly)/.test(text) && Math.min(...amounts) > 200) {
    return `The salary "${salary}" looks like an annual figure. Write "per annum", or enter the hourly rate.`;
  }
  return "";
}

// Tidies the fields that are present in a job payload. `existing` is the saved job when editing.
export function normaliseJobPayload(payload, existing = null) {
  for (const field of ["title", "location", "type", "shift"]) {
    if (payload[field] !== undefined) payload[field] = tidyText(payload[field]);
  }
  if (payload.title !== undefined && payload.title.length > 3 && payload.title === payload.title.toUpperCase()) {
    payload.title = titleCase(payload.title);
  }
  if (payload.salary !== undefined) payload.salary = normaliseSalary(payload.salary);
  if (payload.location !== undefined && !tidyText(payload.postcode) && !existing?.postcode) {
    const postcode = extractPostcode(payload.location);
    if (postcode) payload.postcode = postcode;
  }
  return payload;
}

export function assertSalaryLooksRight(salary) {
  const problem = salaryProblem(salary);
  if (problem) {
    const error = new Error(problem);
    error.statusCode = 400;
    throw error;
  }
}

function escapeForRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Public visitors and candidates must never see the client / care home name.
// Removes the client name field and blanks it out of any text the record carries.
export function redactClientName(record, clientName = record?.clientName) {
  if (!record || typeof record !== "object") return record;
  const out = { ...record };
  const name = String(clientName || "").trim();
  const pattern = name.length >= 3 ? new RegExp(escapeForRegex(name), "gi") : null;
  const scrub = (value) => (pattern && typeof value === "string" ? value.replace(pattern, "our client") : value);
  for (const [key, value] of Object.entries(out)) {
    if (typeof value === "string") out[key] = scrub(value);
    else if (Array.isArray(value)) out[key] = value.map(scrub);
  }
  delete out.clientName;
  return out;
}
