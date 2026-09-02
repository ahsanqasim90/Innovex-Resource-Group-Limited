import { useEffect, useRef, useState } from "react";
import { CalendarCheck2, UserRoundCheck } from "lucide-react";
import { api } from "../../api/client.js";
import { canViewFinance } from "../../auth/permissions.js";
import AdminSectionHero from "../../components/AdminSectionHero.jsx";
import StatusMessage from "../../components/StatusMessage.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import InterviewDetails from "./interviews/InterviewDetails.jsx";
import InterviewForm, { emptyInterview, toInterviewForm } from "./interviews/InterviewForm.jsx";
import InterviewList from "./interviews/InterviewList.jsx";
import { effectiveInterviewStatus } from "./interviews/interviewStatus.js";

export default function AdminInterviews() {
  const { user } = useAuth();
  const showFinance = canViewFinance(user);
  const [interviews, setInterviews] = useState([]);
  const [form, setForm] = useState(emptyInterview);
  const [filters, setFilters] = useState({ search: "", status: "", date: "", jobTitle: "", selected: "" });
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [outcomeSaving, setOutcomeSaving] = useState(false);
  const [followUpSendingId, setFollowUpSendingId] = useState(null);
  const [detailsSendingId, setDetailsSendingId] = useState(null);
  const formRef = useRef(null);
  const detailRef = useRef(null);
  const summary = {
    total: interviews.length,
    pending: interviews.filter((item) => effectiveInterviewStatus(item) === "Pending").length,
    completed: interviews.filter((item) => effectiveInterviewStatus(item) === "Completed").length,
    awaiting: interviews.filter((item) => item.candidateSelected === "Pending").length,
    revenue: interviews.reduce((sum, item) => sum + Number(item.revenue || 0), 0)
  };

  function load() {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
    api(`/interviews${query ? `?${query}` : ""}`).then(setInterviews).catch((error) => setStatus({ type: "error", message: error.message }));
  }

  useEffect(() => {
    load();
  }, []);

  function scrollToPanel(ref) {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }));
  }

  async function save(event) {
    event.preventDefault();
    const isEditing = Boolean(editing);
    setSaving(true);
    try {
      const payload = {
        ...form,
        confirmationEmailCc: String(form.confirmationEmailCc || "").split(",").map((item) => item.trim()).filter(Boolean)
      };
      const saved = await api(editing ? `/interviews/${editing}` : "/interviews", { method: editing ? "PUT" : "POST", body: payload });
      if (isEditing) {
        setStatus({ message: "Interview booking updated." });
      } else if (saved.confirmationEmailStatus === "Sent") {
        setStatus({ message: `Interview booked and confirmation email sent to ${saved.candidateEmail}.` });
      } else {
        setStatus({
          type: "error",
          message: `Interview booked, but the confirmation email was not sent${saved.confirmationEmailError ? `: ${saved.confirmationEmailError}` : "."}`
        });
      }
      setForm(emptyInterview);
      setEditing(null);
      setSelected(saved);
      load();
      scrollToPanel(detailRef);
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

  async function sendFollowUp(interview) {
    if (!confirm(`Send an interview follow-up email to ${interview.candidateName} at ${interview.candidateEmail}?`)) return;
    setFollowUpSendingId(interview._id);
    try {
      const result = await api(`/interviews/${interview._id}/follow-up`, { method: "POST" });
      setSelected(result.interview);
      setStatus({ message: result.message });
      load();
      scrollToPanel(detailRef);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setFollowUpSendingId(null);
    }
  }

  async function sendDetails(interview) {
    const cc = interview.confirmationEmailCc || [];
    const ccText = cc.length ? `\nCC: ${cc.join(", ")}` : "";
    if (!confirm(`Send interview details to ${interview.candidateName} at ${interview.candidateEmail}?${ccText}`)) return;
    setDetailsSendingId(interview._id);
    try {
      const result = await api(`/interviews/${interview._id}/send-details`, { method: "POST", body: { cc } });
      setSelected(result.interview);
      setStatus({ message: result.message });
      load();
      scrollToPanel(detailRef);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
      load();
    } finally {
      setDetailsSendingId(null);
    }
  }

  function view(interview) {
    setSelected(interview);
    scrollToPanel(detailRef);
  }

  function edit(interview) {
    setEditing(interview._id);
    setForm(toInterviewForm(interview));
    scrollToPanel(formRef);
  }

  return (
    <>
      <AdminSectionHero icon={CalendarCheck2} eyebrow="Candidate coordination" title="Interviews" description="Manage interview bookings, confirmation emails, outcomes and placement value from one workspace." aside={<div className="workspace-hero-count"><UserRoundCheck size={18} /><span><small>PENDING</small><strong>{summary.pending}</strong></span></div>} />
      <StatusMessage status={status} />
      <div className="interview-summary-grid">
        <div className="interview-summary-card"><span>Total bookings</span><strong>{summary.total}</strong></div>
        <div className="interview-summary-card"><span>Pending interviews</span><strong>{summary.pending}</strong></div>
        <div className="interview-summary-card"><span>Completed</span><strong>{summary.completed}</strong></div>
        <div className="interview-summary-card highlight"><span>{showFinance ? "Revenue" : "Awaiting outcome"}</span><strong>{showFinance ? `\u00a3${summary.revenue.toLocaleString()}` : summary.awaiting}</strong></div>
      </div>
      <div className="interview-admin-grid">
        <InterviewForm panelRef={formRef} form={form} setForm={setForm} editing={editing} saving={saving} onSubmit={save} onCancel={() => { setEditing(null); setForm(emptyInterview); }} />
        <InterviewDetails panelRef={detailRef} interview={selected} outcomeSaving={outcomeSaving} onOutcomeSave={saveOutcome} onSendDetails={sendDetails} detailsSending={detailsSendingId === selected?._id} showFinance={showFinance} />
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
        <InterviewList interviews={interviews} onEdit={edit} onDelete={remove} onSelect={view} onFollowUp={sendFollowUp} onSendDetails={sendDetails} followUpSendingId={followUpSendingId} detailsSendingId={detailsSendingId} selectedId={selected?._id} showFinance={showFinance} />
      </div>
    </>
  );
}
