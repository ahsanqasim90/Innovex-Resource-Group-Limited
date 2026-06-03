import { useEffect, useState } from "react";
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

export default function AdminJobs() {
  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [status, setStatus] = useState(null);
  const load = () => api("/jobs?admin=true").then(setJobs).catch((error) => setStatus({ type: "error", message: error.message }));
  useEffect(() => {
    load();
  }, []);

  async function save(event) {
    event.preventDefault();
    try {
      await api(editing ? `/jobs/${editing}` : "/jobs", { method: editing ? "PUT" : "POST", body: toJobPayload(form) });
      setForm(empty); setEditing(null); setStatus({ message: "Job saved." }); load();
    } catch (error) { setStatus({ type: "error", message: error.message }); }
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

  return (
    <>
      <div className="admin-top"><h1>Admin Jobs</h1></div>
      <StatusMessage status={status} />
      <form className="card form" onSubmit={save}>
        <div className="form-grid">
          {["title", "location", "salary", "shift"].map((name) => <input key={name} placeholder={name} value={form[name]} onChange={(e) => setForm({ ...form, [name]: e.target.value })} required />)}
          <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}><option>Temporary</option><option>Permanent</option><option>Contract</option></select>
          <label><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
        </div>
        <textarea placeholder="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} required />
        <button className="button">{editing ? "Update Job" : "Create Job"}</button>
      </form>
      <div className="table-wrap" style={{ marginTop: 24 }}><table><thead><tr><th>Title</th><th>Location</th><th>Salary</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {jobs.map((job) => <tr key={job._id}><td>{job.title}</td><td>{job.location}</td><td>{job.salary}</td><td>{job.isActive ? "Active" : "Inactive"}</td><td className="actions"><button className="button small" onClick={() => { setEditing(job._id); setForm(toJobPayload(job)); }}>Edit</button><button className="button secondary small" onClick={() => api(`/jobs/${job._id}`, { method: "PUT", body: { ...toJobPayload(job), isActive: !job.isActive } }).then(load).catch((error) => setStatus({ type: "error", message: error.message }))}>Toggle</button><button className="button small" onClick={() => remove(job._id)}>Delete</button></td></tr>)}
      </tbody></table></div>
    </>
  );
}
