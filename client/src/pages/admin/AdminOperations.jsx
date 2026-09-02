import { useEffect, useState } from "react";
import { Activity, AlertTriangle, CheckCircle2, Clock3, Database, RefreshCw, Search, ServerCog, ShieldAlert } from "lucide-react";
import { api } from "../../api/client.js";
import { hasPermission } from "../../auth/permissions.js";
import AdminSectionHero from "../../components/AdminSectionHero.jsx";
import StatusMessage from "../../components/StatusMessage.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const dateTime = (value) => value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";

export default function AdminOperations() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [audit, setAudit] = useState({ items: [], modules: [], total: 0, page: 1, pages: 1 });
  const [filters, setFilters] = useState({ search: "", module: "" });
  const [status, setStatus] = useState(null);
  const [running, setRunning] = useState(false);

  async function loadOverview() {
    try { setOverview(await api("/operations/overview")); }
    catch (error) { setStatus({ type: "error", message: error.message }); }
  }
  async function loadAudit(page = 1) {
    try {
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
      setAudit(await api(`/operations/audit?${params}`));
    } catch (error) { setStatus({ type: "error", message: error.message }); }
  }
  useEffect(() => { loadOverview(); loadAudit(); }, []);

  async function runDrill() {
    setRunning(true); setStatus(null);
    try { const result = await api("/operations/backup-drills", { method: "POST", body: { notes: "Manual recovery-readiness drill" } }); setStatus({ type: "success", message: `Recovery drill passed in ${result.durationMs}ms` }); await loadOverview(); }
    catch (error) { setStatus({ type: "error", message: error.message }); }
    finally { setRunning(false); }
  }

  async function resolveEvent(id) {
    try { await api(`/operations/events/${id}/resolve`, { method: "PATCH", body: { status: "Resolved" } }); await loadOverview(); }
    catch (error) { setStatus({ type: "error", message: error.message }); }
  }

  if (!overview) return <div className="admin-loading-screen">Checking platform operations…</div>;
  return <div className="operations-page">
    <AdminSectionHero eyebrow="Platform reliability" title="Operations & Audit" description="Monitor service health, investigate errors, verify recovery readiness and search the tenant-specific audit trail." aside={<div className="workspace-hero-count"><Activity size={18} /><span><small>API STATUS</small><strong>{overview.health.api}</strong></span></div>} />
    <StatusMessage status={status} />
    <section className="operations-health-grid">
      <article className="healthy"><ServerCog /><div><small>API service</small><strong>{overview.health.api}</strong><span>Uptime {Math.floor(overview.health.uptimeSeconds / 3600)}h</span></div></article>
      <article className="healthy"><Database /><div><small>Database</small><strong>{overview.health.database}</strong><span>{overview.health.databasePingMs}ms response</span></div></article>
      <article className={overview.metrics.openErrors ? "warning" : "healthy"}><AlertTriangle /><div><small>Open errors</small><strong>{overview.metrics.openErrors}</strong><span>{overview.metrics.criticalErrors} critical</span></div></article>
      <article className={overview.health.antivirus === "Configured" && !overview.metrics.suspiciousSessions ? "healthy" : "warning"}><ShieldAlert /><div><small>Security & antivirus</small><strong>{overview.health.antivirus}</strong><span>{overview.metrics.suspiciousSessions} flagged sessions</span></div></article>
    </section>
    <section className="operations-grid">
      <article className="operations-card"><header><div><small>RECOVERY READINESS</small><h2>Backup verification</h2></div><Database /></header><div className="drill-status"><span className={overview.latestDrill?.status === "Passed" ? "passed" : "pending"}>{overview.latestDrill?.status === "Passed" ? <CheckCircle2 /> : <Clock3 />}{overview.latestDrill?.status || "Not run"}</span><p>{overview.latestDrill ? `${overview.latestDrill.collectionsChecked} collections checked · ${overview.latestDrill.durationMs}ms` : "Run a non-destructive database readiness drill."}</p><small>Last run {dateTime(overview.latestDrill?.completedAt)}</small></div>{hasPermission(user, "organization.manage") && <button className="primary-button" onClick={runDrill} disabled={running}><RefreshCw className={running ? "spinning" : ""} />{running ? "Running checks…" : "Run readiness drill"}</button>}</article>
      <article className="operations-card events-card"><header><div><small>SYSTEM EVENTS</small><h2>Recent operational activity</h2></div><span>{overview.recentEvents.length}</span></header><div>{overview.recentEvents.length ? overview.recentEvents.map((event) => <article key={event._id}><span className={`event-severity ${event.severity.toLowerCase()}`} /><div><strong>{event.title}</strong><p>{event.message}</p><small>{event.type} · {dateTime(event.lastSeenAt)} · {event.occurrences} occurrence{event.occurrences === 1 ? "" : "s"}</small></div>{event.status !== "Resolved" && <button onClick={() => resolveEvent(event._id)}>Resolve</button>}</article>) : <p className="operations-empty">No operational incidents recorded.</p>}</div></article>
    </section>
    <section className="audit-card"><header><div><small>SEARCHABLE HISTORY</small><h2>Workspace audit log</h2></div><strong>{audit.total} events</strong></header><form onSubmit={(event) => { event.preventDefault(); loadAudit(1); }}><label><Search /><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search action, person or record" /></label><select value={filters.module} onChange={(event) => setFilters({ ...filters, module: event.target.value })}><option value="">All modules</option>{audit.modules.map((module) => <option key={module}>{module}</option>)}</select><button>Apply filters</button></form><div className="audit-table"><header><span>Time</span><span>Person</span><span>Module</span><span>Action</span><span>Details</span></header>{audit.items.map((item) => <article key={item._id}><time>{dateTime(item.createdAt)}</time><span><strong>{item.actor?.name || "System"}</strong><small>{item.actor?.email}</small></span><span>{item.module}</span><strong>{item.action}</strong><p>{item.summary}</p></article>)}</div><footer><button disabled={audit.page <= 1} onClick={() => loadAudit(audit.page - 1)}>Previous</button><span>Page {audit.page} of {audit.pages}</span><button disabled={audit.page >= audit.pages} onClick={() => loadAudit(audit.page + 1)}>Next</button></footer></section>
  </div>;
}
