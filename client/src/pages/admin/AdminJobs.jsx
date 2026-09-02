import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, CheckCircle2, RadioTower, ShieldCheck, XCircle } from "lucide-react";
import { api } from "../../api/client.js";
import { hasPermission } from "../../auth/permissions.js";
import AdminSectionHero from "../../components/AdminSectionHero.jsx";
import StatusMessage from "../../components/StatusMessage.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const empty = { reference: "", clientName: "", title: "", location: "", salary: "", type: "Temporary", shift: "", description: "", priority: "Medium", openings: 1, closingDate: "", vacancyStatus: "Open", isActive: true };
const lifecycleStatuses = ["Open", "Paused", "Closed", "Filled"];

function lifecycleStatus(job) {
  return lifecycleStatuses.includes(job?.vacancyStatus) ? job.vacancyStatus : job?.isActive ? "Open" : "Closed";
}

const toJobPayload = (job) => ({
  reference: job.reference || "",
  clientName: job.clientName || "",
  title: job.title,
  location: job.location,
  salary: job.salary,
  type: job.type,
  shift: job.shift,
  description: job.description,
  priority: job.priority || "Medium",
  openings: Number(job.openings || 1),
  closingDate: job.closingDate ? String(job.closingDate).slice(0, 10) : null,
  vacancyStatus: lifecycleStatus(job),
  isActive: lifecycleStatus(job) === "Open",
  requirements: Array.isArray(job.requirements) ? job.requirements : []
});

function dateLabel(value) {
  return value ? new Date(value).toLocaleDateString("en-GB") : "-";
}

export default function AdminJobs() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [status, setStatus] = useState(null);

  const load = () => api("/jobs?admin=true").then(setJobs).catch((error) => setStatus({ type: "error", message: error.message }));

  useEffect(() => {
    load();
  }, []);

  const stats = useMemo(() => ({
    total: jobs.length,
    open: jobs.filter((job) => lifecycleStatus(job) === "Open" && (!job.publicationStatus || job.publicationStatus === "Approved")).length,
    pending: jobs.filter((job) => job.publicationStatus === "Pending Approval").length,
    paused: jobs.filter((job) => lifecycleStatus(job) === "Paused").length,
    closed: jobs.filter((job) => lifecycleStatus(job) === "Closed").length,
    filled: jobs.filter((job) => lifecycleStatus(job) === "Filled").length
  }), [jobs]);

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesSearch = !query || `${job.title || ""} ${job.reference || ""} ${job.clientName || ""} ${job.location || ""}`.toLowerCase().includes(query);
      const matchesStatus = !statusFilter || lifecycleStatus(job) === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [jobs, search, statusFilter]);

  async function save(event) {
    event.preventDefault();
    try {
      await api(editing ? `/jobs/${editing}` : "/jobs", { method: editing ? "PUT" : "POST", body: toJobPayload(form) });
      setForm(empty);
      setEditing(null);
      setStatus({ message: editing ? "Vacancy updated." : "Vacancy created and submitted for publication approval." });
      load();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  async function remove(id) {
    if (!confirm("Archive this vacancy? Applications and activity history will be retained.")) return;
    try {
      await api(`/jobs/${id}`, { method: "DELETE" });
      setStatus({ message: "Vacancy archived. Linked applications and history were retained." });
      load();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  async function updatePublication(job, nextStatus) {
    const notes = nextStatus === "Rejected" ? prompt("Add a short reason for rejection:", job.approvalNotes || "") : "";
    if (nextStatus === "Rejected" && notes === null) return;
    try {
      await api(`/jobs/${job._id}/publication`, { method: "PATCH", body: { status: nextStatus, notes } });
      setStatus({ message: nextStatus === "Approved" ? `${job.title} is approved and published.` : `${job.title} was returned for changes.` });
      load();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  async function updateLifecycle(job, nextStatus) {
    try {
      await api(`/jobs/${job._id}/lifecycle`, { method: "PATCH", body: { status: nextStatus } });
      setStatus({ message: `${job.title} is now ${nextStatus.toLowerCase()}.` });
      load();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  function edit(job) {
    setEditing(job._id);
    setForm(toJobPayload(job));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="workspace-pro-suite vacancies-admin-pro">
      <AdminSectionHero icon={BriefcaseBusiness} eyebrow="Vacancy management" title="Vacancies" description="Create, publish and manage every live role with a clear vacancy lifecycle." aside={<div className="workspace-hero-count"><RadioTower size={18} /><span><small>OPEN ROLES</small><strong>{stats.open}</strong></span></div>} />
      <StatusMessage status={status} />

      {hasPermission(user, editing ? "jobs.edit" : "jobs.create") && <form className="card form admin-job-form-card" onSubmit={save}>
        <div className="admin-job-form-head">
          <div>
            <span className="eyebrow">Job management</span>
            <h2>{editing ? "Edit job vacancy" : "Create new job vacancy"}</h2>
          </div>
          {editing && <button type="button" className="button secondary small" onClick={() => { setEditing(null); setForm(empty); }}>Cancel edit</button>}
        </div>

        <div className="admin-job-form-grid">
          <label>
            <span>Vacancy reference</span>
            <input placeholder="e.g. IRG-2026-014" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value.toUpperCase() })} />
          </label>
          <label>
            <span>Client / company</span>
            <input placeholder="Internal use only" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
          </label>
          <label>
            <span>Job title</span>
            <input placeholder="e.g. Registered Nurse" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
          </label>
          <label>
            <span>Location</span>
            <input placeholder="e.g. Cardiff" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required />
          </label>
          <label>
            <span>Salary</span>
            <input placeholder="e.g. £18 - £22 per hour" value={form.salary} onChange={(e) => setForm({ ...form, salary: e.target.value })} required />
          </label>
          <label>
            <span>Shift</span>
            <input placeholder="e.g. Days / Nights" value={form.shift} onChange={(e) => setForm({ ...form, shift: e.target.value })} required />
          </label>
          <label>
            <span>Job type</span>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>Temporary</option><option>Permanent</option><option>Contract</option></select>
          </label>
          <label>
            <span>Priority</span>
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}><option>High</option><option>Medium</option><option>Low</option></select>
          </label>
          <label>
            <span>Number of openings</span>
            <input type="number" min="1" max="1000" value={form.openings} onChange={(e) => setForm({ ...form, openings: e.target.value })} />
          </label>
          <label>
            <span>Closing date</span>
            <input type="date" value={form.closingDate || ""} onChange={(e) => setForm({ ...form, closingDate: e.target.value })} />
          </label>
          <label className="admin-job-check">
            <span>Vacancy status</span>
            <select value={form.vacancyStatus} onChange={(e) => setForm({ ...form, vacancyStatus: e.target.value, isActive: e.target.value === "Open" })}>{lifecycleStatuses.map((value) => <option key={value}>{value}</option>)}</select>
          </label>
        </div>
        <label className="admin-job-description">
          <span>Description</span>
          <textarea placeholder="Add role overview, responsibilities, requirements and benefits..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        </label>
        <div className="admin-job-submit-row">
          <button className="button">{editing ? "Update Job" : "Create Job"}</button>
        </div>
      </form>}

      <section className="admin-jobs-table-card">
        <div className="admin-jobs-stats">
          <div><span>Total Jobs</span><strong>{stats.total}</strong></div>
          <div><span>Open</span><strong>{stats.open}</strong></div>
          <div><span>Awaiting approval</span><strong>{stats.pending}</strong></div>
          <div><span>Paused</span><strong>{stats.paused}</strong></div>
          <div><span>Closed</span><strong>{stats.closed}</strong></div>
          <div><span>Filled</span><strong>{stats.filled}</strong></div>
        </div>

        <div className="admin-jobs-toolbar">
          <input placeholder="Search title, reference, client or location..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {lifecycleStatuses.map((value) => <option key={value}>{value}</option>)}
          </select>
        </div>

        <div className="table-wrap admin-jobs-table-wrap">
          <table className="admin-jobs-table">
            <thead>
              <tr><th>Vacancy</th><th>Client</th><th>Location</th><th>Openings</th><th>Closing</th><th>Publication</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => (
                <tr key={job._id}>
                  <td><strong>{job.title}</strong><br /><span className="muted">{job.reference || "No reference"} • {job.priority || "Medium"} priority</span></td>
                  <td>{job.clientName || <span className="muted">Confidential</span>}</td>
                  <td>{job.location}</td>
                  <td>{job.openings || 1}</td>
                  <td>{dateLabel(job.closingDate)}</td>
                  <td>
                    <span className={`publication-pill ${(job.publicationStatus || "Approved").toLowerCase().replace(/\s+/g, "-")}`}><ShieldCheck size={13} />{job.publicationStatus || "Approved (legacy)"}</span>
                    {job.approvalNotes && <span className="publication-note">{job.approvalNotes}</span>}
                  </td>
                  <td><span className={`job-status-pill ${lifecycleStatus(job).toLowerCase()}`}>{lifecycleStatus(job)}</span>{job.closedAt && <><br /><span className="muted">{dateLabel(job.closedAt)}</span></>}</td>
                  <td className="admin-job-actions">
                    {hasPermission(user, "jobs.approve") && job.publicationStatus === "Pending Approval" && <div className="publication-actions"><button className="icon-action approve" title="Approve and publish" onClick={() => updatePublication(job, "Approved")}><CheckCircle2 size={16} /></button><button className="icon-action reject" title="Return for changes" onClick={() => updatePublication(job, "Rejected")}><XCircle size={16} /></button></div>}
                    {hasPermission(user, "jobs.edit") && <button className="button small" onClick={() => edit(job)}>Edit</button>}
                    {hasPermission(user, "jobs.edit") && <select className="job-lifecycle-select" aria-label={`Update ${job.title} status`} value={lifecycleStatus(job)} onChange={(event) => updateLifecycle(job, event.target.value)}>{lifecycleStatuses.map((value) => <option key={value}>{value}</option>)}</select>}
                    {hasPermission(user, "jobs.delete") && <button className="button small danger-lite" onClick={() => remove(job._id)}>Archive</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredJobs.length && <div className="admin-jobs-empty">No jobs match your current search or filter.</div>}
        </div>
      </section>
    </div>
  );
}
