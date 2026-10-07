export const WEB_BASE_URL = (process.env.EXPO_PUBLIC_WEB_BASE_URL || "https://www.innovexresourcegroup.co.uk").replace(/\/$/, "");
export const WORKSPACE_URL = `${WEB_BASE_URL}/admin`;

export function isInnovexUrl(url: string) {
  try {
    const base = new URL(WEB_BASE_URL);
    const target = new URL(url);
    return target.protocol === "https:" && target.hostname === base.hostname;
  } catch {
    return false;
  }
}
