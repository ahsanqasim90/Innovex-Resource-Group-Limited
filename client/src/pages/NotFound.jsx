import { Link } from "react-router-dom";
import SEO from "../components/SEO.jsx";

export default function NotFound() {
  return (
    <section className="section not-found-page">
      <SEO
        title="Page not found"
        description="The requested page could not be found on the Innovex Resource Group website."
        path={window.location.pathname}
        noIndex
      />
      <span className="eyebrow">404 — Page not found</span>
      <h1>That page is not available.</h1>
      <p>The address may be incorrect or the page may have moved. Choose the Innovex service you need below.</p>
      <div className="actions">
        <Link className="button" to="/hire-staff">Hire healthcare staff</Link>
        <Link className="button secondary" to="/website-development">Digital services</Link>
        <Link className="button secondary" to="/courses">Courses & training</Link>
        <Link className="text-link" to="/">Return home</Link>
      </div>
    </section>
  );
}
