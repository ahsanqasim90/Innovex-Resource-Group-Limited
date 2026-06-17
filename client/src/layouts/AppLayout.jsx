import { Outlet } from "react-router-dom";
import Chatbot from "../components/Chatbot.jsx";
import Footer from "../components/Footer.jsx";
import Header from "../components/Header.jsx";

export default function AppLayout() {
  return (
    <>
      <Header />
      <main>
        <Outlet />
      </main>
      <Footer />
      <Chatbot />
    </>
  );
}
