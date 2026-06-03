import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, publicAssetUrl } from "../api/client.js";
import SEO from "../components/SEO.jsx";
import SectionHeading from "../components/SectionHeading.jsx";

export default function Partners() {
  const [partners, setPartners] = useState([]);
  useEffect(() => {
    api("/partners").then(setPartners).catch(() => {});
  }, []);
  return (
    <section className="section">
      <SEO title="Partners" path="/partners" description="View Innovex Resource Group Limited partners and learn how care providers and businesses can partner with us across recruitment and digital services." />
      <SectionHeading eyebrow="Our Partners" title="Care-sector partnerships that support reliable staffing" />
      <div className="card-grid">
        {partners.map((partner) => (
          <article className="card partner-card" key={partner._id}>
            <div className="partner-logo-wrap">
              {partner.logo?.url ? (
                <img src={publicAssetUrl(partner.logo.url)} alt={`${partner.name} logo`} className="partner-logo" loading="lazy" width="180" height="74" />
              ) : (
                <span className="partner-logo-fallback">{partner.name?.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div className="badge">{partner.location}</div>
            <h3>{partner.name}</h3>
            <p>{partner.serviceProvided}</p>
          </article>
        ))}
      </div>
      <article className="card" style={{ marginTop: 24 }}>
        <h2>Become a Partner</h2>
        <p>Work with Innovex for compliant recruitment, temporary staffing, permanent placements, and specialist care-sector support.</p>
        <Link className="button" to="/contact">Start a Partnership</Link>
      </article>
    </section>
  );
}
