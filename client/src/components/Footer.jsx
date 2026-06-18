import { Link } from "react-router-dom";
import { company, contact } from "../data/content.js";
import ComplianceBadges from "./ComplianceBadges.jsx";
import SocialLinks from "./SocialLinks.jsx";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="footer-wrap">
      <div className="footer">
        <div className="footer-brand">
          <div className="brand footer-logo">
            <img src="/Logo.png" alt="Innovex Resource Group Limited logo" className="brand-logo" width="58" height="58" loading="lazy" />
            <h2>{company.name}</h2>
          </div>
          <p>Innovex Resource Group provides recruitment, website development and SEO services for UK businesses, with specialist recruitment support across healthcare, social care, nursing and children's residential services.</p>
          <ComplianceBadges compact />
        </div>
        <div className="footer-links">
          <h3>Quick links</h3>
          <Link to="/jobs">Current opportunities</Link>
          <Link to="/services">Services</Link>
          <Link to="/courses">Healthcare courses</Link>
          <Link to="/blogs">Insights & blog</Link>
          <Link to="/partners">Partners</Link>
          <Link to="/admin/login">Admin login</Link>
        </div>
        <div className="footer-contact">
          <h3>Contact</h3>
          <a href={`mailto:${contact.email}`}>{contact.email}</a>
          <a href={contact.whatsappUrl} target="_blank" rel="noreferrer">{contact.phoneDisplay}</a>
          <p>{contact.address}</p>
          <p>{contact.hours}</p>
          <SocialLinks />
        </div>
      </div>
      <div className="footer-bottom">
        <span>{`Copyright \u00a9 ${year} ${company.name}. All rights reserved.`}</span>
        <span>Designed and developed by {company.name}.</span>
      </div>
    </footer>
  );
}
