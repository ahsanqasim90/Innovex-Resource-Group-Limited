import { BookOpenText, Briefcase, Building2, CalendarCheck, CalendarClock, FileText, LayoutDashboard, LogOut, MessageSquare, ShieldCheck, Upload } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

const links = [
  ["/admin/dashboard", "Dashboard", LayoutDashboard],
  ["/admin/jobs", "Jobs", Briefcase],
  ["/admin/applications", "Applications", FileText],
  ["/admin/cv-uploads", "CV Uploads", Upload],
  ["/admin/interviews", "Interviews", CalendarCheck],
  ["/admin/meetings", "Meetings", CalendarClock],
  ["/admin/blogs", "Blogs", BookOpenText],
  ["/admin/testimonials", "Testimonials", MessageSquare],
  ["/admin/partners", "Partners", Building2]
];

export default function AdminLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const current = links.find(([href]) => location.pathname.startsWith(href));
  const CurrentIcon = current?.[2] || LayoutDashboard;
  const title = current?.[1] || "Dashboard";

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <div className="admin-sidebar-inner">
          <div className="brand admin-brand">
            <span className="brand-mark">IR</span>
            <span>
              <strong>Innovex Admin</strong>
              <small>Operations centre</small>
            </span>
          </div>
          <div className="admin-nav-label">Workspace</div>
          <nav className="admin-nav">
            {links.map(([href, label, Icon]) => (
              <NavLink key={href} to={href}>
                <Icon size={18} /> {label}
              </NavLink>
            ))}
          </nav>
          <div className="admin-sidebar-footer">
            <div className="admin-sidebar-card">
              <ShieldCheck size={20} />
              <div>
                <strong>Secure admin</strong>
                <span>Protected business data</span>
              </div>
            </div>
            <button
              className="ghost admin-logout"
              onClick={() => {
                logout();
                navigate("/admin/login");
              }}
            >
              <LogOut size={18} /> Logout
            </button>
          </div>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-command-bar">
          <div>
            <span className="admin-command-eyebrow">Innovex Resource Group Limited</span>
            <h1><CurrentIcon size={26} /> {title}</h1>
          </div>
          <div className="admin-command-meta">
            <span>Live admin</span>
            <strong>{new Date().toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })}</strong>
          </div>
        </header>
        <section className="admin-content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}
