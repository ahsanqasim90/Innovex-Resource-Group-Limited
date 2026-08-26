import { Outlet } from "react-router-dom";
import Chatbot from "../components/Chatbot.jsx";
import Footer from "../components/Footer.jsx";
import Header from "../components/Header.jsx";
import SiteIntegrations from "../components/SiteIntegrations.jsx";

export default function AppLayout() {
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
    </>
  );
}
