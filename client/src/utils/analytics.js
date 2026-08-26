const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID?.trim();

export function analyticsEnabled() {
  return Boolean(measurementId && /^G-[A-Z0-9]+$/i.test(measurementId));
}

export function getMeasurementId() {
  return analyticsEnabled() ? measurementId : "";
}

export function trackEvent(name, parameters = {}) {
  if (!analyticsEnabled() || typeof window.gtag !== "function") return;

  const safeParameters = Object.fromEntries(
    Object.entries(parameters)
      .filter(([key, value]) => !/(email|phone|name|message|address|subject|cv|salary)/i.test(key) && ["string", "number", "boolean"].includes(typeof value))
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 100) : value])
  );

  window.gtag("event", name, safeParameters);
}
