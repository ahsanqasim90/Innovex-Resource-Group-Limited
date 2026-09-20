import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, BriefcaseBusiness, CalendarDays, CheckCircle2, Clock3, GraduationCap, Inbox, ListTodo, RefreshCw, UsersRound, Wallet } from "lucide-react";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { hasPermission } from "../../auth/permissions.js";
import AdminLoadState from "../../components/AdminLoadState.jsx";

const money = (value) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(value);
const date = (value) => value ? new Date(value).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—";
const metricGroups = [
  { title: "Recruitment", icon: UsersRound, items: [["activeJobs", "Live vacancies", "/admin/jobs"], ["totalCandidates", "Talent pool", "/admin/talent-pool"], ["applications", "Applications", "/admin/applications"], ["placements", "Placements (interview outcomes)", "/admin/talent-pool"]] },
  { title: "Sales & relationships", icon: BriefcaseBusiness, items: [["newLeads", "New business leads", "/admin/business-leads"], ["messages", "New enquiries", "/admin/website-enquiries"], ["todayCalls", "Calls today", "/admin/calls"], ["followUpsDue", "Callbacks due", "/admin/calls"]] },
  { title: "Training & delivery", icon: GraduationCap, items: [["totalTrainingBookings", "Total bookings", "/admin/training-bookings"], ["upcomingTrainingSessions", "Upcoming sessions", "/admin/training-bookings"], ["draftQuotations", "Draft quotations", "/admin/training-quotations"]] },
  { title: "Finance", icon: Wallet, items: [["invoiced", "Issued invoice value", "/admin/finance", true], ["received", "Payments recorded", "/admin/finance", true], ["outstanding", "Outstanding balance", "/admin/finance", true], ["overdueInvoices", "Overdue invoices", "/admin/finance"]] },
  { title: "Team & operations", icon: ListTodo, items: [["openTasks", "Open team tasks", "/admin/tasks"], ["overdueTasks", "Overdue tasks", "/admin/tasks"], ["pendingReviews", "Pending testimonials", "/admin/testimonials"], ["openErrors", "Operational errors", "/admin/operations"]] }
];
const shortcuts = [
  ["Vacancies", "jobs.view", "/admin/jobs", BriefcaseBusiness], ["Talent pool", "talentPool.view", "/admin/talent-pool", UsersRound],
  ["Business leads", "businessLeads.view", "/admin/business-leads", Inbox], ["Training bookings", "trainingBookings.view", "/admin/training-bookings", GraduationCap],
  ["Team tasks", "automations.view", "/admin/tasks", ListTodo], ["Attendance", "attendance.view", "/admin/attendance", Clock3]
];
const recentViews = [
  ["recentOwnActivity", "My activity", null, (x) => x.summary, (x) => x.module, (x) => x.action, (x) => x.createdAt],
  ["recentApplications", "Applications", "/admin/applications", (x) => x.name, (x) => x.email, (x) => x.status, (x) => x.createdAt],
  ["recentInterviews", "Interviews", "/admin/interviews", (x) => x.candidateName, (x) => `${x.jobTitle} · ${x.clientName}`, (x) => x.interviewStatus, (x) => x.interviewDate],
  ["recentMeetings", "Meetings", "/admin/meetings", (x) => x.meetingTitle, (x) => x.companyName, (x) => x.meetingStatus, (x) => x.meetingDate],
  ["recentTrainingBookings", "Training", "/admin/training-bookings", (x) => x.clientName, (x) => x.selectedCourses?.map((c) => c.title).join(", "), (x) => x.bookingStatus, (x) => x.trainingDate],
  ["recentCalls", "Calls", "/admin/calls", (x) => x.targetName, (x) => x.outcome, (x) => x.status, (x) => x.createdAt],
  ["recentActivityLogs", "Audit activity", "/admin/operations", (x) => x.summary, (x) => x.actor?.name || "System", (x) => x.action, (x) => x.createdAt]
];

export default function Dashboard() {
  const { user } = useAuth();
  const dashboardCacheKey = `innovexDashboard:${user?.id || "anonymous"}`;
  const [data, setData] = useState(() => {
    try {
      const cached = JSON.parse(sessionStorage.getItem(dashboardCacheKey));
      return cached?.savedAt > Date.now() - 60_000 ? cached.data : null;
    } catch { return null; }
  });
  const hadCachedData = useRef(Boolean(data));
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState("");
  const [group, setGroup] = useState("All");
  const [activity, setActivity] = useState("");
  const load = useCallback(async ({ background = false } = {}) => {
    if (!background) setLoading(true);
    setError("");
    try {
      const next = await api("/dashboard/stats");
      setData(next);
      try { sessionStorage.setItem(dashboardCacheKey, JSON.stringify({ savedAt: Date.now(), data: next })); }
      catch { /* The live response still renders when browser storage is unavailable. */ }
    }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }, [dashboardCacheKey]);
  useEffect(() => { load({ background: hadCachedData.current }); }, [load]);
  if (!data) return <AdminLoadState error={error} onRetry={load} label="Loading your overview…" />;
  const stats = data.stats || {};
  const attention = data.attention || [];
  const actionable = attention.filter((x) => x.count > 0 && (group === "All" || x.group === group));
  const groups = [...new Set(attention.map((x) => x.group))];
  const sections = metricGroups.map((section) => ({ ...section, items: section.items.filter(([key]) => stats[key] !== undefined) })).filter((section) => section.items.length);
  const availableViews = recentViews.filter(([key]) => Array.isArray(data[key]));
  const selectedView = availableViews.find(([key]) => key === activity) || availableViews[0];
  const hour = new Date().getHours();
  const heroHighlights = [
    ["activeJobs", "Live vacancies", "/admin/jobs", "jobs.view"],
    ["applications", "Applications", "/admin/applications", "applications.view"],
    ["openTasks", "Open tasks", "/admin/tasks", "automations.view"]
  ].filter(([key, , , permission]) => stats[key] !== undefined && hasPermission(user, permission));
  return <div className="workspace-dashboard" aria-busy={loading}>
    <section className="workspace-welcome">
      <div className="workspace-welcome-copy"><span className="eyebrow"><i /> Live workspace overview</span><h2>Good {hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening"}, {user?.name?.split(" ")[0] || "there"}.</h2><p>Your priorities, upcoming commitments and business performance—together in one command centre.</p><div className="workspace-refresh"><button className="button light" onClick={load} disabled={loading}><RefreshCw size={16} className={loading ? "spinning" : ""} />{loading ? "Refreshing…" : "Refresh data"}</button><small>Last synced {new Date(data.updatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</small></div></div>
      {!!heroHighlights.length && <div className="workspace-hero-highlights">{heroHighlights.map(([key, label, href]) => <Link to={href} key={key}><span>{label}</span><strong>{Number(stats[key]).toLocaleString("en-GB")}</strong><ArrowUpRight size={16} /></Link>)}</div>}
    </section>
    {error && <div className="workspace-inline-error" role="alert">Refresh failed: {error} Showing the last successful update. <button onClick={load}>Retry</button></div>}
    <nav className="workspace-shortcuts" aria-label="Quick access">{shortcuts.filter(([, permission]) => hasPermission(user, permission)).map(([label, , href, Icon]) => <Link to={href} key={href}><Icon size={17} />{label}<ArrowUpRight size={14} /></Link>)}</nav>
    <div className="workspace-priority-grid">
      <section className="workspace-panel workspace-attention"><header><div><span className="eyebrow">Action centre</span><h2>Needs attention <span className="workspace-count">{attention.filter((x) => x.count > 0).length}</span></h2></div><label className="sr-only" htmlFor="attention-group">Filter priorities by division</label><select id="attention-group" value={group} onChange={(e) => setGroup(e.target.value)}><option>All</option>{groups.map((name) => <option key={name}>{name}</option>)}</select></header>
        <div className="workspace-attention-list">{actionable.map((item) => <Link to={item.href} key={item.id}><span className={`workspace-attention-count ${item.tone}`}>{item.count}</span><span><strong>{item.label}</strong><small>{item.group}</small></span><ArrowUpRight size={17} /></Link>)}{!actionable.length && <div className="workspace-empty"><CheckCircle2 /><strong>No outstanding items in this view</strong><p>New priorities will appear as records change.</p></div>}</div>
      </section>
      <section className="workspace-panel"><header><div><span className="eyebrow">Today + next 6 days</span><h2>Upcoming schedule</h2></div><CalendarDays size={21} /></header><div className="workspace-agenda">{(data.agenda || []).map((item) => <Link to={item.href} key={item.id}><time><strong>{new Date(item.date).getDate()}</strong><span>{new Date(item.date).toLocaleDateString("en-GB", { month: "short" })}</span></time><span><small>{item.type} · {item.time || "Time not set"}</small><strong>{item.title}</strong><span>{item.detail}</span></span><ArrowUpRight size={15} /></Link>)}{!data.agenda?.length && <div className="workspace-empty"><CalendarDays /><strong>No upcoming commitments</strong><p>Scheduled interviews, meetings and training appear here.</p></div>}</div></section>
    </div>
    <div className="workspace-section-heading"><div><h2>Across your business</h2><p>Current totals for the areas you can access. Invoice figures exclude drafts and cancellations.</p></div></div>
    <section className="workspace-metric-grid">{sections.map(({ title, icon: Icon, items }) => <article className="workspace-panel" key={title}><header><h3>{title}</h3><Icon size={19} /></header>{items.map(([key, label, href, currency]) => <Link className="workspace-metric-row" key={key} to={href}><span>{label}</span><strong>{currency ? money(stats[key]) : Number(stats[key]).toLocaleString("en-GB")}</strong></Link>)}</article>)}</section>
    {!sections.length && <div className="workspace-empty"><UsersRound /><strong>Your workspace is ready</strong><p>Your administrator can enable the modules you need. Use Attendance to manage your working day.</p></div>}
    {selectedView && <section className="workspace-panel workspace-recent"><header><div><span className="eyebrow">Latest records</span><h2>Recent activity</h2></div>{selectedView[2] && <Link to={selectedView[2]}>Open {selectedView[1].toLowerCase()} <ArrowUpRight size={15} /></Link>}</header><div className="workspace-tabs" aria-label="Activity type">{availableViews.map(([key, label]) => <button type="button" aria-pressed={key === selectedView[0]} key={key} onClick={() => setActivity(key)}>{label}</button>)}</div><div className="workspace-recent-list">{data[selectedView[0]].map((item) => { const content = <><span><strong>{selectedView[3](item)}</strong><small>{selectedView[4](item)}</small></span><span className="workspace-status">{selectedView[5](item)}</span><time>{date(selectedView[6](item))}</time><ArrowUpRight size={16} /></>; return selectedView[2] ? <Link to={selectedView[2]} key={item._id}>{content}</Link> : <div className="workspace-recent-row" key={item._id}>{content}</div>; })}{!data[selectedView[0]].length && <div className="workspace-empty"><Inbox /><strong>No records yet</strong><p>New {selectedView[1].toLowerCase()} will appear here.</p></div>}</div></section>}
  </div>;
}
