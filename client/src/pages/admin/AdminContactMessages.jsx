import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, CircleAlert,
  Inbox, Mail, MessageSquareText, Phone, RefreshCw, Search, Send, UserRoundCheck
} from "lucide-react";
import { api } from "../../api/client.js";
import { hasPermission } from "../../auth/permissions.js";
import AdminSectionHero from "../../components/AdminSectionHero.jsx";
import StatusMessage from "../../components/StatusMessage.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const emptySummary = { total: 0, new: 0, active: 0, urgent: 0, resolved: 0, byType: [] };
const statuses = ["New", "Read", "In Progress", "Waiting", "Resolved", "Archived"];
const priorities = ["Low", "Normal", "High", "Urgent"];
const inquiryTypes = ["Recruitment Support", "Job Application / CV", "Website Development", "SEO Services", "Partnership", "General Enquiry"];

function dateTime(value) {
  return value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function relativeTime(value) {
  if (!value) return "";
  const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const divisions = [[60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.345, "week"], [12, "month"], [Infinity, "year"]];
  let duration = seconds;
  for (const [amount, unit] of divisions) {
    if (Math.abs(duration) < amount) return formatter.format(Math.round(duration), unit);
    duration /= amount;
  }
  return dateTime(value);
}

function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "IR";
}

function statusClass(value = "") {
  return String(value).toLowerCase().replaceAll(" ", "-");
}

export default function AdminContactMessages() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "contacts.manage");
  const [summary, setSummary] = useState(emptySummary);
  const [assignees, setAssignees] = useState([]);
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ search: "", status: "", priority: "", inquiryType: "", assignedTo: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");
  const [feedback, setFeedback] = useState(null);

  const queryString = useCallback((page = 1, nextFilters = filters) => {
    const params = new URLSearchParams({ page: String(page), limit: "18" });
    Object.entries(nextFilters).forEach(([key, value]) => value && params.set(key, value));
    return params.toString();
  }, [filters]);

  const loadList = useCallback(async (page = 1, nextFilters = filters, preserveSelection = false) => {
    setLoading(true);
    setFeedback(null);
    try {
      const result = await api(`/contact?${queryString(page, nextFilters)}`);
      setData(result);
      if (!preserveSelection) setSelected((current) => result.items.find((item) => item._id === current?._id) || result.items[0] || null);
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }, [filters, queryString]);

  const loadSummary = useCallback(() => api("/contact/summary").then(setSummary).catch(() => {}), []);

  useEffect(() => {
    Promise.all([loadSummary(), api("/contact/assignees").then(setAssignees), loadList(1)]).catch(() => {});
  }, []);

  const sortedNotes = useMemo(() => [...(selected?.internalNotes || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)), [selected]);

  async function openMessage(item) {
    setFeedback(null);
    try {
      const detail = await api(`/contact/${item._id}`);
      setSelected(detail);
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    }
  }

  async function updateMessage(patch, successMessage) {
    if (!selected || !canManage) return;
    setSaving(true);
    setFeedback(null);
    try {
      const updated = await api(`/contact/${selected._id}`, { method: "PATCH", body: patch });
      setSelected((current) => ({ ...current, ...updated }));
      setData((current) => ({ ...current, items: current.items.map((item) => item._id === updated._id ? { ...item, ...updated } : item) }));
      setFeedback({ message: successMessage || "Enquiry updated." });
      await loadSummary();
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function addNote(event) {
    event.preventDefault();
    if (!selected || !note.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      const updated = await api(`/contact/${selected._id}/notes`, { method: "POST", body: { body: note } });
      setSelected(updated);
      setNote("");
      setFeedback({ message: "Internal note added." });
      await Promise.all([loadSummary(), loadList(data.page, filters, true)]);
    } catch (error) {
      setFeedback({ type: "error", message: error.message });
    } finally {
      setSaving(false);
    }
  }

  function applyFilters(event) {
    event?.preventDefault();
    loadList(1, filters);
  }

  function clearFilters() {
    const cleared = { search: "", status: "", priority: "", inquiryType: "", assignedTo: "" };
    setFilters(cleared);
    loadList(1, cleared);
  }

  return (
    <div className="enquiries-page">
      <AdminSectionHero
        icon={Inbox}
        eyebrow="Website lead desk"
        title="Website Enquiries"
        description="Qualify every website conversation, assign clear ownership and keep the response history in one accountable workspace."
        aside={<div className="workspace-hero-count"><MessageSquareText size={18} /><span><small>OPEN ENQUIRIES</small><strong>{summary.new + summary.active}</strong></span></div>}
      />

      <section className="enquiry-summary-grid" aria-label="Enquiry summary">
        <article><span className="enquiry-stat-icon blue"><Inbox /></span><div><small>New</small><strong>{summary.new}</strong><p>Awaiting first action</p></div></article>
        <article><span className="enquiry-stat-icon amber"><CalendarClock /></span><div><small>Active</small><strong>{summary.active}</strong><p>In progress or waiting</p></div></article>
        <article><span className="enquiry-stat-icon red"><CircleAlert /></span><div><small>Urgent</small><strong>{summary.urgent}</strong><p>Open priority enquiries</p></div></article>
        <article><span className="enquiry-stat-icon green"><CheckCircle2 /></span><div><small>Resolved</small><strong>{summary.resolved}</strong><p>Completed conversations</p></div></article>
      </section>

      <StatusMessage status={feedback} />

      <section className="enquiry-workspace">
        <div className={`enquiry-list-pane${selected ? " has-selection" : ""}`}>
          <form className="enquiry-filter-panel" onSubmit={applyFilters}>
            <div className="enquiry-search"><Search size={17} /><input aria-label="Search website enquiries" placeholder="Search name, company, email or message..." value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} /></div>
            <div className="enquiry-filter-row">
              <select aria-label="Filter by status" value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
              <select aria-label="Filter by priority" value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}><option value="">All priorities</option>{priorities.map((item) => <option key={item}>{item}</option>)}</select>
              <select aria-label="Filter by service" value={filters.inquiryType} onChange={(event) => setFilters({ ...filters, inquiryType: event.target.value })}><option value="">All services</option>{inquiryTypes.map((item) => <option key={item}>{item}</option>)}</select>
              <select aria-label="Filter by owner" value={filters.assignedTo} onChange={(event) => setFilters({ ...filters, assignedTo: event.target.value })}><option value="">All owners</option><option value="unassigned">Unassigned</option>{assignees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
            </div>
            <div className="enquiry-filter-actions"><button className="button small" disabled={loading}>{loading ? "Loading..." : "Apply filters"}</button><button className="button small secondary" type="button" onClick={clearFilters}>Clear</button><button className="enquiry-refresh" type="button" aria-label="Refresh enquiries" onClick={() => Promise.all([loadSummary(), loadList(data.page)])}><RefreshCw size={16} /></button></div>
          </form>

          <div className="enquiry-list-header"><div><strong>{data.total}</strong><span>{data.total === 1 ? "enquiry" : "enquiries"}</span></div><small>Newest activity first</small></div>
          <div className="enquiry-list" aria-busy={loading}>
            {loading && !data.items.length ? [1, 2, 3, 4].map((item) => <div className="enquiry-list-skeleton" key={item}><i /><span /><span /></div>) : data.items.map((item) => (
              <button type="button" className={`enquiry-list-item${selected?._id === item._id ? " active" : ""}`} key={item._id} onClick={() => openMessage(item)}>
                <span className="enquiry-avatar">{initials(item.name)}</span>
                <span className="enquiry-list-copy">
                  <span className="enquiry-list-top"><strong>{item.name}</strong><time>{relativeTime(item.lastActivityAt || item.createdAt)}</time></span>
                  <span className="enquiry-list-subject">{item.subject}</span>
                  <span className="enquiry-list-preview">{item.message}</span>
                  <span className="enquiry-list-meta"><i className={`enquiry-status ${statusClass(item.status)}`}>{item.status}</i><i className={`enquiry-priority ${statusClass(item.priority)}`}>{item.priority}</i><em>{item.inquiryType}</em></span>
                </span>
              </button>
            ))}
            {!loading && !data.items.length && <div className="enquiry-empty"><Inbox size={34} /><strong>No enquiries match these filters</strong><span>Clear the filters or check again later.</span></div>}
          </div>
          {data.pages > 1 && <footer className="enquiry-pagination"><button type="button" disabled={data.page <= 1 || loading} onClick={() => loadList(data.page - 1)}><ChevronLeft size={16} /> Previous</button><span>Page <strong>{data.page}</strong> of {data.pages}</span><button type="button" disabled={data.page >= data.pages || loading} onClick={() => loadList(data.page + 1)}>Next <ChevronRight size={16} /></button></footer>}
        </div>

        <aside className={`enquiry-detail-pane${selected ? " open" : ""}`}>
          {selected ? <>
            <header className="enquiry-detail-header">
              <button className="enquiry-mobile-back" type="button" onClick={() => setSelected(null)}><ArrowLeft size={17} /> Back to enquiries</button>
              <div className="enquiry-detail-title"><span className="enquiry-avatar large">{initials(selected.name)}</span><div><span>{selected.inquiryType}</span><h2>{selected.subject}</h2><p>Received {dateTime(selected.createdAt)} via {selected.source || "website"}</p></div></div>
              <div className="enquiry-detail-badges"><span className={`enquiry-status ${statusClass(selected.status)}`}>{selected.status}</span><span className={`enquiry-priority ${statusClass(selected.priority)}`}>{selected.priority} priority</span></div>
            </header>

            <div className="enquiry-contact-strip">
              <div><span className="enquiry-avatar small">{initials(selected.name)}</span><span><small>Contact</small><strong>{selected.name}</strong></span></div>
              <a href={`mailto:${selected.email}`}><Mail size={16} /><span><small>Email</small><strong>{selected.email}</strong></span></a>
              {selected.phone && <a href={`tel:${selected.phone}`}><Phone size={16} /><span><small>Telephone</small><strong>{selected.phone}</strong></span></a>}
            </div>

            {canManage && <section className="enquiry-controls">
              <label><span>Status</span><select value={selected.status} disabled={saving} onChange={(event) => updateMessage({ status: event.target.value }, `Status changed to ${event.target.value}.`)}>{statuses.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span>Priority</span><select value={selected.priority} disabled={saving} onChange={(event) => updateMessage({ priority: event.target.value }, `Priority changed to ${event.target.value}.`)}>{priorities.map((item) => <option key={item}>{item}</option>)}</select></label>
              <label><span>Owner</span><select value={selected.assignedTo?._id || selected.assignedTo || ""} disabled={saving} onChange={(event) => updateMessage({ assignedTo: event.target.value }, "Enquiry owner updated.")}><option value="">Unassigned</option>{assignees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            </section>}

            <section className="enquiry-message-card"><header><MessageSquareText size={18} /><div><span>Original enquiry</span><small>{selected.email}</small></div></header><p>{selected.message}</p><div className="enquiry-message-actions"><a className="button small" href={`mailto:${selected.email}?subject=${encodeURIComponent(`Re: ${selected.subject}`)}`}><Send size={15} /> Reply by email</a>{selected.phone && <a className="button small secondary" href={`tel:${selected.phone}`}><Phone size={15} /> Call contact</a>}</div></section>

            <section className="enquiry-notes-card">
              <header><div><span>Internal timeline</span><h3>Team notes</h3></div><small>{sortedNotes.length} {sortedNotes.length === 1 ? "note" : "notes"}</small></header>
              {canManage && <form onSubmit={addNote}><textarea value={note} maxLength="3000" onChange={(event) => setNote(event.target.value)} placeholder="Record the conversation, next step or important internal context..." /><div><small>{note.length}/3000</small><button className="button small" disabled={saving || !note.trim()}>{saving ? "Saving..." : "Add internal note"}</button></div></form>}
              <div className="enquiry-note-list">
                {sortedNotes.map((item) => <article key={item._id}><span className="enquiry-avatar small">{initials(item.createdBy?.name)}</span><div><header><strong>{item.createdBy?.name || "Team member"}</strong><time>{dateTime(item.createdAt)}</time></header><p>{item.body}</p></div></article>)}
                {!sortedNotes.length && <div className="enquiry-notes-empty"><UserRoundCheck size={24} /><span>No internal notes yet. Add the first action or follow-up above.</span></div>}
              </div>
            </section>
          </> : <div className="enquiry-detail-empty"><Inbox size={42} /><h2>Select an enquiry</h2><p>Open a conversation to review its details, assign ownership and record the next action.</p></div>}
        </aside>
      </section>
    </div>
  );
}
