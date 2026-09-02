import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUpRight, BarChart3, BookOpenCheck, BookOpenText, BrainCircuit, Briefcase, Building2,
  CalendarCheck, CalendarClock, ChevronDown, ChevronRight, ClipboardCheck, DatabaseBackup, FileArchive, FileText,
  GraduationCap, Inbox, KeyRound, LayoutDashboard, Lightbulb, LogOut, MailPlus, MailSearch, Menu, MessageSquare, NotebookPen,
  PanelLeftClose, PanelLeftOpen, PhoneCall, ReceiptPoundSterling, Search, Settings, ShieldCheck,
  Sparkles, Store, Upload, UserCheck, UserCog, UsersRound, X, ServerCog, Workflow
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { canViewFinance, hasPermission } from "../auth/permissions.js";
import { company } from "../data/content.js";
import AdminNotifications from "../components/AdminNotifications.jsx";

const item = (href, label, Icon, permission, options = {}) => ({ href, label, Icon, permission, ...options });

const navigationGroups = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard, items: [item("/admin/dashboard", "Dashboard", LayoutDashboard, "dashboard.view")] },
  {
    id: "recruitment", label: "Recruitment", Icon: UserCheck, items: [
      item("/admin/recruitment-ats", "Recruitment ATS", UserCheck, "recruitmentPipeline.view", { featured: true }),
      item("/admin/automations", "Automations", Workflow, "automations.view"),
      item("/admin/compliance", "Compliance Passport", ShieldCheck, "compliance.view", { featured: true }),
      item("/admin/reports", "Recruitment Analytics", BarChart3, "reports.view"),
      item("/admin/portals", "Candidate & Client Portals", KeyRound, "portals.manage"),
      item("/admin/jobs", "Vacancies", Briefcase, "jobs.view"),
      item("/admin/applications", "Applications", FileText, "applications.view"),
      item("/admin/talent-pool", "Talent Pool", UsersRound, "talentPool.view"),
      item("/admin/cv-library", "CV Library", FileArchive, "candidateCvs.view"),
      item("/admin/cv-uploads", "CV Uploads", Upload, "cvs.view"),
      item("/admin/vacancy-intelligence", "Vacancy Intelligence", BrainCircuit, "vacancyIntelligence.view"),
      item("/admin/candidate-communications", "Candidate Comms", MessageSquare, "talentPool.view"),
      item("/admin/interviews", "Interviews", CalendarCheck, "interviews.view"),
      item("/admin/scheduling", "Self-Scheduling", CalendarClock, "interviews.view")
    ]
  },
  {
    id: "growth", label: "Growth & CRM", Icon: BarChart3, items: [
      item("/admin/organisations", "Organisation 360", Building2, "clients.view", { featured: true }),
      item("/admin/web-leads", "Web Leads CRM", BarChart3, "webLeads.view", { matchPrefix: true }),
      item("/admin/website-enquiries", "Website Enquiries", Inbox, "contacts.view"),
      item("/admin/business-leads", "Business Leads", Store, "businessLeads.view"),
      item("/admin/calls", "Call Centre", PhoneCall, "calls.view"),
      item("/admin/emails", "Email Centre", MailPlus, "emails.view"),
      item("/admin/newsletters", "Newsletter Centre", MailSearch, "newsletters.view"),
      item("/admin/meetings", "Meetings", CalendarClock, "meetings.view"),
      item("/admin/client-terms", "Client Terms", FileText, "terms.view")
    ]
  },
  {
    id: "training", label: "Training", Icon: GraduationCap, items: [
      item("/admin/courses", "Courses", BookOpenCheck, "courses.view"),
      item("/admin/training-bookings", "Bookings", GraduationCap, "trainingBookings.view"),
      item("/admin/training-quotations", "Quotations", NotebookPen, "trainingQuotations.view")
    ]
  },
  {
    id: "operations", label: "People & Finance", Icon: Building2, items: [
      item("/admin/attendance", "Attendance", ClipboardCheck, "attendance.view"),
      item("/admin/finance", "Finance Centre", ReceiptPoundSterling, null, { ownerOnly: true }),
      item("/admin/salary-slips", "Salary Slips", ReceiptPoundSterling, "salarySlips.view"),
      item("/admin/offer-letters", "Offer Letters", FileText, "offerLetters.view"),
      item("/admin/suggestions", "Suggestions Hub", Lightbulb),
      item("/admin/team", "Team Members", UserCog, "team.manage"),
      item("/admin/workspace-settings", "Workspace Settings", Settings, "organization.manage"),
      item("/admin/integrations", "API & Webhooks", ServerCog, "integrations.manage"),
      item("/admin/archive", "Archive & Retention", DatabaseBackup, "archive.manage"),
      item("/admin/operations", "Operations & Audit", ServerCog, "audit.view")
    ]
  },
  {
    id: "content", label: "Website Content", Icon: BookOpenText, items: [
      item("/admin/blogs", "Blogs", BookOpenText, "blogs.view"),
      item("/admin/testimonials", "Testimonials", MessageSquare, "testimonials.view"),
      item("/admin/partners", "Partners", Building2, "partners.view")
    ]
  }
];

function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "IR";
}

function isItemActive(navItem, pathname) {
  if (navItem.matchPrefix) return pathname === navItem.href || pathname.startsWith(`${navItem.href}/`);
  return pathname === navItem.href;
}

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const searchInput = useRef(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem("innovexAdminNavCollapsed") === "true");
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");

  const visibleGroups = useMemo(() => navigationGroups
    .map((group) => ({ ...group, items: group.items.filter((navItem) => (!navItem.ownerOnly || canViewFinance(user)) && hasPermission(user, navItem.permission)) }))
    .filter((group) => group.items.length), [user]);
  const allVisibleItems = useMemo(() => visibleGroups.flatMap((group) => group.items.map((navItem) => ({ ...navItem, groupId: group.id, groupLabel: group.label }))), [visibleGroups]);
  const current = [...allVisibleItems].sort((a, b) => b.href.length - a.href.length).find((navItem) => isItemActive(navItem, location.pathname)) || allVisibleItems[0];
  const currentGroup = visibleGroups.find((group) => group.id === current?.groupId);
  const CurrentIcon = current?.Icon || LayoutDashboard;
  const title = current?.label || "Dashboard";
  const copyLocked = user && !user.canCopyData;
  const [openGroups, setOpenGroups] = useState(() => new Set(["overview", "recruitment"]));

  const results = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return allVisibleItems.slice(0, 7);
    return allVisibleItems.filter((navItem) => `${navItem.label} ${navItem.groupLabel}`.toLowerCase().includes(value)).slice(0, 9);
  }, [allVisibleItems, query]);

  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
    setQuery("");
    if (current?.groupId) setOpenGroups((groups) => new Set([...groups, current.groupId]));
  }, [location.pathname, current?.groupId]);

  useEffect(() => { localStorage.setItem("innovexAdminNavCollapsed", String(collapsed)); }, [collapsed]);

  useEffect(() => {
    const onShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        window.setTimeout(() => searchInput.current?.focus(), 30);
      }
      if (event.key === "Escape") setSearchOpen(false);
    };
    document.addEventListener("keydown", onShortcut);
    return () => document.removeEventListener("keydown", onShortcut);
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event) => event.key === "Escape" && setMenuOpen(false);
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", closeOnEscape); };
  }, [menuOpen]);

  useEffect(() => {
    if (!copyLocked) return undefined;
    const prevent = (event) => event.preventDefault();
    document.addEventListener("copy", prevent);
    document.addEventListener("cut", prevent);
    document.addEventListener("contextmenu", prevent);
    return () => { document.removeEventListener("copy", prevent); document.removeEventListener("cut", prevent); document.removeEventListener("contextmenu", prevent); };
  }, [copyLocked]);

  function toggleGroup(groupId) {
    setOpenGroups((groups) => {
      const next = new Set(groups);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }

  function openSearch() {
    setSearchOpen(true);
    window.setTimeout(() => searchInput.current?.focus(), 30);
  }

  function goTo(navItem) {
    navigate(navItem.href);
    setSearchOpen(false);
    setQuery("");
  }

  return (
    <div className={`admin-shell admin-shell-v2${copyLocked ? " copy-locked" : ""}${menuOpen ? " menu-open" : ""}${collapsed ? " nav-collapsed" : ""}`}>
      <header className="admin-mobile-bar admin-mobile-bar-v2">
        <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open admin navigation" aria-controls="admin-primary-navigation" aria-expanded={menuOpen}><Menu size={21} /></button>
        <span className="admin-mobile-brand"><img src="/Logo.png" alt="" width="36" height="36" /><span><small>Innovex workspace</small><strong>{title}</strong></span></span>
        <span className="admin-mobile-actions"><AdminNotifications /><button type="button" className="admin-mobile-search" onClick={openSearch} aria-label="Search workspace"><Search size={18} /></button></span>
      </header>

      <button className={`admin-sidebar-backdrop${menuOpen ? " visible" : ""}`} type="button" onClick={() => setMenuOpen(false)} aria-label="Close admin navigation" tabIndex={menuOpen ? 0 : -1} />

      <aside id="admin-primary-navigation" className={`admin-sidebar admin-sidebar-v2${menuOpen ? " open" : ""}`} aria-label="Admin navigation">
        <div className="admin-sidebar-inner">
          <div className="admin-brand admin-brand-v2">
            <span className="admin-brand-logo-wrap"><img src="/Logo.png" alt={`${company.name} logo`} className="admin-brand-logo" width="44" height="44" /></span>
            <span className="admin-brand-copy"><small>INNOVEX</small><strong>Workspace</strong></span>
            <button className="admin-menu-toggle mobile-only" type="button" onClick={() => setMenuOpen(false)} aria-label="Close admin menu"><X size={19} /></button>
          </div>

          <button className="admin-nav-search" type="button" onClick={openSearch} title="Search workspace"><Search size={17} /><span>Search workspace</span><kbd>⌘ K</kbd></button>

          <nav className="admin-nav-groups" aria-label="Workspace modules">
            {visibleGroups.map((group) => {
              const groupOpen = !collapsed && openGroups.has(group.id);
              const groupActive = current?.groupId === group.id;
              const GroupIcon = group.Icon;
              return (
                <section className={`admin-nav-group${groupActive ? " current" : ""}`} key={group.id}>
                  <button type="button" className="admin-nav-group-toggle" onClick={() => collapsed ? setCollapsed(false) : toggleGroup(group.id)} aria-expanded={groupOpen} title={collapsed ? group.label : undefined}>
                    <GroupIcon size={17} /><span>{group.label}</span><ChevronDown size={15} className={groupOpen ? "rotated" : ""} />
                  </button>
                  {groupOpen && <div className="admin-nav-group-links">
                    {group.items.map((navItem) => {
                      const NavIcon = navItem.Icon;
                      return <NavLink key={navItem.href} to={navItem.href} end={!navItem.matchPrefix} onClick={() => setMenuOpen(false)} title={collapsed ? navItem.label : undefined} className={navItem.featured ? "featured" : ""}><NavIcon size={17} /><span>{navItem.label}</span>{navItem.featured && <Sparkles size={12} className="admin-nav-spark" />}</NavLink>;
                    })}
                  </div>}
                </section>
              );
            })}
          </nav>

          <div className="admin-sidebar-footer admin-sidebar-footer-v2">
            <div className="admin-user-card"><span className="admin-user-avatar">{initials(user?.name)}</span><span className="admin-user-copy"><strong>{user?.name || "Team member"}</strong><small>{String(user?.role || "employee").replaceAll("_", " ")}</small></span><ShieldCheck size={16} /></div>
            <div className="admin-sidebar-footer-actions">
              <NavLink to="/" title="Open website"><ArrowUpRight size={17} /><span>Website</span></NavLink>
              {hasPermission(user, "team.manage") && <button type="button" title="Settings" onClick={() => navigate("/admin/team")}><Settings size={17} /><span>Settings</span></button>}
              <button type="button" title="Log out" onClick={() => { logout(); navigate("/admin/login"); }}><LogOut size={17} /><span>Log out</span></button>
            </div>
          </div>
        </div>
        <button className="admin-collapse-control" type="button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}>{collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button>
      </aside>

      <main className="admin-main admin-main-v2">
        <header className="admin-command-bar admin-command-bar-v2">
          <div className="admin-command-title"><div className="admin-breadcrumbs"><span>Workspace</span><ChevronRight size={13} /><span>{currentGroup?.label || "Overview"}</span></div><h1><span className="admin-page-icon"><CurrentIcon size={20} /></span>{title}</h1></div>
          <button className="admin-command-search" type="button" onClick={openSearch}><Search size={17} /><span>Search workspace modules...</span><kbd>Ctrl K</kbd></button>
          <div className="admin-command-user"><AdminNotifications /><div><span>{new Date().toLocaleDateString("en-GB", { weekday: "long" })}</span><strong>{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</strong></div><span className="admin-user-avatar small">{initials(user?.name)}</span></div>
        </header>
        <section className="admin-content admin-content-v2"><Outlet /></section>
      </main>

      {searchOpen && <div className="admin-command-palette-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && setSearchOpen(false)}>
        <section className="admin-command-palette" role="dialog" aria-modal="true" aria-label="Search workspace">
          <header><Search size={20} /><input ref={searchInput} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search workspace modules..." /><button type="button" onClick={() => setSearchOpen(false)} aria-label="Close search"><X size={18} /></button></header>
          <div className="admin-command-results"><span className="admin-command-results-label">{query ? "Search results" : "Quick access"}</span>{results.map((navItem) => { const ResultIcon = navItem.Icon; return <button type="button" key={navItem.href} onClick={() => goTo(navItem)}><span className="admin-command-result-icon"><ResultIcon size={18} /></span><span><strong>{navItem.label}</strong><small>{navItem.groupLabel}</small></span><ChevronRight size={16} /></button>; })}{!results.length && <div className="admin-command-empty"><Search size={24} /><strong>No matching module</strong><span>Try a different keyword.</span></div>}</div>
          <footer><span><kbd>↑</kbd><kbd>↓</kbd> navigate</span><span><kbd>esc</kbd> close</span></footer>
        </section>
      </div>}
    </div>
  );
}
