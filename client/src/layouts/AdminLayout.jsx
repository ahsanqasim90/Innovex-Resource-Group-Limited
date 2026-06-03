import { Briefcase, Building2, FileText, LayoutDashboard, LogOut, MessageSquare, Upload } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const links = [
  ["/admin/dashboard", "Dashboard", LayoutDashboard],
  ["/admin/jobs", "Jobs", Briefcase],
  ["/admin/applications", "Applications", FileText],
  ["/admin/cv-uploads", "CV Uploads", Upload],
  ["/admin/testimonials", "Testimonials", MessageSquare],
  ["/admin/partners", "Partners", Building2]
];

export default function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="brand admin-brand"><span className="brand-mark">IR</span> Innovex Admin</div>
        {links.map(([href, label, Icon]) => (
          <NavLink key={href} to={href}>
            <Icon size={18} /> {label}
          </NavLink>
        ))}
        <button
          className="ghost"
          onClick={() => {
            logout();
            navigate("/admin/login");
          }}
        >
          <LogOut size={18} /> Logout
        </button>
      </aside>
      <section className="admin-content">
        <Outlet />
      </section>
    </div>
  );
}
