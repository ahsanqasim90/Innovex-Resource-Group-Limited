import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { getMeasurementId, trackEvent } from "../utils/analytics.js";
import { storedConsent } from "./CookieConsent.jsx";

function verificationMeta(name, content) {
  if (!content) return;
  let element = document.head.querySelector(`meta[name="${name}"]`);
  if (!element) {
    element = document.createElement("meta");
    element.name = name;
    document.head.appendChild(element);
  }
  element.content = content;
}

export default function SiteIntegrations() {
  const location = useLocation();

  useEffect(() => {
    verificationMeta("google-site-verification", import.meta.env.VITE_GOOGLE_SITE_VERIFICATION?.trim());
    verificationMeta("msvalidate.01", import.meta.env.VITE_BING_SITE_VERIFICATION?.trim());

    function initialiseAnalytics() {
      const id = getMeasurementId();
      if (!id || !storedConsent()?.analytics) return;
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function gtag() { window.dataLayer.push(arguments); };
      window.gtag("consent", "default", { analytics_storage: "denied", ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", wait_for_update: 500 });
      window.gtag("consent", "update", { analytics_storage: "granted" });
      if (document.getElementById("innovex-ga4")) return;

      const script = document.createElement("script");
      script.id = "innovex-ga4";
      script.async = true;
      script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`;
      document.head.appendChild(script);

      window.gtag("js", new Date());
      window.gtag("config", id, { send_page_view: false, anonymize_ip: true, allow_google_signals: false, allow_ad_personalization_signals: false });
    }
    initialiseAnalytics();
    window.addEventListener("innovex:consent", initialiseAnalytics);
    return () => window.removeEventListener("innovex:consent", initialiseAnalytics);
  }, []);

  useEffect(() => {
    trackEvent("page_view", {
      page_path: `${location.pathname}${location.search}`,
      page_title: document.title
    });
  }, [location.pathname, location.search]);

  useEffect(() => {
    function trackContactClick(event) {
      const link = event.target.closest("a");
      if (!link) return;
      const href = link.getAttribute("href") || "";
      const method = href.startsWith("tel:") ? "phone" : href.startsWith("mailto:") ? "email" : /wa\.me/i.test(href) ? "whatsapp" : "";
      if (method) trackEvent("contact_click", { contact_method: method, page_path: window.location.pathname });
    }

    document.addEventListener("click", trackContactClick);
    return () => document.removeEventListener("click", trackContactClick);
  }, []);

  return null;
}
