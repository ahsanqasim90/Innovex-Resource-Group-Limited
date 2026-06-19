import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Clock3, Delete, Headphones, History, PhoneCall, Users, XCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { api } from "../../api/client.js";
import StatusMessage from "../../components/StatusMessage.jsx";
import SubmitButton from "../../components/SubmitButton.jsx";

const fallbackCallerIds = ["+443300435830", "+442922520491"];

const emptyManualCall = {
  targetName: "",
  targetPhone: "",
  outboundCallerId: "",
  sourceModule: "Manual CRM Call",
  notes: ""
};

const emptyFilters = { search: "", status: "", outcome: "", targetType: "" };

const statuses = ["Queued", "Dialling", "Connected", "Completed", "No Answer", "Failed", "Logged"];
const outcomes = ["Pending", "Interested", "Not Interested", "Call Back", "No Answer", "Wrong Number", "Converted", "Do Not Contact"];
const sourceOptions = ["Manual CRM Call", "Talent Pool", "Business Lead", "Candidate Follow-up"];

const dialKeys = [
  ["1", ""],
  ["2", "ABC"],
  ["3", "DEF"],
  ["4", "GHI"],
  ["5", "JKL"],
  ["6", "MNO"],
  ["7", "PQRS"],
  ["8", "TUV"],
  ["9", "WXYZ"],
  ["*", ""],
  ["0", "+"],
  ["#", ""]
];

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

function prettyJson(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

function formatCallerId(value) {
  const digits = digitsOnly(value);
  if (digits === "443300435830") return "+44 330 043 5830";
  if (digits === "442922520491") return "+44 292 252 0491";
  return value || "-";
}

function formatDialNumber(value) {
  const rawDigits = digitsOnly(value).slice(0, 15);
  if (!rawDigits) return "";

  let localDigits = rawDigits;
  if (localDigits.startsWith("44")) localDigits = localDigits.slice(2);
  if (localDigits.startsWith("0")) localDigits = localDigits.slice(1);

  const displayDigits = localDigits.slice(0, 12);
  const chunks = [];
  if (displayDigits.slice(0, 3)) chunks.push(displayDigits.slice(0, 3));
  if (displayDigits.slice(3, 6)) chunks.push(displayDigits.slice(3, 6));
  if (displayDigits.slice(6, 10)) chunks.push(displayDigits.slice(6, 10));
  if (displayDigits.slice(10)) chunks.push(displayDigits.slice(10));
  return `+44 ${chunks.join(" ")}`.trim();
}

function statusClass(status = "") {
  return status.toLowerCase().replace(/\s+/g, "-");
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
  const [testing, setTesting] = useState(false);

  const callerOptions = useMemo(() => {
    const allowed = Array.isArray(config.allowedCallerIds) ? config.allowedCallerIds.filter(Boolean) : [];
    return allowed.length ? allowed : fallbackCallerIds;
  }, [config.allowedCallerIds]);

  const selectedCall = useMemo(() => calls.find((call) => call._id === editing?._id) || editing, [calls, editing]);
  const dialDisplay = formatDialNumber(form.targetPhone);
  const dialDigits = digitsOnly(form.targetPhone);

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
    api("/calls/config/status")
      .then((data) => {
        setConfig(data);
        const allowed = data.allowedCallerIds?.length ? data.allowedCallerIds : fallbackCallerIds;
        if (!form.outboundCallerId) {
          setForm((current) => ({ ...current, outboundCallerId: current.outboundCallerId || allowed[0] }));
        }
      })
      .catch(() => {});
  }

  useEffect(() => {
    load();
    loadStats();
  }, []);

  function updateDialNumber(nextValue) {
    const clean = String(nextValue || "").replace(/[^\d*#]/g, "").slice(0, 15);
    setForm((current) => ({ ...current, targetPhone: clean }));
  }

  function addDialKey(key) {
    if (form.targetPhone.length >= 15) return;
    updateDialNumber(`${form.targetPhone}${key}`);
  }

  function removeDialKey() {
    updateDialNumber(form.targetPhone.slice(0, -1));
  }

  async function startManualCall() {
    if (dialDigits.length <= 3) {
      setStatus({ type: "error", message: "Enter a valid phone number before starting a call." });
      return;
    }

    const formattedPhone = dialDisplay.replace(/\s+/g, "");
    setStarting(true);
    try {
      const result = await api("/calls/start", {
        method: "POST",
        body: {
          ...form,
          targetType: "Manual",
          targetName: formattedPhone,
          targetPhone: formattedPhone,
          outboundCallerId: form.outboundCallerId || callerOptions[0],
          from: form.outboundCallerId || callerOptions[0],
          to: formattedPhone,
          sourceModule: form.sourceModule || "Manual CRM Call"
        }
      });
      setStatus({
        type: result.yay?.ok || result.yay?.skipped ? "success" : "error",
        message: result.yay?.message || "Call logged."
      });
      setForm((current) => ({
        ...emptyManualCall,
        outboundCallerId: current.outboundCallerId || callerOptions[0],
        sourceModule: current.sourceModule || "Manual CRM Call"
      }));
      await load(1);
      loadStats();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setStarting(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    try {
      const result = await api("/calls/config/test", { method: "POST" });
      setStatus({ type: "success", message: result.message || "Yay API connection verified." });
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Yay API connection test failed." });
    } finally {
      setTesting(false);
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
    ["Total Calls", stats.total || 0, Headphones, ""],
    ["Today", stats.todayCalls || 0, PhoneCall, ""],
    ["Connected", stats.connected || 0, CheckCircle2, "success"],
    ["Follow-ups Due", stats.followUpsDue || 0, Clock3, ""],
    ["Failed", stats.failed || 0, XCircle, "danger"]
  ];

  return (
    <div className="admin-calls-page">
      <div className={`calls-api-banner ${config.configured ? "configured" : ""}`}>
        <div>
          <strong>{config.configured ? "Yay API diagnostic" : "Yay API setup required"}</strong>
          <span>
            {config.configured
              ? "Test credentials, API password and allowed IP before placing another call."
              : "Add credentials to Vercel environment variables to activate outbound calls. Currently in CRM logging mode only."}
          </span>
        </div>
        <button type="button" onClick={testConnection} disabled={testing}>
          {testing ? "Testing..." : "Test Yay connection"}
        </button>
      </div>

      <StatusMessage status={status} />

      <section className="calls-stat-grid calls-stat-grid-compact">
        {statCards.map(([label, value, Icon, tone]) => (
          <article className={`calls-stat-card calls-stat-card-compact ${tone}`} key={label}>
            <Icon size={19} />
            <span>{label}</span>
            <strong>{Number(value).toLocaleString()}</strong>
          </article>
        ))}
      </section>

      <div className="calls-dialer-grid">
        <section className="dialpad-card">
          <div className="dialpad-header">
            <label>
              <span>Calling from</span>
              <select value={form.outboundCallerId || callerOptions[0]} onChange={(event) => setForm({ ...form, outboundCallerId: event.target.value })}>
                {callerOptions.map((callerId) => (
                  <option key={callerId} value={callerId}>{formatCallerId(callerId)}</option>
                ))}
              </select>
            </label>
            <div className="dialpad-display">
              <strong className={!dialDisplay ? "muted-display" : ""}>{dialDisplay || "Enter number"}</strong>
              <span>{starting ? `Calling from ${formatCallerId(form.outboundCallerId || callerOptions[0])} ...` : `via ${formatCallerId(form.outboundCallerId || callerOptions[0])}`}</span>
            </div>
          </div>

          <div className="dialpad-keys" aria-label="Dialpad">
            {dialKeys.map(([key, letters]) => (
              <button type="button" className="dialpad-key" key={key} onClick={() => addDialKey(key)}>
                <strong>{key}</strong>
                {letters && <span>{letters}</span>}
              </button>
            ))}
          </div>

          <div className="dialpad-actions">
            <button type="button" className="dialpad-action-button" onClick={removeDialKey} aria-label="Delete last digit">
              <Delete size={19} />
            </button>
            <button type="button" className="dialpad-call-button" onClick={startManualCall} disabled={starting || dialDigits.length <= 3}>
              <PhoneCall size={20} />
            </button>
            <Link className="dialpad-action-button" to="/admin/talent-pool" aria-label="Open Talent Pool">
              <Users size={19} />
            </Link>
          </div>

          <label className="filter-field dialpad-source-field">
            <span>Source / context</span>
            <select value={form.sourceModule} onChange={(event) => setForm({ ...form, sourceModule: event.target.value })}>
              {sourceOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </section>

        <form className="card form calls-panel calls-outcome-panel calls-outcome-modern" onSubmit={saveOutcome}>
          <div className="calls-panel-header">
            <span><ClipboardCheck size={20} /> Log outcome</span>
            <p>Select a call from history to update status, outcome and follow-up.</p>
          </div>
          {selectedCall && (
            <div className="calls-selected-summary">
              <strong>{selectedCall.targetName}</strong>
              <span>{selectedCall.targetPhone} | {selectedCall.sourceModule}</span>
            </div>
          )}
          <div className="form-grid calls-outcome-fields">
            <label className="filter-field">
              <span>Status</span>
              <select disabled={!editing} value={editing?.status || "Queued"} onChange={(event) => setEditing({ ...editing, status: event.target.value })}>
                {statuses.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="filter-field">
              <span>Outcome</span>
              <select disabled={!editing} value={editing?.outcome || "Pending"} onChange={(event) => setEditing({ ...editing, outcome: event.target.value })}>
                {outcomes.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="filter-field">
              <span>Duration seconds</span>
              <input disabled={!editing} type="number" min="0" value={editing?.durationSeconds || 0} onChange={(event) => setEditing({ ...editing, durationSeconds: Number(event.target.value || 0) })} />
            </label>
            <label className="filter-field">
              <span>Follow-up date</span>
              <input disabled={!editing} type="datetime-local" value={dateInput(editing?.followUpAt)} onChange={(event) => setEditing({ ...editing, followUpAt: event.target.value })} />
            </label>
          </div>
          <textarea disabled={!editing} rows="4" placeholder="Outcome notes" value={editing?.notes || ""} onChange={(event) => setEditing({ ...editing, notes: event.target.value })} />
          {selectedCall?.yay?.message && (
            <div className={`call-provider-card ${selectedCall.status === "Failed" ? "error" : ""}`}>
              <span>Yay provider response</span>
              <strong>{selectedCall.yay.message}</strong>
              <p>Status: {selectedCall.yay.requestStatus || "-"} {selectedCall.yay.requestUrl ? `| ${selectedCall.yay.requestUrl}` : ""}</p>
              <details>
                <summary>View technical response</summary>
                <pre>{prettyJson(selectedCall.yay.attempts?.length ? selectedCall.yay.attempts : selectedCall.yay.responsePayload)}</pre>
              </details>
            </div>
          )}
          <SubmitButton loading={saving} loadingText="Saving outcome..." disabled={!editing}>Save Outcome</SubmitButton>
        </form>
      </div>

      <section className="card calls-history-card">
        <div className="calls-history-heading">
          <div>
            <span className="eyebrow"><History size={15} /> Call history</span>
            <h2>Search and filter logged calls</h2>
          </div>
          <strong className="badge">{Number(pagination.total || 0).toLocaleString()} records</strong>
        </div>
        <form className="calls-history-filters" onSubmit={applyFilters}>
          <label className="filter-field">
            <span>Search</span>
            <input placeholder="Name, phone, notes or source" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} />
          </label>
          <label className="filter-field">
            <span>Status</span>
            <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="">All statuses</option>
              {statuses.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="filter-field">
            <span>Outcome</span>
            <select value={filters.outcome} onChange={(event) => setFilters({ ...filters, outcome: event.target.value })}>
              <option value="">All outcomes</option>
              {outcomes.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="filter-field">
            <span>Target type</span>
            <select value={filters.targetType} onChange={(event) => setFilters({ ...filters, targetType: event.target.value })}>
              <option value="">All records</option>
              <option value="Candidate">Candidates</option>
              <option value="BusinessLead">Business leads</option>
              <option value="Manual">Manual</option>
            </select>
          </label>
          <div className="calls-filter-actions">
            <button className="button secondary" type="button" onClick={resetFilters}>Reset</button>
            <button className="button">Apply Filters</button>
          </div>
        </form>

        <div className="table-wrap calls-table calls-history-table">
          <table>
            <thead>
              <tr>
                <th>Contact</th>
                <th>Source</th>
                <th>Status</th>
                <th>Outcome</th>
                <th>Follow-up</th>
                <th>Owner</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan="7">Loading calls...</td></tr>
              ) : calls.length ? calls.map((call) => (
                <tr key={call._id}>
                  <td><strong>{call.targetName}</strong><br /><span className="muted">{call.targetPhone}</span></td>
                  <td><span className="call-source-text">{call.sourceModule}</span><br /><span className="muted">{call.targetType}</span></td>
                  <td>
                    <span className={`call-status-chip ${statusClass(call.status)}`}>{call.status}</span>
                    {call.yay?.message && <small className="call-provider-note">{call.yay.message}</small>}
                  </td>
                  <td>{call.outcome}</td>
                  <td>{dateTime(call.followUpAt)}</td>
                  <td>{call.initiatedBy?.name || "Team"}<br /><span className="muted">{call.initiatedBy?.role || ""}</span></td>
                  <td className="actions compact-actions">
                    <button className="button small" type="button" onClick={() => setEditing(call)}>Update</button>
                    <button className="button secondary small" type="button" onClick={() => deleteCall(call._id)}>Delete</button>
                  </td>
                </tr>
              )) : (
                <tr><td colSpan="7">No calls found.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="talent-pagination calls-pagination">
          <button className="button secondary" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>Previous</button>
          <span>Page {pagination.page} of {pagination.pages} &middot; {Number(pagination.total || 0).toLocaleString()} calls</span>
          <button className="button secondary" disabled={pagination.page >= pagination.pages} onClick={() => load(pagination.page + 1)}>Next</button>
        </div>
      </section>
    </div>
  );
}
