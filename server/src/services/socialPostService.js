import { redactClientName } from "../utils/jobQuality.js";

// Free social posting through Meta's official Graph API (Facebook Page + Instagram).
// Nothing here is a paid service. Tokens live only in server environment variables
// and are never logged or sent to the browser.

const REQUEST_TIMEOUT_MS = 15000;

function graphBase() {
  return `https://graph.facebook.com/${process.env.GRAPH_API_VERSION || "v24.0"}`;
}

function facebookConfig() {
  const pageId = String(process.env.FACEBOOK_PAGE_ID || "").trim();
  const token = String(process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "").trim();
  return pageId && token ? { pageId, token } : null;
}

function instagramConfig() {
  const accountId = String(process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID || "").trim();
  const token = String(process.env.INSTAGRAM_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "").trim();
  return accountId && token ? { accountId, token } : null;
}

export function socialStatus() {
  return {
    facebook: Boolean(facebookConfig()),
    instagram: Boolean(instagramConfig()),
    linkedin: "share",
    siteUrl: siteUrl()
  };
}

export function siteUrl() {
  return String(process.env.SITE_URL || "https://www.innovexresourcegroup.co.uk").replace(/\/+$/, "");
}

export function jobUrl(job) {
  return `${siteUrl()}/jobs/${job._id}`;
}

export function mediaUrl(key) {
  return `${siteUrl()}/api/social/media/${key}.jpg`;
}

function tidy(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function firstSentences(text = "", limit = 230) {
  const clean = tidy(text);
  if (clean.length <= limit) return clean;
  const cut = clean.slice(0, limit);
  const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("; "));
  return end > 90 ? cut.slice(0, end + 1) : `${cut.slice(0, cut.lastIndexOf(" "))}...`;
}

function hashtagsFor(job) {
  const text = `${job.title} ${job.description || ""}`.toLowerCase();
  const tags = ["#Hiring", "#Jobs"];
  const rules = [
    [/nurs|rgn|rmn|registered manager/, "#NursingJobs"],
    [/care|carer|support worker|senior care/, "#CareJobs"],
    [/health|clinical|hospital|nhs/, "#HealthcareJobs"],
    [/child|residential|young people/, "#ChildrensHomes"],
    [/driver|warehouse|logistics/, "#LogisticsJobs"],
    [/manager|management|lead/, "#Management"]
  ];
  for (const [pattern, tag] of rules) if (pattern.test(text)) tags.push(tag);
  const town = tidy(job.location).split(/[,\s]+/).find((part) => /^[A-Za-z]{4,}$/.test(part));
  if (town) tags.push(`#${town[0].toUpperCase()}${town.slice(1).toLowerCase()}Jobs`);
  tags.push("#UKJobs", "#Recruitment");
  return [...new Set(tags)].slice(0, 8).join(" ");
}

// Builds the default caption. The client / care home name is never included.
export function buildJobCaption(rawJob) {
  const job = redactClientName(rawJob);
  const lines = [`We're hiring: ${tidy(job.title)}`];
  if (job.location) lines.push(`Location: ${tidy(job.location)}`);
  if (job.salary) lines.push(`Salary: ${tidy(job.salary)}`);
  const terms = [job.type, job.shift].map(tidy).filter(Boolean).join(" | ");
  if (terms) lines.push(`Type: ${terms}`);
  const summary = firstSentences(job.description);
  if (summary) lines.push("", summary);
  lines.push("", `Apply now: ${jobUrl(rawJob)}`, "", hashtagsFor(job));
  return lines.join("\n");
}

async function graphCall(path, { method = "POST", fields = {}, token }) {
  const url = `${graphBase()}${path}`;
  const options = { method, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) };
  if (method === "GET") {
    const query = new URLSearchParams({ ...fields, access_token: token });
    const response = await fetch(`${url}?${query}`, options);
    return readGraph(response);
  }
  const body = new URLSearchParams({ ...fields, access_token: token });
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  return readGraph(response);
}

async function readGraph(response) {
  let data = null;
  try { data = await response.json(); } catch { /* handled below */ }
  if (!response.ok || data?.error) {
    const message = data?.error?.message || `Meta returned status ${response.status}`;
    const error = new Error(describeGraphError(data?.error, message));
    error.code = data?.error?.code;
    throw error;
  }
  return data;
}

function describeGraphError(error, fallback) {
  const code = Number(error?.code);
  if (code === 190) return "The access token has expired or is invalid. Create a new long-lived token and update it in Vercel.";
  if (code === 200 || code === 10) return "Meta says this app does not have permission to post. Check the app permissions and that you are an admin of the Page.";
  if (code === 368 || code === 4 || code === 17) return "Meta is limiting posting right now. Try again later.";
  return String(fallback).replace(/access_token=[^&\s]+/gi, "access_token=***").slice(0, 300);
}

export async function postToFacebook({ caption, imageUrl, link }) {
  const config = facebookConfig();
  if (!config) throw new Error("Facebook is not connected yet.");
  const result = imageUrl
    ? await graphCall(`/${config.pageId}/photos`, { token: config.token, fields: { url: imageUrl, caption, published: "true" } })
    : await graphCall(`/${config.pageId}/feed`, { token: config.token, fields: { message: caption, ...(link ? { link } : {}) } });
  const postId = result.post_id || result.id;
  return { externalId: String(postId || ""), url: postId ? `https://www.facebook.com/${postId}` : "" };
}

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function postToInstagram({ caption, imageUrl }) {
  const config = instagramConfig();
  if (!config) throw new Error("Instagram is not connected yet.");
  if (!imageUrl) throw new Error("Instagram needs an image.");
  const container = await graphCall(`/${config.accountId}/media`, { token: config.token, fields: { image_url: imageUrl, caption } });
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const status = await graphCall(`/${container.id}`, { method: "GET", token: config.token, fields: { fields: "status_code" } }).catch(() => null);
    if (!status || status.status_code === "FINISHED") break;
    if (status.status_code === "ERROR" || status.status_code === "EXPIRED") throw new Error("Instagram could not process the image. Try posting again.");
    await wait(2000);
  }
  const published = await graphCall(`/${config.accountId}/media_publish`, { token: config.token, fields: { creation_id: container.id } });
  const details = await graphCall(`/${published.id}`, { method: "GET", token: config.token, fields: { fields: "permalink" } }).catch(() => null);
  return { externalId: String(published.id || ""), url: details?.permalink || "" };
}
