import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2, CircleDot, Clock3, EyeOff, Filter, HeartHandshake,
  Lightbulb, MessageSquareText, Search, Send, Sparkles, Target, UserRound
} from "lucide-react";
import { api } from "../../api/client.js";
import StatusMessage from "../../components/StatusMessage.jsx";
import SubmitButton from "../../components/SubmitButton.jsx";

const statuses = ["Submitted", "Under Review", "Planned", "Implemented", "Declined"];
const kinds = ["Suggestion", "Process Improvement", "Portal Idea", "Workplace Feedback", "Concern"];
const areas = ["Recruitment", "Sales & CRM", "Training", "People & Culture", "Portal & Technology", "General"];
const emptyForm = { title: "", message: "", kind: "Suggestion", area: "General", impact: "Medium", anonymous: false };

function dateLabel(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function statusClass(value) {
  return String(value || "").toLowerCase().replaceAll(" ", "-");
}

export default function AdminSuggestions() {
  const [data, setData] = useState({ items: [], stats: {}, canManage: false });
  const [form, setForm] = useState(emptyForm);
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [drafts, setDrafts] = useState({});
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState("");

  async function load(nextFilters = filters, silent = false) {
    if (!silent) setLoading(true);
    try {
      const query = new URLSearchParams();
      if (nextFilters.search.trim()) query.set("search", nextFilters.search.trim());
      if (nextFilters.status) query.set("status", nextFilters.status);
      const queryString = query.toString();
      const result = await api(`/employee-suggestions${queryString ? `?${queryString}` : ""}`);
      setData(result);
      setDrafts((current) => {
        const next = { ...current };
        result.items.forEach((item) => {
          if (!next[item._id]) next[item._id] = { status: item.status, adminResponse: item.adminResponse || "" };
        });
        return next;
      });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => { load({ search: "", status: "" }); }, []);

  const progressCount = useMemo(() => (data.stats?.["Under Review"] || 0) + (data.stats?.Planned || 0), [data.stats]);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      const result = await api("/employee-suggestions", { method: "POST", body: form });
      setForm(emptyForm);
      setStatus({ message: result.message });
      await load(filters, true);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function saveReview(item) {
    setReviewing(item._id);
    setStatus(null);
    try {
      const result = await api(`/employee-suggestions/${item._id}`, { method: "PATCH", body: drafts[item._id] });
      setStatus({ message: result.message });
      await load(filters, true);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setReviewing("");
    }
  }

  function applyFilters(event) {
    event.preventDefault();
    load(filters);
  }

  return (
    <div className="suggestions-page">
      <section className="suggestions-hero">
        <div><span className="suggestions-kicker"><Sparkles size={14} /> Employee voice</span><h1>Ideas that make Innovex better.</h1><p>Share practical improvements, portal ideas or workplace feedback. Every submission is tracked and reviewed.</p></div>
        <div className="suggestions-hero-badge"><HeartHandshake size={31} /><span><strong>Your voice matters</strong><small>Thoughtful, respectful and action-focused</small></span></div>
      </section>

      <div className="suggestions-workspace">
        <form className="suggestion-compose" onSubmit={submit}>
          <header><span><Lightbulb size={20} /></span><div><small>NEW SUBMISSION</small><h2>Share a suggestion</h2><p>Give enough detail for the team to understand the opportunity.</p></div></header>
          <div className="suggestion-form-grid">
            <label className="suggestion-field wide"><span>Suggestion title</span><input required minLength="5" maxLength="140" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="What would you like us to improve?" /></label>
            <label className="suggestion-field"><span>Type</span><select value={form.kind} onChange={(event) => setForm({ ...form, kind: event.target.value })}>{kinds.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="suggestion-field"><span>Area</span><select value={form.area} onChange={(event) => setForm({ ...form, area: event.target.value })}>{areas.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="suggestion-field"><span>Potential impact</span><select value={form.impact} onChange={(event) => setForm({ ...form, impact: event.target.value })}><option>Low</option><option>Medium</option><option>High</option></select></label>
            <label className="suggestion-field wide"><span>Details</span><textarea required minLength="15" maxLength="3000" rows="6" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} placeholder="Describe the current challenge, your idea and how it could help..." /><small>{form.message.length}/3000</small></label>
          </div>
          <label className="suggestion-anonymous"><input type="checkbox" checked={form.anonymous} onChange={(event) => setForm({ ...form, anonymous: event.target.checked })} /><span><EyeOff size={17} /><strong>Submit anonymously</strong><small>Your identity will not be displayed in the review workspace.</small></span></label>
          <footer><span><CheckCircle2 size={16} /> Admin will receive a notification</span><SubmitButton loading={saving} loadingText="Sending suggestion..."><Send size={16} /> Submit suggestion</SubmitButton></footer>
        </form>

        <aside className="suggestion-principles">
          <span className="suggestion-principles-icon"><Target size={24} /></span><small>MAKE IT ACTIONABLE</small><h2>A strong suggestion includes</h2>
          <ul><li><span>01</span><div><strong>The current challenge</strong><p>What is slowing the team down?</p></div></li><li><span>02</span><div><strong>Your proposed change</strong><p>What could work better?</p></div></li><li><span>03</span><div><strong>The expected impact</strong><p>How will it help colleagues or clients?</p></div></li></ul>
          <p className="suggestion-privacy-note"><EyeOff size={15} /> Anonymous submissions stay anonymous in the portal.</p>
        </aside>
      </div>

      <StatusMessage status={status} />

      <section className="suggestions-metrics">
        <article><span><MessageSquareText size={18} /></span><div><small>{data.canManage ? "ALL IDEAS" : "MY IDEAS"}</small><strong>{data.stats?.total || 0}</strong></div></article>
        <article><span><Clock3 size={18} /></span><div><small>IN PROGRESS</small><strong>{progressCount}</strong></div></article>
        <article><span><CheckCircle2 size={18} /></span><div><small>IMPLEMENTED</small><strong>{data.stats?.Implemented || 0}</strong></div></article>
      </section>

      <section className="suggestions-feed">
        <header><div><span>{data.canManage ? "TEAM SUBMISSIONS" : "YOUR SUBMISSIONS"}</span><h2>{data.canManage ? "Review employee ideas" : "Track your suggestions"}</h2><p>{data.canManage ? "Respond clearly and keep employees informed about progress." : "See review progress and responses from the Innovex admin team."}</p></div>{data.canManage && <form onSubmit={applyFilters} className="suggestion-filters"><label><Search size={15} /><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search suggestions..." /></label><select aria-label="Filter suggestions by status" value={filters.status} onChange={(event) => { const next = { ...filters, status: event.target.value }; setFilters(next); load(next); }}><option value="">All statuses</option>{statuses.map((item) => <option key={item}>{item}</option>)}</select><button type="submit" aria-label="Apply suggestion filters"><Filter size={16} /></button></form>}</header>

        <div className="suggestion-list">
          {loading && <div className="suggestion-empty"><span className="notification-loader" />Loading suggestions...</div>}
          {!loading && data.items.map((item) => <article className="suggestion-card" key={item._id}>
            <div className="suggestion-card-main">
              <header><span className={`suggestion-status ${statusClass(item.status)}`}><CircleDot size={12} />{item.status}</span><span className={`suggestion-impact ${item.impact.toLowerCase()}`}>{item.impact} impact</span></header>
              <div className="suggestion-card-title"><span><Lightbulb size={19} /></span><div><h3>{item.title}</h3><p><UserRound size={13} /> {item.submittedBy?.name || "Employee"} <i /> {dateLabel(item.createdAt)}</p></div></div>
              <p className="suggestion-message">{item.message}</p>
              <div className="suggestion-tags"><span>{item.kind}</span><span>{item.area}</span>{item.anonymous && <span><EyeOff size={12} /> Anonymous</span>}</div>
              {item.adminResponse && <blockquote><strong>Innovex response</strong><p>{item.adminResponse}</p>{item.reviewedBy?.name && <small>Updated by {item.reviewedBy.name} · {dateLabel(item.statusUpdatedAt)}</small>}</blockquote>}
            </div>
            {data.canManage && <aside className="suggestion-review"><span>REVIEW ACTION</span><label><small>Status</small><select value={drafts[item._id]?.status || item.status} onChange={(event) => setDrafts({ ...drafts, [item._id]: { ...drafts[item._id], status: event.target.value } })}>{statuses.map((value) => <option key={value}>{value}</option>)}</select></label><label><small>Response to employee</small><textarea rows="4" maxLength="2000" value={drafts[item._id]?.adminResponse || ""} onChange={(event) => setDrafts({ ...drafts, [item._id]: { ...drafts[item._id], adminResponse: event.target.value } })} placeholder="Acknowledge the idea or explain the next step..." /></label><button type="button" className="button full" disabled={reviewing === item._id} onClick={() => saveReview(item)}>{reviewing === item._id ? "Saving..." : "Save review"}</button></aside>}
          </article>)}
          {!loading && !data.items.length && <div className="suggestion-empty"><Lightbulb size={30} /><strong>No suggestions yet</strong><p>{data.canManage ? "New employee ideas will appear here." : "Your first idea could make a meaningful difference."}</p></div>}
        </div>
      </section>
    </div>
  );
}
