export function readPreference(key, fallback) {
  try { const value = JSON.parse(localStorage.getItem(key)); return value !== null && typeof value === typeof fallback ? value : fallback; }
  catch { return fallback; }
}
export function writePreference(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Workspace remains usable when storage is unavailable. */ }
}
