import { useEffect, useMemo, useState } from "react";
import {
  ArrowUpRight, BarChart3, BookOpenCheck, BookOpenText, BrainCircuit, Briefcase, Building2,
  CalendarCheck, CalendarClock, ChevronDown, ChevronRight, ClipboardCheck, DatabaseBackup, FileArchive, FileText,
  GraduationCap, Inbox, KeyRound, LayoutDashboard, Lightbulb, LogOut, MailPlus, MailSearch, Megaphone, Menu, MessageSquare, NotebookPen,
  PanelLeftClose, PanelLeftOpen, PhoneCall, ReceiptPoundSterling, Search, SearchCheck, Settings, ShieldCheck,
  Star, ListTodo, AlignJustify, Store, Upload, UserCheck, UserCog, UsersRound, X, ServerCog, Workflow
} from "lucide-react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { canViewFinance, hasPermission } from "../auth/permissions.js";
import { company } from "../data/content.js";
import AdminNotifications from "../components/AdminNotifications.jsx";
import { useAdminBadges } from "../hooks/useAdminBadges.js";
import AdminCommandPalette from "../components/AdminCommandPalette.jsx";
import AdminErrorBoundary from "../components/AdminErrorBoundary.jsx";
import { readPreference, writePreference } from "../utils/workspacePreferences.js";
import "../styles/workspace-polish.css";
import "../styles/admin-premium.css";

const item = (href, label, Icon, permission, options = {}) => ({ href, label, Icon, permission, ...options });

const navigationGroups = [
  { id: "overview", label: "Overview", Icon: LayoutDashboard, items: [item("/admin/dashboard", "Dashboard", LayoutDashboard, "dashboard.view"), item("/admin/tasks", "Team tasks", ListTodo, "automations.view")] },
  {
    id: "recruitment", label: "Recruitment", Icon: UserCheck, items: [
      item("/admin/recruitment-ats", "Recruitment ATS", UserCheck, "recruitmentPipeline.view", { featured: true }),
      item("/admin/automations", "Automations", Workflow, "automations.view"),
      item("/admin/compliance", "Compliance Passport", ShieldCheck, "compliance.view", { featured: true }),
      item("/admin/reports", "Recruitment Analytics", BarChart3, "reports.view"),
      item("/admin/portals", "External Portals", KeyRound, "portals.manage"),
      item("/admin/jobs", "Vacancies", Briefcase, "jobs.view"),
      item("/admin/applications", "Applications", FileText, "applications.view"),
      item("/admin/talent-pool", "Talent Pool", UsersRound, "talentPool.view"),
      item("/admin/cv-library", "CV Library", FileArchive, "candidateCvs.view"),
      item("/admin/cv-uploads", "CV Uploads", Upload, "cvs.view"),
      item("/admin/vacancy-intelligence", "Vacancy Intelligence", BrainCircuit, "vacancyIntelligence.view"),
      item("/admin/candidate-match", "CV to Vacancy Match", SearchCheck, "vacancyIntelligence.view"),
      item("/admin/social-posting", "Social Posting", Megaphone, "jobs.approve"),
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

// Sidebar sections that show a WhatsApp-style count of new items.
const badgeSections = [
  { key: "website-enquiries", href: "/admin/website-enquiries", label: "Website Enquiries" },
  { key: "applications", href: "/admin/applications", label: "Applications" },
  { key: "cv-uploads", href: "/admin/cv-uploads", label: "CV Uploads" },
  { key: "training-bookings", href: "/admin/training-bookings", label: "Training Bookings" },
  { key: "training-quotations", href: "/admin/training-quotations", label: "Training Quotations" }
];
const badgeKeyByHref = Object.fromEntries(badgeSections.map((section) => [section.href, section.key]));

function BadgeCount({ value }) {
  if (!value) return null;
  return <b className="admin-nav-badge" aria-label={`${value} new`}>{value > 99 ? "99+" : value}</b>;
}

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
  const preferenceKey = `innovex.workspace.${user?.organizationId || "default"}.${user?.id || "guest"}`;
  const [preferences, setPreferences] = useState(() => readPreference(preferenceKey, { pins: [], recent: [], compact: false }));
  const pins = Array.isArray(preferences.pins) ? preferences.pins : [];
  const recent = Array.isArray(preferences.recent) ? preferences.recent : [];
  const compact = preferences.compact === true;
  useEffect(() => { writePreference(preferenceKey, preferences); }, [preferenceKey, preferences]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => readPreference("innovexAdminNavCollapsed", false) === true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);

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
  const { counts: badgeCounts } = useAdminBadges({ enabled: Boolean(user), pathname: location.pathname, sections: badgeSections });
  const badgeFor = (navItem) => badgeCounts[badgeKeyByHref[navItem.href]] || 0;


  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
    setPreferences((previous) => ({ ...previous, recent: [location.pathname, ...(Array.isArray(previous.recent) ? previous.recent : []).filter((href) => href !== location.pathname)].slice(0, 8) }));
    if (current?.groupId) setOpenGroups((groups) => new Set([...groups, current.groupId]));
  }, [location.pathname, current?.groupId]);

  useEffect(() => { writePreference("innovexAdminNavCollapsed", collapsed); }, [collapsed]);

  useEffect(() => {
    const onShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
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
  }

  function goTo(navItem) {
    navigate(navItem.href);
    setSearchOpen(false);
  }

  return (
    <div className={`admin-shell admin-shell-v2${copyLocked ? " copy-locked" : ""}${menuOpen ? " menu-open" : ""}${collapsed ? " nav-collapsed" : ""}${compact ? " workspace-compact" : ""}`}>
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

          <button className="admin-nav-search" type="button" onClick={openSearch} title="Search workspace"><Search size={17} /><span>Search workspace</span><kbd>Ctrl K</kbd></button>

          <nav className="admin-nav-groups" aria-label="Workspace modules">
            {!collapsed && pins.some((href) => allVisibleItems.some((item) => item.href === href)) && <section className="admin-pinned-links"><span>Pinned modules</span>{pins.map((href) => allVisibleItems.find((item) => item.href === href)).filter(Boolean).map((item) => <NavLink to={item.href} key={item.href}><Star size={14} /><span>{item.label}</span></NavLink>)}</section>}
            {visibleGroups.map((group) => {
              const groupOpen = !collapsed && openGroups.has(group.id);
              const groupActive = current?.groupId === group.id;
              const GroupIcon = group.Icon;
              return (
                <section className={`admin-nav-group${groupActive ? " current" : ""}`} data-group={group.id} key={group.id}>
                  <button type="button" className="admin-nav-group-toggle" onClick={() => { if (collapsed) { setCollapsed(false); setOpenGroups((groups) => new Set([...groups, group.id])); } else toggleGroup(group.id); }} aria-expanded={groupOpen} title={collapsed ? group.label : undefined}>
                    <GroupIcon size={17} /><span>{group.label}</span>{!groupOpen && <BadgeCount value={group.items.reduce((sum, navItem) => sum + badgeFor(navItem), 0)} />}<ChevronDown size={15} className={groupOpen ? "rotated" : ""} />
                  </button>
                  {groupOpen && <div className="admin-nav-group-links">
                    {group.items.map((navItem) => {
                      const NavIcon = navItem.Icon;
                      return <NavLink key={navItem.href} to={navItem.href} end={!navItem.matchPrefix} onClick={() => setMenuOpen(false)} title={collapsed ? navItem.label : undefined} className={navItem.featured ? "featured" : ""}><NavIcon size={17} /><span>{navItem.label}</span><BadgeCount value={badgeFor(navItem)} /></NavLink>;
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
              {hasPermission(user, "organization.manage") && <button type="button" title="Workspace settings" onClick={() => navigate("/admin/workspace-settings")}><Settings size={17} /><span>Settings</span></button>}
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
          <div className="admin-command-user"><span className={`admin-live-state ${online ? "online" : "offline"}`}><i />{online ? "Live" : "Offline"}</span><button className="workspace-icon-button" aria-label={pins.includes(current?.href) ? "Unpin current module" : "Pin current module"} aria-pressed={pins.includes(current?.href)} onClick={() => current && setPreferences((previous) => ({ ...previous, pins: pins.includes(current.href) ? pins.filter((href) => href !== current.href) : [...pins, current.href].slice(-8) }))}><Star size={18} /></button><button className="workspace-icon-button" aria-label={compact ? "Use comfortable table spacing" : "Use compact table spacing"} aria-pressed={compact} onClick={() => setPreferences((previous) => ({ ...previous, compact: !compact }))}><AlignJustify size={18} /></button><AdminNotifications /><div><span>{new Date().toLocaleDateString("en-GB", { weekday: "long" })}</span><strong>{new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}</strong></div><span className="admin-user-avatar small">{initials(user?.name)}</span></div>
        </header>
        {!online && <div className="workspace-connection" role="status">You’re offline. Reconnect before saving changes or refreshing records.</div>}
        <section className="admin-content admin-content-v2"><AdminErrorBoundary key={location.pathname}><Outlet /></AdminErrorBoundary></section>
      </main>

      {searchOpen && <AdminCommandPalette items={allVisibleItems} recent={recent} onNavigate={goTo} onClose={() => setSearchOpen(false)} />}

    </div>
  );
}
