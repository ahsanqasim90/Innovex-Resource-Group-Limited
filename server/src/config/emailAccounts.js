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
    pass
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
    pass
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

export function configuredEmailAccounts() {
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
    })
  ].filter(Boolean);

  const unique = new Map();
  [...defaults, ...extraAccountsFromEnv()].forEach((account) => {
    if (!unique.has(account.address)) unique.set(account.address, account);
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
