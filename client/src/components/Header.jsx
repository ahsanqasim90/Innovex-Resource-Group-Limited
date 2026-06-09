import { LockKeyhole, Menu, X } from "lucide-react";
import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { company } from "../data/content.js";

const links = [
  ["/", "Home"],
  ["/about", "About"],
  ["/services", "Services"],
  ["/jobs", "Jobs"],
  ["/blogs", "Blogs"],
  ["/testimonials", "Testimonials"],
  ["/partners", "Partners"],
  ["/contact", "Contact"]
];

export default function Header() {
  const [open, setOpen] = useState(false);
  return (
    <header className="site-header">
      <Link className="brand" to="/" aria-label="Innovex home">
        <img src="/Logo.png" alt="Innovex Resource Group Limited logo" className="brand-logo" width="56" height="56" fetchPriority="high" />
        <span>{company.name}</span>
      </Link>
      <button className="menu-button" onClick={() => setOpen(!open)} aria-label="Toggle navigation">
        {open ? <X /> : <Menu />}
      </button>
      <nav className={`nav ${open ? "open" : ""}`}>
        {links.map(([href, label]) => (
          <NavLink key={href} to={href} onClick={() => setOpen(false)}>
            {label}
          </NavLink>
        ))}
        <div className="nav-actions">
          <Link className="admin-login-link" to="/admin/login" onClick={() => setOpen(false)}>
            <LockKeyhole size={15} /> Admin Login
          </Link>
          <Link className="button small header-upload-button" to="/upload-cv" onClick={() => setOpen(false)}>
            Upload CV
          </Link>
        </div>
      </nav>
    </header>
  );
}
