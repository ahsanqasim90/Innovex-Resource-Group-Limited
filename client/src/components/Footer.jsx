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
          <p>Innovex Resource Group supports UK employers with healthcare recruitment, businesses worldwide with website development and SEO, and care organisations with professional training enquiries.</p>
          <ComplianceBadges compact />
        </div>
        <div className="footer-links">
          <h3>Quick links</h3>
          <Link to="/jobs">Current opportunities</Link>
          <Link to="/healthcare-recruitment">Healthcare recruitment</Link>
          <Link to="/hire-staff">Hire staff / request candidates</Link>
          <Link to="/website-development">Website development</Link>
          <Link to="/seo-services">SEO services</Link>
          <Link to="/crm-systems">CRM systems</Link>
          <Link to="/courses">Courses & training</Link>
          <Link to="/blogs">Insights & blog</Link>
          <Link to="/newsletters">Newsletter</Link>
          <Link to="/privacy">Privacy notice</Link>
          <Link to="/security">Security</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/dpa">DPA</Link>
          <Link to="/subprocessors">Subprocessors</Link>
          <Link to="/status">Status</Link>
          <Link to="/support">Support</Link>
          <Link to="/pricing">CRM pricing</Link>
          <Link to="/testimonials">Testimonials</Link>
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
        <span>Registered in {company.registeredIn} · Company no. {company.companyNumber} · Registered office: {contact.address}</span>
      </div>
    </footer>
  );
}
