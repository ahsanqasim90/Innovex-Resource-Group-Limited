import { useEffect } from "react";
import { ArrowUpRight, BookOpenCheck, BookOpenText, Briefcase, Building2, CalendarCheck, CalendarClock, FileText, GraduationCap, LayoutDashboard, LogOut, MessageSquare, PhoneCall, ShieldCheck, Store, Upload, UserCog, UsersRound } from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { hasPermission } from "../auth/permissions.js";

const links = [
  ["/admin/dashboard", "Dashboard", LayoutDashboard, "dashboard.view"],
  ["/admin/jobs", "Jobs", Briefcase, "jobs.view"],
  ["/admin/applications", "Applications", FileText, "applications.view"],
  ["/admin/cv-uploads", "CV Uploads", Upload, "cvs.view"],
  ["/admin/talent-pool", "Talent Pool", UsersRound, "talentPool.view"],
  ["/admin/business-leads", "Business Leads", Store, "businessLeads.view"],
  ["/admin/calls", "Call Centre", PhoneCall, "calls.view"],
  ["/admin/interviews", "Interviews", CalendarCheck, "interviews.view"],
  ["/admin/meetings", "Meetings", CalendarClock, "meetings.view"],
  ["/admin/courses", "Courses", BookOpenCheck, "courses.view"],
  ["/admin/training-bookings", "Training Bookings", GraduationCap, "trainingBookings.view"],
  ["/admin/blogs", "Blogs", BookOpenText, "blogs.view"],
  ["/admin/testimonials", "Testimonials", MessageSquare, "testimonials.view"],
  ["/admin/partners", "Partners", Building2, "partners.view"],
  ["/admin/team", "Team Members", UserCog, "team.manage"]
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const visibleLinks = links.filter(([, , , permission]) => hasPermission(user, permission));
  const current = visibleLinks.find(([href]) => location.pathname.startsWith(href)) || links.find(([href]) => location.pathname.startsWith(href));
  const CurrentIcon = current?.[2] || LayoutDashboard;
  const title = current?.[1] || "Dashboard";
  const copyLocked = user && !user.canCopyData;

  useEffect(() => {
    if (!copyLocked) return undefined;
    const prevent = (event) => event.preventDefault();
    document.addEventListener("copy", prevent);
    document.addEventListener("cut", prevent);
    document.addEventListener("contextmenu", prevent);
    return () => {
      document.removeEventListener("copy", prevent);
      document.removeEventListener("cut", prevent);
      document.removeEventListener("contextmenu", prevent);
    };
  }, [copyLocked]);

  return (
    <div className={`admin-shell${copyLocked ? " copy-locked" : ""}`}>
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
            {visibleLinks.map(([href, label, Icon]) => (
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
                <span>{copyLocked ? "Copy restricted account" : "Protected business data"}</span>
              </div>
            </div>
            <NavLink className="admin-website-link" to="/">
              <ArrowUpRight size={18} /> Move to Website
            </NavLink>
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
