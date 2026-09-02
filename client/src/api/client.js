const API_URL = import.meta.env.VITE_API_URL || "/api";
const PUBLIC_API_ORIGIN = API_URL.startsWith("http") ? API_URL.replace(/\/api\/?$/, "") : "";

export function getToken() {
  return localStorage.getItem("innovexToken");
}

export function setToken(token) {
  if (token) localStorage.setItem("innovexToken", token);
  else localStorage.removeItem("innovexToken");
}

export function setCsrfToken(token) {
  if (token) sessionStorage.setItem("innovexCsrf", token);
  else sessionStorage.removeItem("innovexCsrf");
}

export function getWorkspaceSlug() {
  return localStorage.getItem("innovexWorkspace") || "";
}

export function setWorkspaceSlug(slug) {
  if (slug) localStorage.setItem("innovexWorkspace", String(slug).trim().toLowerCase());
  else localStorage.removeItem("innovexWorkspace");
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const workspaceSlug = getWorkspaceSlug();
  if (workspaceSlug) headers["X-Workspace-Slug"] = workspaceSlug;
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const csrfToken = sessionStorage.getItem("innovexCsrf");
  if (csrfToken && !["GET", "HEAD", "OPTIONS"].includes(String(options.method || "GET").toUpperCase())) headers["X-CSRF-Token"] = csrfToken;
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers,
    body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    if (response.status === 401) {
      setToken(null);
      setCsrfToken(null);
      window.dispatchEvent(new Event("innovex:logout"));
      if (window.location.pathname.startsWith("/admin") && window.location.pathname !== "/admin/login") {
        window.location.assign("/admin/login");
      }
    }
    const error = new Error(data?.message || "Request failed");
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

export async function portalApi(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const workspaceSlug = getWorkspaceSlug();
  if (workspaceSlug) headers["X-Workspace-Slug"] = workspaceSlug;
  const csrf = sessionStorage.getItem("innovexPortalCsrf");
  if (csrf && !["GET", "HEAD", "OPTIONS"].includes(String(options.method || "GET").toUpperCase())) headers["X-Portal-CSRF"] = csrf;
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(`${API_URL}${path}`, { ...options, credentials: "include", headers, body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) { const error = new Error(data?.message || "Portal request failed"); error.status = response.status; throw error; }
  if (data?.csrfToken) sessionStorage.setItem("innovexPortalCsrf", data.csrfToken);
  return data;
}

export function clearPortalSession() { sessionStorage.removeItem("innovexPortalCsrf"); }

export function downloadUrl(path) {
  return `${API_URL}${path}`;
}

export function publicAssetUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return `${PUBLIC_API_ORIGIN}${path}`;
}

export async function downloadFile(path, filename = "download") {
  const token = getToken();
  const workspaceSlug = getWorkspaceSlug();
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(workspaceSlug ? { "X-Workspace-Slug": workspaceSlug } : {}) }
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "Download failed");
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function protectedBlobUrl(path) {
  const token = getToken();
  const workspaceSlug = getWorkspaceSlug();
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(workspaceSlug ? { "X-Workspace-Slug": workspaceSlug } : {}) }
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.message || "File preview failed");
  }
  return URL.createObjectURL(await response.blob());
}
