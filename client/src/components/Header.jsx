import { ChevronDown, LockKeyhole, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { company } from "../data/content.js";

const links = [
  ["/jobs", "Find a job"],
  ["/about", "About"],
  ["/blogs", "Insights"]
];
const services = [["/healthcare-recruitment", "Recruitment"], ["/courses", "Training"], ["/website-development", "Website development"], ["/seo-services", "SEO"], ["/crm-systems", "CRM systems"], ["/services", "All services"]];

export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const [servicesOpen, setServicesOpen] = useState(false);

  useEffect(() => {
    setOpen(false); setServicesOpen(false);
  }, [pathname]);

  useEffect(() => {
    const close = (event) => { if (event.key === "Escape") { setOpen(false); setServicesOpen(false); } };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, []);

  return (
    <header className="site-header innovex-public-header">
      <Link className="brand" to="/" aria-label="Innovex home">
        <img src="/Logo.png" alt="Innovex Resource Group Limited logo" className="brand-logo" width="56" height="56" fetchPriority="high" />
        <span className="innovex-public-brand-name">{company.name}</span>
      </Link>
      <button
        className="menu-button"
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-controls="primary-navigation"
        aria-expanded={open}
      >
        {open ? <X /> : <Menu />}
      </button>
      <nav id="primary-navigation" className={`nav innovex-public-nav ${open ? "open" : ""}`}>
        <div className="public-services-menu" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setServicesOpen(false); }}><button type="button" aria-expanded={servicesOpen} aria-controls="public-service-links" onClick={() => setServicesOpen(!servicesOpen)}>Services <ChevronDown size={14} /></button>{servicesOpen && <div id="public-service-links">{services.map(([href, label]) => <Link to={href} key={href} onClick={() => { setServicesOpen(false); setOpen(false); }}>{label}</Link>)}</div>}</div>
        {links.map(([href, label]) => (
          <NavLink key={href} to={href} end={href === "/"} onClick={() => setOpen(false)}>
            {label}
          </NavLink>
        ))}
        <div className="nav-actions">
          <Link className="button small header-hire-button" to="/contact" onClick={() => setOpen(false)}>
            Discuss your requirements
          </Link>
          <Link className="admin-login-link" to="/portal/login" onClick={() => setOpen(false)}>
            <LockKeyhole size={15} /> Portal
          </Link>

        </div>
      </nav>
    </header>
  );
}
