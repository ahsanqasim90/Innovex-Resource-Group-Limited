import { Link } from "react-router-dom";
import { publicAssetUrl } from "../api/client.js";

function LogoTile({ partner }) {
  return (
    <div className="partner-slider-tile">
      {partner.logo?.url ? (
        <img src={publicAssetUrl(partner.logo.url)} alt={`${partner.name} logo`} loading="lazy" />
      ) : (
        <span>{partner.name?.slice(0, 2).toUpperCase()}</span>
      )}
      <strong>{partner.name}</strong>
    </div>
  );
}

export default function PartnerLogoSlider({ partners = [] }) {
  const visiblePartners = partners.filter(Boolean);
  if (!visiblePartners.length) return null;
  const trackPartners = [...visiblePartners, ...visiblePartners];

  return (
    <section className="partner-slider-section" aria-label="Innovex partner logos">
      <div className="partner-slider-heading">
        <span className="eyebrow">Trusted partners</span>
        <h2>Care providers and organisations working with Innovex</h2>
        <p>Supporting care providers, candidates and businesses across the UK through recruitment, website development and SEO.</p>
      </div>
      <Link className="partner-slider" to="/partners" aria-label="View all Innovex partners">
        <div className="partner-slider-track">
          {trackPartners.map((partner, index) => <LogoTile key={`${partner._id}-${index}`} partner={partner} />)}
        </div>
      </Link>
    </section>
  );
}
