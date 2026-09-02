import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { company, contact } from "../data/content.js";
import ComplianceBadges from "./ComplianceBadges.jsx";
import SocialLinks from "./SocialLinks.jsx";

const footerGroups = [
  {
    title: "Services",
    links: [
      ["/healthcare-recruitment", "Healthcare recruitment"],
      ["/hire-staff", "Hire staff"],
      ["/website-development", "Website development"],
      ["/seo-services", "SEO services"],
      ["/crm-systems", "CRM systems"],
      ["/courses", "Courses & training"]
    ]
  },
  {
    title: "Resources",
    links: [
      ["/jobs", "Current opportunities"],
      ["/blogs", "Insights & blog"],
      ["/newsletters", "Newsletter"],
      ["/pricing", "CRM pricing"],
      ["/testimonials", "Testimonials"],
      ["/partners", "Partners"]
    ]
  },
  {
    title: "Trust & account",
    links: [
      ["/privacy", "Privacy notice"],
      ["/security", "Security"],
      ["/terms", "Terms"],
      ["/dpa", "DPA"],
      ["/subprocessors", "Subprocessors"],
      ["/status", "System status"],
      ["/support", "Support"],
      ["/admin/login", "Admin login"]
    ]
  }
];

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
        <div className="footer-navigation">
          <div className="footer-navigation-heading">
            <span>EXPLORE INNOVEX</span>
            <h3>Everything in the right place.</h3>
          </div>
          <div className="footer-link-groups">
            {footerGroups.map((group) => (
              <nav className="footer-link-group" aria-label={`${group.title} links`} key={group.title}>
                <h4>{group.title}</h4>
                {group.links.map(([href, label]) => (
                  <Link to={href} key={href}>
                    <span>{label}</span>
                    <ArrowUpRight aria-hidden="true" />
                  </Link>
                ))}
              </nav>
            ))}
          </div>
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
