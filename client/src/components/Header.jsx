import { LockKeyhole, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { company } from "../data/content.js";

const links = [
  ["/healthcare-recruitment", "Recruitment"],
  ["/courses", "Training"],
  ["/services", "Digital & SEO"],
  ["/jobs", "Jobs"],
  ["/blogs", "Insights"],
  ["/about", "About"],
  ["/contact", "Contact"]
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

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
        {links.map(([href, label]) => (
          <NavLink key={href} to={href} end={href === "/"} onClick={() => setOpen(false)}>
            {label}
          </NavLink>
        ))}
        <div className="nav-actions">
          <Link className="button small header-hire-button" to="/hire-staff" onClick={() => setOpen(false)}>
            Hire Staff
          </Link>
          <Link className="admin-login-link" to="/portal/login" onClick={() => setOpen(false)}>
            <LockKeyhole size={15} /> Portal
          </Link>
          <Link className="button small header-upload-button" to="/upload-cv" onClick={() => setOpen(false)}>
            Upload CV
          </Link>
        </div>
      </nav>
    </header>
  );
}
