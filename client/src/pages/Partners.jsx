import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, publicAssetUrl } from "../api/client.js";
import SEO from "../components/SEO.jsx";
import SectionHeading from "../components/SectionHeading.jsx";

export default function Partners() {
  const [partners, setPartners] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api("/partners")
      .then(setPartners)
      .catch(() => setPartners([]))
      .finally(() => setLoading(false));
  }, []);
  return (
    <section className="section">
      <SEO title="Partners" path="/partners" description="View Innovex Resource Group Limited partners and learn how care providers and businesses can partner with us across recruitment and digital services." />
      <div className="partners-hero">
        <SectionHeading as="h1" eyebrow="Our Partners" title="Professional partnerships built on trust">
          We work with care providers and growing organisations that value reliable communication, ethical recruitment, and long-term support.
        </SectionHeading>
        <div className="partners-stat-card">
          <strong>{partners.length}+</strong>
          <span>active partner relationships</span>
        </div>
      </div>
      {loading ? (
        <div className="partners-grid">
          {[1, 2, 3].map((item) => (
            <article className="partner-card partner-skeleton" key={item} aria-hidden="true">
              <div className="skeleton-block" />
              <div className="skeleton-line short" />
              <div className="skeleton-line title" />
              <div className="skeleton-line" />
            </article>
          ))}
        </div>
      ) : partners.length > 0 ? (
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
      ) : (
        <article className="card empty-state-card">
          <h2>Partner profiles are being updated</h2>
          <p>Innovex works with care providers and growing organisations across recruitment, websites and SEO. Speak to us about becoming a partner.</p>
          <Link className="button" to="/contact">Start a Partnership</Link>
        </article>
      )}
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
