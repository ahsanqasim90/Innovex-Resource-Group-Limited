import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Chatbot from "../components/Chatbot.jsx";
import Footer from "../components/Footer.jsx";
import Header from "../components/Header.jsx";
import SiteIntegrations from "../components/SiteIntegrations.jsx";
import CookieConsent from "../components/CookieConsent.jsx";

export default function AppLayout() {
  const { pathname, search, hash } = useLocation();

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
      <Chatbot />
      <CookieConsent />
    </>
  );
}
