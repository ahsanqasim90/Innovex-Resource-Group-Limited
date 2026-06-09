const API_URL = import.meta.env.VITE_API_URL || "/api";
const PUBLIC_API_ORIGIN = API_URL.startsWith("http") ? API_URL.replace(/\/api\/?$/, "") : "";

export function getToken() {
  return localStorage.getItem("innovexToken");
}

export function setToken(token) {
  if (token) localStorage.setItem("innovexToken", token);
  else localStorage.removeItem("innovexToken");
}

export async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (options.body && !(options.body instanceof FormData)) headers["Content-Type"] = "application/json";

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    body: options.body instanceof FormData ? options.body : options.body ? JSON.stringify(options.body) : undefined
  });

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    if (response.status === 401) {
      setToken(null);
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
  const response = await fetch(`${API_URL}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
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
