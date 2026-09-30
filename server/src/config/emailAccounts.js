import { currentOrganizationId, currentTenant, isDefaultOrganization } from "../tenancy/tenantContext.js";

function bool(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback;
  return String(value).toLowerCase() === "true";
}

function accountFromEnv(prefix, fallback = {}) {
  const address = process.env[`${prefix}_ADDRESS`] || fallback.address || "";
  const user = process.env[`${prefix}_SMTP_USER`] || fallback.user || address;
  const pass = process.env[`${prefix}_SMTP_PASS`] || fallback.pass || "";
  const host = process.env[`${prefix}_SMTP_HOST`] || fallback.host || process.env.SMTP_HOST;
  const port = Number(process.env[`${prefix}_SMTP_PORT`] || fallback.port || process.env.SMTP_PORT || 587);
  const secure = bool(process.env[`${prefix}_SMTP_SECURE`], bool(fallback.secure, process.env.SMTP_SECURE === "true"));

  if (!address || !host || !user || !pass) return null;

  return {
    key: address.toLowerCase(),
    address: address.toLowerCase(),
    label: process.env[`${prefix}_LABEL`] || fallback.label || address,
    name: process.env[`${prefix}_NAME`] || fallback.name || "Innovex Resource Group Limited",
    host,
    port,
    secure,
    user,
    pass,
    imapHost: process.env[`${prefix}_IMAP_HOST`] || fallback.imapHost || process.env.IMAP_HOST || "imap.hostinger.com",
    imapPort: Number(process.env[`${prefix}_IMAP_PORT`] || fallback.imapPort || process.env.IMAP_PORT || 993),
    imapSecure: bool(process.env[`${prefix}_IMAP_SECURE`], bool(fallback.imapSecure, process.env.IMAP_SECURE !== "false"))
  };
}

function accountFromObject(account = {}) {
  const address = String(account.address || "").toLowerCase().trim();
  const host = account.host || account.smtpHost || process.env.SMTP_HOST;
  const user = account.user || account.smtpUser || address;
  const pass = account.pass || account.smtpPass || "";
  if (!address || !host || !user || !pass) return null;

  return {
    key: address,
    address,
    label: account.label || address,
    name: account.name || account.label || "Innovex Resource Group Limited",
    host,
    port: Number(account.port || account.smtpPort || process.env.SMTP_PORT || 587),
    secure: bool(account.secure ?? account.smtpSecure, process.env.SMTP_SECURE === "true"),
    user,
    pass,
    imapHost: account.imapHost || process.env.IMAP_HOST || "imap.hostinger.com",
    imapPort: Number(account.imapPort || process.env.IMAP_PORT || 993),
    imapSecure: bool(account.imapSecure, process.env.IMAP_SECURE !== "false")
  };
}

function extraAccountsFromEnv() {
  if (!process.env.SMTP_EXTRA_ACCOUNTS) return [];
  try {
    const parsed = JSON.parse(process.env.SMTP_EXTRA_ACCOUNTS);
    return (Array.isArray(parsed) ? parsed : []).map(accountFromObject).filter(Boolean);
  } catch {
    return [];
  }
}

// The legacy platform-wide mailboxes, configured via env vars. These only ever
// belong to the default organisation (Innovex itself) - a new tenant with no
// mailbox connected yet must not see, or be able to send as, Innovex's own
// mailboxes, so this list is skipped entirely for every other organisation.
function legacyEnvAccounts() {
  if (!isDefaultOrganization(currentOrganizationId())) return [];
  const defaults = [
    accountFromEnv("SMTP_INFO", {
      address: process.env.SMTP_INFO_ADDRESS || "info@innovexresourcegroup.co.uk",
      label: "Info mailbox",
      name: "Innovex Resource Group Limited",
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }),
    accountFromEnv("SMTP_MARK", {
      address: process.env.SMTP_MARK_ADDRESS || "mark.harrison@innovexresourcegroup.co.uk",
      label: "Mark Harrison",
      name: "Mark Harrison",
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE
    }),
    accountFromEnv("SMTP_RECRUITMENT", {
      address: process.env.SMTP_RECRUITMENT_ADDRESS || "recruitment@innovexresourcegroup.co.uk",
      label: "Recruitment mailbox",
      name: "Innovex Recruitment Team",
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE
    })
  ].filter(Boolean);
  return [...defaults, ...extraAccountsFromEnv()];
}

// Every mailbox available to the CURRENT organisation (from the AsyncLocalStorage
// tenant context set up in middleware/tenant.js): the org's own connected
// mailboxes (Settings > Email accounts) plus, only for the default organisation,
// the legacy env-var mailboxes kept for backwards compatibility. Org-connected
// accounts win on an address clash, since they're the ones an admin can actually
// update from the UI.
export function configuredEmailAccounts() {
  const orgAccounts = currentTenant().emailAccounts || [];
  const unique = new Map();
  [...legacyEnvAccounts(), ...orgAccounts].forEach((account) => {
    if (account) unique.set(account.address, account);
  });
  return Array.from(unique.values());
}

export function publicEmailAccounts() {
  return configuredEmailAccounts().map(({ pass, ...account }) => ({
    key: account.key,
    address: account.address,
    label: account.label,
    name: account.name
  }));
}

export function findEmailAccount(address) {
  const normalized = String(address || "").toLowerCase().trim();
  return configuredEmailAccounts().find((account) => account.address === normalized) || null;
}

export function allowedSenderAccountsForUser(user) {
  const accounts = publicEmailAccounts();
  if (!user) return [];
  if (["admin", "super_admin"].includes(user.role)) return accounts;
  const assigned = new Set((user.assignedSenderEmails || []).map((email) => String(email || "").toLowerCase()));
  return accounts.filter((account) => assigned.has(account.address));
}

export function canUseSender(user, address) {
  const normalized = String(address || "").toLowerCase().trim();
  return allowedSenderAccountsForUser(user).some((account) => account.address === normalized);
}
