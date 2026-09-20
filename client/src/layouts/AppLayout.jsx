import { lazy, Suspense, useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Footer from "../components/Footer.jsx";
import Header from "../components/Header.jsx";
import SiteIntegrations from "../components/SiteIntegrations.jsx";
import CookieConsent from "../components/CookieConsent.jsx";
import "../styles/public-enterprise.css";

const Chatbot = lazy(() => import("../components/Chatbot.jsx"));

export default function AppLayout() {
  const { pathname, search, hash } = useLocation();
  const [assistantReady, setAssistantReady] = useState(false);

  useEffect(() => {
    const showAssistant = () => setAssistantReady(true);
    if ("requestIdleCallback" in window) {
      const idleId = window.requestIdleCallback(showAssistant, { timeout: 1800 });
      return () => window.cancelIdleCallback(idleId);
    }
    const timer = window.setTimeout(showAssistant, 900);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (hash) {
        const target = document.getElementById(decodeURIComponent(hash.slice(1)));
        if (target) {
          target.scrollIntoView({ block: "start" });
          return;
        }
      }
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [pathname, search, hash]);

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <SiteIntegrations />
      <Header />
      <main id="main-content">
        <Outlet />
      </main>
      <Footer />
      {assistantReady && <Suspense fallback={null}><Chatbot /></Suspense>}
      <CookieConsent />
    </>
  );
}
