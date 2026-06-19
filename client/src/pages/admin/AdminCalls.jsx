import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Headphones, PhoneCall, PhoneForwarded, RefreshCw, Search, Settings, XCircle } from "lucide-react";
import { api } from "../../api/client.js";
import StatusMessage from "../../components/StatusMessage.jsx";
import SubmitButton from "../../components/SubmitButton.jsx";

const emptyManualCall = {
  targetName: "",
  targetPhone: "",
  sourceModule: "Manual CRM Call",
  notes: ""
};

const emptyFilters = { search: "", status: "", outcome: "", targetType: "" };

const statuses = ["Queued", "Dialling", "Connected", "Completed", "No Answer", "Failed", "Logged"];
const outcomes = ["Pending", "Interested", "Not Interested", "Call Back", "No Answer", "Wrong Number", "Converted", "Do Not Contact"];

function dateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function dateInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
}

export default function AdminCalls() {
  const [calls, setCalls] = useState([]);
  const [stats, setStats] = useState({});
  const [config, setConfig] = useState({});
  const [filters, setFilters] = useState(emptyFilters);
  const [form, setForm] = useState(emptyManualCall);
  const [editing, setEditing] = useState(null);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [starting, setStarting] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedCall = useMemo(() => calls.find((call) => call._id === editing?._id) || editing, [calls, editing]);

  function queryString(page = pagination.page, nextFilters = filters) {
    const query = new URLSearchParams({
      page,
      limit: pagination.limit,
      ...Object.fromEntries(Object.entries(nextFilters).filter(([, value]) => value))
    });
    return query.toString();
  }

  async function load(page = 1, nextFilters = filters) {
    setLoading(true);
    try {
      const data = await api(`/calls?${queryString(page, nextFilters)}`);
      setCalls(data.items || []);
      setPagination({ page: data.page, pages: data.pages || 1, total: data.total || 0, limit: data.limit || 25 });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }

  function loadStats() {
    api("/calls/stats/summary").then(setStats).catch(() => {});
    api("/calls/config/status").then(setConfig).catch(() => {});
  }

  useEffect(() => {
    load();
    loadStats();
  }, []);

  async function startManualCall(event) {
    event.preventDefault();
    setStarting(true);
    try {
      const result = await api("/calls/start", {
        method: "POST",
        body: { ...form, targetType: "Manual" }
      });
      setStatus({ message: result.yay?.message || "Call logged." });
      setForm(emptyManualCall);
      await load(1);
      loadStats();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setStarting(false);
    }
  }

  async function saveOutcome(event) {
    event.preventDefault();
    if (!editing?._id) return;
    setSaving(true);
    try {
      await api(`/calls/${editing._id}`, { method: "PATCH", body: editing });
      setStatus({ message: "Call outcome updated." });
      setEditing(null);
      await load(pagination.page);
      loadStats();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function deleteCall(id) {
    if (!confirm("Delete this call log?")) return;
    try {
      await api(`/calls/${id}`, { method: "DELETE" });
      setStatus({ message: "Call log deleted." });
      await load(pagination.page);
      loadStats();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  function applyFilters(event) {
    event.preventDefault();
    load(1, filters);
  }

  function resetFilters() {
    setFilters(emptyFilters);
    load(1, emptyFilters);
  }

  const statCards = [
    ["Total calls", stats.total || 0, Headphones],
    ["Calls today", stats.todayCalls || 0, PhoneCall],
    ["Connected", stats.connected || 0, CheckCircle2],
    ["Follow-ups due", stats.followUpsDue || 0, Clock3],
    ["Failed", stats.failed || 0, XCircle]
  ];

  return (
    <>
      <section className="calls-hero">
        <div>
          <span className="eyebrow">Yay dialler integration</span>
          <h1><PhoneForwarded size={30} /> Call Centre</h1>
          <p>Start outbound calls from your CRM, keep every candidate and client call logged, and track outcomes for follow-up discipline.</p>
        </div>
        <aside className={`calls-config-card ${config.configured ? "ready" : "pending"}`}>
          <Settings size={22} />
          <span>{config.configured ? "Yay API ready" : "Yay API setup required"}</span>
          <strong>{config.configured ? "Click-to-call enabled" : "CRM logging only"}</strong>
          <p>{config.configured ? `Endpoint: ${config.callPath}` : "Add Yay credentials in Vercel environment variables to activate outbound calls."}</p>
        </aside>
      </section>

      <StatusMessage status={status} />

      <section className="calls-stat-grid">
        {statCards.map(([label, value, Icon]) => (
          <article className="calls-stat-card" key={label}>
            <Icon size={20} />
            <span>{label}</span>
            <strong>{Number(value).toLocaleString()}</strong>
          </article>
        ))}
      </section>

      <div className="calls-workspace-grid">
        <form className="card form calls-panel" onSubmit={startManualCall}>
          <div className="admin-form-title">
            <span><PhoneCall size={18} /> Quick dial</span>
            <h2>Start a manual CRM call</h2>
            <p>Use this when the contact is not yet saved in Talent Pool or Business Leads.</p>
          </div>
          <div className="form-grid">
            <label className="filter-field">
              <span>Contact name</span>
              <input value={form.targetName} onChange={(e) => setForm({ ...form, targetName: e.target.value })} required />
            </label>
            <label className="filter-field">
              <span>Phone number</span>
              <input value={form.targetPhone} onChange={(e) => setForm({ ...form, targetPhone: e.target.value })} placeholder="+44..." required />
            </label>
            <label className="filter-field">
              <span>Source / context</span>
              <input value={form.sourceModule} onChange={(e) => setForm({ ...form, sourceModule: e.target.value })} />
            </label>
          </div>
          <textarea rows="4" placeholder="Call notes before dialling" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <SubmitButton loading={starting} loadingText="Starting call...">Start Call</SubmitButton>
        </form>

        <form className="card form calls-panel calls-outcome-panel" onSubmit={saveOutcome}>
          <div className="admin-form-title">
            <span><RefreshCw size={18} /> Outcome update</span>
            <h2>{selectedCall ? selectedCall.targetName : "Select a call"}</h2>
            <p>{selectedCall ? `${selectedCall.targetPhone} • ${selectedCall.sourceModule}` : "Choose a call from the table to update status, outcome and follow-up."}</p>
          </div>
          <div className="form-grid">
            <label className="filter-field">
              <span>Status</span>
              <select disabled={!editing} value={editing?.status || "Queued"} onChange={(e) => setEditing({ ...editing, status: e.target.value })}>
                {statuses.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="filter-field">
              <span>Outcome</span>
              <select disabled={!editing} value={editing?.outcome || "Pending"} onChange={(e) => setEditing({ ...editing, outcome: e.target.value })}>
                {outcomes.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="filter-field">
              <span>Duration seconds</span>
              <input disabled={!editing} type="number" min="0" value={editing?.durationSeconds || 0} onChange={(e) => setEditing({ ...editing, durationSeconds: Number(e.target.value || 0) })} />
            </label>
            <label className="filter-field">
              <span>Follow-up date</span>
              <input disabled={!editing} type="datetime-local" value={dateInput(editing?.followUpAt)} onChange={(e) => setEditing({ ...editing, followUpAt: e.target.value })} />
            </label>
          </div>
          <textarea disabled={!editing} rows="4" placeholder="Outcome notes" value={editing?.notes || ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} />
          <div className="actions">
            <SubmitButton loading={saving} loadingText="Saving outcome..." disabled={!editing}>Save Outcome</SubmitButton>
            {editing && <button type="button" className="button secondary" onClick={() => setEditing(null)}>Cancel</button>}
          </div>
        </form>
      </div>

      <section className="card filters talent-filter-card calls-filter-card">
        <div className="talent-section-heading">
          <div>
            <span className="eyebrow"><Search size={15} /> Call history</span>
            <h2>Search and filter logged calls</h2>
          </div>
          <strong>{Number(pagination.total || 0).toLocaleString()} records</strong>
        </div>
        <form className="form-grid" onSubmit={applyFilters}>
          <label className="filter-field">
            <span>Search</span>
            <input placeholder="Name, phone, notes or source" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          </label>
          <label className="filter-field">
            <span>Status</span>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All statuses</option>
              {statuses.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="filter-field">
            <span>Outcome</span>
            <select value={filters.outcome} onChange={(e) => setFilters({ ...filters, outcome: e.target.value })}>
              <option value="">All outcomes</option>
              {outcomes.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="filter-field">
            <span>Target type</span>
            <select value={filters.targetType} onChange={(e) => setFilters({ ...filters, targetType: e.target.value })}>
              <option value="">All records</option>
              <option value="Candidate">Candidates</option>
              <option value="BusinessLead">Business leads</option>
              <option value="Manual">Manual</option>
            </select>
          </label>
          <button className="button">Apply Filters</button>
          <button className="button secondary" type="button" onClick={resetFilters}>Reset</button>
        </form>
      </section>

      <div className="table-wrap calls-table">
        <table>
          <thead>
            <tr>
              <th>Contact</th>
              <th>Source</th>
              <th>Status</th>
              <th>Outcome</th>
              <th>Follow-up</th>
              <th>Owner</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8">Loading calls...</td></tr>
            ) : calls.length ? calls.map((call) => (
              <tr key={call._id}>
                <td><strong>{call.targetName}</strong><br /><span className="muted">{call.targetPhone}</span></td>
                <td>{call.sourceModule}<br /><span className="muted">{call.targetType}</span></td>
                <td><span className={`call-status-chip ${call.status.toLowerCase().replace(/\s+/g, "-")}`}>{call.status}</span></td>
                <td>{call.outcome}</td>
                <td>{dateTime(call.followUpAt)}</td>
                <td>{call.initiatedBy?.name || "Team"}<br /><span className="muted">{call.initiatedBy?.role || ""}</span></td>
                <td>{dateTime(call.createdAt)}</td>
                <td className="actions compact-actions">
                  <button className="button small" type="button" onClick={() => setEditing(call)}>Update</button>
                  <button className="button secondary small" type="button" onClick={() => deleteCall(call._id)}>Delete</button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="8">No calls found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="talent-pagination">
        <button className="button secondary" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>Previous</button>
        <span>Page {pagination.page} of {pagination.pages} &middot; {Number(pagination.total || 0).toLocaleString()} calls</span>
        <button className="button secondary" disabled={pagination.page >= pagination.pages} onClick={() => load(pagination.page + 1)}>Next</button>
      </div>
    </>
  );
}
