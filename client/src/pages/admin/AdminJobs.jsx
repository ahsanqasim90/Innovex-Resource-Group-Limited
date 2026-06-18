import { useEffect, useMemo, useState } from "react";
import { api } from "../../api/client.js";
import StatusMessage from "../../components/StatusMessage.jsx";

const empty = { title: "", location: "", salary: "", type: "Temporary", shift: "", description: "", isActive: true };
const toJobPayload = (job) => ({
  title: job.title,
  location: job.location,
  salary: job.salary,
  type: job.type,
  shift: job.shift,
  description: job.description,
  isActive: Boolean(job.isActive),
  requirements: Array.isArray(job.requirements) ? job.requirements : []
});

function dateLabel(value) {
  return value ? new Date(value).toLocaleDateString("en-GB") : "-";
}

export default function AdminJobs() {
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
    active: jobs.filter((job) => job.isActive).length,
    inactive: jobs.filter((job) => !job.isActive).length
  }), [jobs]);

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();
    return jobs.filter((job) => {
      const matchesSearch = !query || job.title?.toLowerCase().includes(query);
      const matchesStatus = !statusFilter || (statusFilter === "Active" ? job.isActive : !job.isActive);
      return matchesSearch && matchesStatus;
    });
  }, [jobs, search, statusFilter]);

  async function save(event) {
    event.preventDefault();
    try {
      await api(editing ? `/jobs/${editing}` : "/jobs", { method: editing ? "PUT" : "POST", body: toJobPayload(form) });
      setForm(empty);
      setEditing(null);
      setStatus({ message: "Job saved." });
      load();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  async function remove(id) {
    if (!confirm("Delete this job and its applications?")) return;
    try {
      await api(`/jobs/${id}`, { method: "DELETE" });
      setStatus({ message: "Job deleted." });
      load();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  async function toggleStatus(job) {
    try {
      await api(`/jobs/${job._id}`, { method: "PUT", body: { ...toJobPayload(job), isActive: !job.isActive } });
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
    <>
      <div className="admin-top admin-jobs-title"><h1>Admin Jobs</h1></div>
      <StatusMessage status={status} />

      <form className="card form admin-job-form-card" onSubmit={save}>
        <div className="admin-job-form-head">
          <div>
            <span className="eyebrow">Job management</span>
            <h2>{editing ? "Edit job vacancy" : "Create new job vacancy"}</h2>
          </div>
          {editing && <button type="button" className="button secondary small" onClick={() => { setEditing(null); setForm(empty); }}>Cancel edit</button>}
        </div>

        <div className="admin-job-form-grid">
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
          <label className="admin-job-check">
            <span>Status</span>
            <div><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active job</div>
          </label>
        </div>
        <label className="admin-job-description">
          <span>Description</span>
          <textarea placeholder="Add role overview, responsibilities, requirements and benefits..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        </label>
        <div className="admin-job-submit-row">
          <button className="button">{editing ? "Update Job" : "Create Job"}</button>
        </div>
      </form>

      <section className="admin-jobs-table-card">
        <div className="admin-jobs-stats">
          <div><span>Total Jobs</span><strong>{stats.total}</strong></div>
          <div><span>Active Jobs</span><strong>{stats.active}</strong></div>
          <div><span>Inactive Jobs</span><strong>{stats.inactive}</strong></div>
        </div>

        <div className="admin-jobs-toolbar">
          <input placeholder="Search jobs by title..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>

        <div className="table-wrap admin-jobs-table-wrap">
          <table className="admin-jobs-table">
            <thead>
              <tr><th>Title</th><th>Location</th><th>Salary</th><th>Date Posted</th><th>Status</th><th>Actions</th></tr>
            </thead>
            <tbody>
              {filteredJobs.map((job) => (
                <tr key={job._id}>
                  <td><strong>{job.title}</strong><br /><span className="muted">{job.type} • {job.shift || "Shift not set"}</span></td>
                  <td>{job.location}</td>
                  <td>{job.salary}</td>
                  <td>{dateLabel(job.createdAt)}</td>
                  <td><span className={job.isActive ? "job-status-pill active" : "job-status-pill inactive"}>{job.isActive ? "Active" : "Inactive"}</span></td>
                  <td className="admin-job-actions">
                    <button className="button small" onClick={() => edit(job)}>Edit</button>
                    <button className="button secondary small" onClick={() => toggleStatus(job)}>Toggle</button>
                    <button className="button small danger-lite" onClick={() => remove(job._id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filteredJobs.length && <div className="admin-jobs-empty">No jobs match your current search or filter.</div>}
        </div>
      </section>
    </>
  );
}
