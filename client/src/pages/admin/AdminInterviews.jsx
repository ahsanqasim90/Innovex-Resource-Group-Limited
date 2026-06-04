import { useEffect, useState } from "react";
import { api } from "../../api/client.js";
import StatusMessage from "../../components/StatusMessage.jsx";
import InterviewDetails from "./interviews/InterviewDetails.jsx";
import InterviewForm, { emptyInterview, toInterviewForm } from "./interviews/InterviewForm.jsx";
import InterviewList from "./interviews/InterviewList.jsx";

export default function AdminInterviews() {
  const [interviews, setInterviews] = useState([]);
  const [form, setForm] = useState(emptyInterview);
  const [filters, setFilters] = useState({ search: "", status: "", date: "", jobTitle: "", selected: "" });
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [outcomeSaving, setOutcomeSaving] = useState(false);
  const summary = {
    total: interviews.length,
    pending: interviews.filter((item) => item.interviewStatus === "Pending").length,
    completed: interviews.filter((item) => item.interviewStatus === "Completed").length,
    revenue: interviews.reduce((sum, item) => sum + Number(item.revenue || 0), 0)
  };

  function load() {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
    api(`/interviews${query ? `?${query}` : ""}`).then(setInterviews).catch((error) => setStatus({ type: "error", message: error.message }));
  }

  useEffect(() => {
    load();
  }, []);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const saved = await api(editing ? `/interviews/${editing}` : "/interviews", { method: editing ? "PUT" : "POST", body: form });
      setStatus({ message: "Interview saved." });
      setForm(emptyInterview);
      setEditing(null);
      setSelected(saved);
      load();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm("Delete this interview record?")) return;
    try {
      await api(`/interviews/${id}`, { method: "DELETE" });
      setStatus({ message: "Interview deleted." });
      if (selected?._id === id) setSelected(null);
      load();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  async function saveOutcome(outcome) {
    if (!selected) return;
    setOutcomeSaving(true);
    try {
      const updated = await api(`/interviews/${selected._id}`, { method: "PUT", body: { ...selected, ...outcome } });
      setSelected(updated);
      setStatus({ message: "Interview outcome saved." });
      load();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setOutcomeSaving(false);
    }
  }

  function edit(interview) {
    setEditing(interview._id);
    setForm(toInterviewForm(interview));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <div className="admin-top"><h1>Interviews</h1></div>
      <StatusMessage status={status} />
      <div className="interview-summary-grid">
        <div className="interview-summary-card"><span>Total bookings</span><strong>{summary.total}</strong></div>
        <div className="interview-summary-card"><span>Pending interviews</span><strong>{summary.pending}</strong></div>
        <div className="interview-summary-card"><span>Completed</span><strong>{summary.completed}</strong></div>
        <div className="interview-summary-card highlight"><span>Revenue</span><strong>£{summary.revenue.toLocaleString()}</strong></div>
      </div>
      <div className="interview-admin-grid">
        <InterviewForm form={form} setForm={setForm} editing={editing} saving={saving} onSubmit={save} onCancel={() => { setEditing(null); setForm(emptyInterview); }} />
        <InterviewDetails interview={selected} outcomeSaving={outcomeSaving} onOutcomeSave={saveOutcome} />
      </div>
      <div className="card filters interview-filters" style={{ marginTop: 24 }}>
        <div className="filter-heading">
          <div>
            <span className="eyebrow">Search records</span>
            <h3>Find an interview</h3>
          </div>
        </div>
        <div className="form-grid">
          <input placeholder="Search candidate, client, or job" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All interview stages</option><option value="Pending">Pending interview</option><option value="Completed">Interview completed</option><option value="Cancelled">Interview cancelled</option></select>
          <input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
          <input placeholder="Filter by job title" value={filters.jobTitle} onChange={(e) => setFilters({ ...filters, jobTitle: e.target.value })} />
          <select value={filters.selected} onChange={(e) => setFilters({ ...filters, selected: e.target.value })}><option value="">All outcomes</option><option value="Pending">Awaiting outcome</option><option value="Yes">Selected</option><option value="No">Not selected</option></select>
          <button className="button" onClick={load}>Apply Filters</button>
        </div>
      </div>
      <div style={{ marginTop: 24 }}>
        <InterviewList interviews={interviews} onEdit={edit} onDelete={remove} onSelect={setSelected} selectedId={selected?._id} />
      </div>
    </>
  );
}
