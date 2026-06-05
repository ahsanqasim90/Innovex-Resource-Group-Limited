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
      <div className="partners-hero">
        <SectionHeading eyebrow="Our Partners" title="Professional partnerships built on trust">
          We work with care providers and growing organisations that value reliable communication, ethical recruitment, and long-term support.
        </SectionHeading>
        <div className="partners-stat-card">
          <strong>{partners.length}+</strong>
          <span>active partner relationships</span>
        </div>
      </div>
      <div className="partners-grid">
        {partners.map((partner) => (
          <article className="partner-card" key={partner._id}>
            <div className="partner-logo-wrap">
              {partner.logo?.url ? (
                <img src={publicAssetUrl(partner.logo.url)} alt={`${partner.name} logo`} className="partner-logo" loading="lazy" width="180" height="74" />
              ) : (
                <span className="partner-logo-fallback">{partner.name?.slice(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div className="partner-card-body">
              <span className="partner-location">{partner.location}</span>
              <h3>{partner.name}</h3>
              <p>{partner.serviceProvided}</p>
            </div>
          </article>
        ))}
      </div>
      <article className="partner-cta-card">
        <div>
          <span className="eyebrow">Work with Innovex</span>
          <h2>Become a Partner</h2>
          <p>Work with Innovex for compliant recruitment, temporary staffing, permanent placements, website support, SEO, and specialist care-sector services.</p>
        </div>
        <Link className="button" to="/contact">Start a Partnership</Link>
      </article>
    </section>
  );
}
