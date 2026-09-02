const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();

export function analyticsEnabled() {
  return Boolean(measurementId && /^G-[A-Z0-9]+$/i.test(measurementId));
}

export function getMeasurementId() {
  return analyticsEnabled() ? measurementId : "";
}

export function trackEvent(name, parameters = {}) {
  let consent = null;
  try { consent = JSON.parse(localStorage.getItem("innovexCookieConsentV1")); } catch {}
  if (!analyticsEnabled() || !consent?.analytics || typeof window.gtag !== "function") return;

  const safeParameters = Object.fromEntries(
    Object.entries(parameters)
      .filter(([key, value]) => !/(email|phone|name|message|address|subject|cv|salary)/i.test(key) && ["string", "number", "boolean"].includes(typeof value))
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 100) : value])
  );

  window.gtag("event", name, safeParameters);
}
