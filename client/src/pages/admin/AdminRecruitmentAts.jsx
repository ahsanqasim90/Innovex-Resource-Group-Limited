import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  Clock3,
  Download,
  FileCheck2,
  Filter,
  MapPin,
  Plus,
  Search,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UsersRound,
  X
} from "lucide-react";
import { api, downloadFile } from "../../api/client.js";
import CvReviewModal from "../../components/CvReviewModal.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const emptyCandidate = {
  job: "",
  candidateName: "",
  email: "",
  phone: "",
  location: "",
  currentRole: "",
  experienceYears: "",
  currentSalary: "",
  expectedSalary: "",
  noticePeriod: "",
  rightToWork: "",
  linkedinUrl: "",
  recruiterSummary: "",
  consentConfirmed: false,
  cv: null
};

const boardColumns = [
  { key: "internal", label: "Internal review", stages: ["Pending admin review", "Changes requested"], tone: "amber" },
  { key: "client", label: "Client review", stages: ["Client review"], tone: "blue" },
  { key: "interview", label: "Interview", stages: ["Interview requested", "Interview scheduled"], tone: "violet" },
  { key: "offer", label: "Offer stage", stages: ["Offer stage"], tone: "teal" },
  { key: "hired", label: "Hired", stages: ["Hired"], tone: "green" }
];

const reviewerStages = [
  "Pending admin review",
  "Changes requested",
  "Admin rejected",
  "Client review",
  "Interview requested",
  "Interview scheduled",
  "Client rejected",
  "Offer stage",
  "Hired",
  "Withdrawn"
];

function dateLabel(value, withTime = false) {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-GB", withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" });
}

function initials(name = "") {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";
}

function useAtsModalControls(onClose) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);
}

function StagePill({ stage }) {
  const tone = stage === "Hired" ? "green" : stage.includes("rejected") || stage === "Withdrawn" ? "red" : stage.includes("Interview") ? "violet" : stage === "Client review" ? "blue" : stage === "Offer stage" ? "teal" : "amber";
  return <span className={`ats-stage-pill ${tone}`}>{stage}</span>;
}

function Metric({ icon: Icon, label, value, note, tone }) {
  return (
    <article className={`ats-metric ${tone || ""}`}>
      <span className="ats-metric-icon"><Icon size={20} /></span>
      <div><span>{label}</span><strong>{value ?? 0}</strong><small>{note}</small></div>
    </article>
  );
}

function CandidateCard({ item, onOpen }) {
  return (
    <button type="button" className="ats-candidate-card" onClick={() => onOpen(item)}>
      <div className="ats-card-head">
        <span className="ats-avatar">{initials(item.candidateName)}</span>
        <span><strong>{item.candidateName}</strong><small>{item.currentRole || "Candidate"}</small></span>
        <ChevronRight size={17} />
      </div>
      <div className="ats-card-job"><BriefcaseBusiness size={14} /><span>{item.job?.title || "Vacancy"}</span></div>
      <div className="ats-card-meta">
        <span>{item.reference}</span>
        <span>{dateLabel(item.updatedAt)}</span>
      </div>
      <div className="ats-card-owner"><span className="ats-mini-avatar">{initials(item.submittedBy?.name)}</span><span>{item.submittedBy?.name || "Recruiter"}</span></div>
    </button>
  );
}

function CandidateSubmitModal({ vacancies, onClose, onCreated }) {
  const [form, setForm] = useState(emptyCandidate);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  useAtsModalControls(onClose);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => {
        if (key === "cv") {
          if (value) body.append("cv", value);
        } else body.append(key, String(value ?? ""));
      });
      await api("/recruitment-workflow", { method: "POST", body });
      onCreated();
      onClose();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="ats-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <form className="ats-submit-modal" role="dialog" aria-modal="true" aria-labelledby="ats-submit-title" onSubmit={submit}>
        <header>
          <div><span className="eyebrow">Recruiter submission</span><h2 id="ats-submit-title">Submit candidate for review</h2><p>Complete the screening record before sending it to the internal quality gate.</p></div>
          <button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        {message && <div className="ats-alert error">{message}</div>}
        <section className="ats-form-section">
          <div className="ats-form-section-title"><span>01</span><div><strong>Vacancy</strong><small>Choose the active role this candidate is being represented for.</small></div></div>
          <label className="ats-field full"><span>Active vacancy *</span><select required value={form.job} onChange={(event) => set("job", event.target.value)}><option value="">Select a vacancy</option>{vacancies.map((job) => <option key={job._id} value={job._id}>{job.reference ? `${job.reference} · ` : ""}{job.title} — {job.location}</option>)}</select></label>
        </section>
        <section className="ats-form-section">
          <div className="ats-form-section-title"><span>02</span><div><strong>Candidate profile</strong><small>Core identity, contact and current employment details.</small></div></div>
          <div className="ats-form-grid">
            <label className="ats-field"><span>Full name *</span><input required value={form.candidateName} onChange={(event) => set("candidateName", event.target.value)} /></label>
            <label className="ats-field"><span>Email address *</span><input type="email" required value={form.email} onChange={(event) => set("email", event.target.value)} /></label>
            <label className="ats-field"><span>Phone number *</span><input required value={form.phone} onChange={(event) => set("phone", event.target.value)} /></label>
            <label className="ats-field"><span>Location</span><input value={form.location} onChange={(event) => set("location", event.target.value)} /></label>
            <label className="ats-field"><span>Current role</span><input value={form.currentRole} onChange={(event) => set("currentRole", event.target.value)} /></label>
            <label className="ats-field"><span>Experience (years)</span><input type="number" min="0" max="60" value={form.experienceYears} onChange={(event) => set("experienceYears", event.target.value)} /></label>
            <label className="ats-field"><span>Current salary / rate</span><input value={form.currentSalary} onChange={(event) => set("currentSalary", event.target.value)} /></label>
            <label className="ats-field"><span>Expected salary / rate</span><input value={form.expectedSalary} onChange={(event) => set("expectedSalary", event.target.value)} /></label>
            <label className="ats-field"><span>Notice period</span><input placeholder="e.g. 2 weeks" value={form.noticePeriod} onChange={(event) => set("noticePeriod", event.target.value)} /></label>
            <label className="ats-field"><span>Right to work</span><input placeholder="e.g. UK citizen / Skilled Worker" value={form.rightToWork} onChange={(event) => set("rightToWork", event.target.value)} /></label>
            <label className="ats-field full"><span>LinkedIn profile</span><input type="url" placeholder="https://linkedin.com/in/..." value={form.linkedinUrl} onChange={(event) => set("linkedinUrl", event.target.value)} /></label>
          </div>
        </section>
        <section className="ats-form-section">
          <div className="ats-form-section-title"><span>03</span><div><strong>Screening evidence</strong><small>Explain fit, motivation, availability and any concerns for the reviewer.</small></div></div>
          <label className="ats-field full"><span>Recruiter screening summary *</span><textarea required rows="6" maxLength="5000" placeholder="Summarise relevant experience, essential requirements checked, motivation, availability and salary alignment..." value={form.recruiterSummary} onChange={(event) => set("recruiterSummary", event.target.value)} /></label>
          <label className="ats-file-field"><FileCheck2 size={22} /><span><strong>{form.cv?.name || "Upload candidate CV *"}</strong><small>Genuine PDF or DOCX, up to 5 MB</small></span><input type="file" accept=".pdf,.docx" required onChange={(event) => set("cv", event.target.files?.[0] || null)} /></label>
          <label className="ats-consent"><input type="checkbox" required checked={form.consentConfirmed} onChange={(event) => set("consentConfirmed", event.target.checked)} /><span>I confirm the candidate has agreed to be represented for this vacancy and their data can be processed for recruitment purposes.</span></label>
        </section>
        <footer><button type="button" className="button secondary" onClick={onClose}>Cancel</button><button className="button" disabled={saving}>{saving ? "Submitting securely..." : "Submit for admin review"}<ArrowRight size={17} /></button></footer>
      </form>
    </div>,
    document.body
  );
}

function CandidateDetail({ item, canReview, onClose, onUpdated }) {
  const [stage, setStage] = useState(item.stage);
  const [note, setNote] = useState("");
  const [interview, setInterview] = useState({ interviewDate: "", interviewTime: "", interviewFormat: "Video", locationOrLink: "", contactName: "" });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [cvReviewOpen, setCvReviewOpen] = useState(false);
  const needsNote = ["Changes requested", "Admin rejected", "Client rejected"].includes(stage);
  const needsInterview = stage === "Interview scheduled";
  useAtsModalControls(onClose);

  async function updateStage() {
    setSaving(true);
    setMessage(null);
    try {
      const updated = await api(`/recruitment-workflow/${item._id}/stage`, { method: "PATCH", body: { stage, note, ...interview } });
      onUpdated(updated);
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="ats-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="ats-detail-modal" role="dialog" aria-modal="true" aria-labelledby="ats-detail-title">
        <header>
          <div className="ats-detail-identity"><span className="ats-avatar large">{initials(item.candidateName)}</span><div><span>{item.reference}</span><h2 id="ats-detail-title">{item.candidateName}</h2><p>{item.currentRole || "Candidate"} · {item.location || "Location not recorded"}</p></div></div>
          <button type="button" onClick={onClose} aria-label="Close"><X size={20} /></button>
        </header>
        <div className="ats-detail-status"><StagePill stage={item.stage} /><span>Last updated {dateLabel(item.updatedAt, true)}</span></div>
        {message && <div className="ats-alert error">{message}</div>}
        <div className="ats-detail-grid">
          <main>
            <section className="ats-detail-panel"><div className="ats-panel-title"><BriefcaseBusiness size={18} /><h3>Vacancy</h3></div><div className="ats-vacancy-line"><strong>{item.job?.title || "Vacancy"}</strong><span>{item.job?.clientName || "Confidential client"} · {item.job?.location}</span><small>{item.job?.salary} · {item.job?.type}</small></div></section>
            <section className="ats-detail-panel"><div className="ats-panel-title"><CircleUserRound size={18} /><h3>Candidate details</h3></div><dl className="ats-detail-list"><div><dt>Email</dt><dd>{item.email}</dd></div><div><dt>Phone</dt><dd>{item.phone}</dd></div><div><dt>Experience</dt><dd>{item.experienceYears != null ? `${item.experienceYears} years` : "—"}</dd></div><div><dt>Notice period</dt><dd>{item.noticePeriod || "—"}</dd></div><div><dt>Current salary</dt><dd>{item.currentSalary || "—"}</dd></div><div><dt>Expected salary</dt><dd>{item.expectedSalary || "—"}</dd></div><div><dt>Right to work</dt><dd>{item.rightToWork || "—"}</dd></div><div><dt>LinkedIn</dt><dd>{item.linkedinUrl ? <a href={item.linkedinUrl} target="_blank" rel="noreferrer">Open profile</a> : "—"}</dd></div></dl></section>
            <section className="ats-detail-panel"><div className="ats-panel-title"><Sparkles size={18} /><h3>Recruiter screening summary</h3></div><p className="ats-summary-copy">{item.recruiterSummary}</p></section>
            {item.interview?.date && <section className="ats-detail-panel ats-interview-panel"><div className="ats-panel-title"><CalendarDays size={18} /><h3>Interview details</h3></div><p><strong>{dateLabel(item.interview.date)}</strong> at {item.interview.time || "time TBC"}</p><span>{item.interview.format}{item.interview.locationOrLink ? ` · ${item.interview.locationOrLink}` : ""}</span></section>}
          </main>
          <aside>
            <section className="ats-detail-panel"><div className="ats-panel-title"><UserCheck size={18} /><h3>Ownership &amp; CV</h3></div><div className="ats-owner-profile"><span className="ats-avatar">{initials(item.submittedBy?.name)}</span><span><strong>{item.submittedBy?.name}</strong><small>{item.submittedBy?.email}</small></span></div><button className="button full" type="button" onClick={() => setCvReviewOpen(true)}><FileCheck2 size={16} /> Review CV in portal</button><button className="button secondary full" type="button" onClick={() => downloadFile(`/recruitment-workflow/${item._id}/cv`, item.cv?.originalName || "candidate-cv")}><Download size={16} /> Download original</button></section>
            {canReview && <section className="ats-detail-panel ats-review-panel"><div className="ats-panel-title"><ShieldCheck size={18} /><h3>Review action</h3></div><label className="ats-field"><span>Move candidate to</span><select value={stage} onChange={(event) => setStage(event.target.value)}>{reviewerStages.map((value) => <option key={value}>{value}</option>)}</select></label>{needsNote && <label className="ats-field"><span>Feedback / reason *</span><textarea rows="4" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Give the recruiter clear, actionable feedback..." /></label>}{needsInterview && <div className="ats-interview-fields"><label className="ats-field"><span>Date *</span><input type="date" value={interview.interviewDate} onChange={(event) => setInterview({ ...interview, interviewDate: event.target.value })} /></label><label className="ats-field"><span>Time</span><input type="time" value={interview.interviewTime} onChange={(event) => setInterview({ ...interview, interviewTime: event.target.value })} /></label><label className="ats-field"><span>Format</span><select value={interview.interviewFormat} onChange={(event) => setInterview({ ...interview, interviewFormat: event.target.value })}><option>Video</option><option>Telephone</option><option>In person</option></select></label><label className="ats-field"><span>Link / location</span><input value={interview.locationOrLink} onChange={(event) => setInterview({ ...interview, locationOrLink: event.target.value })} /></label></div>}<button type="button" className="button full" disabled={saving || stage === item.stage} onClick={updateStage}>{saving ? "Updating..." : "Confirm stage update"}</button></section>}
            <section className="ats-detail-panel"><div className="ats-panel-title"><Clock3 size={18} /><h3>Activity timeline</h3></div><div className="ats-timeline">{[...(item.timeline || [])].reverse().map((event) => <article key={event._id || `${event.createdAt}-${event.toStage}`}><span /><div><strong>{event.toStage || event.type}</strong><small>{event.actor?.name || "System"} · {dateLabel(event.createdAt, true)}</small>{event.note && <p>{event.note}</p>}</div></article>)}</div></section>
          </aside>
        </div>
      </section>
      {cvReviewOpen && <CvReviewModal candidateName={item.candidateName} reference={item.reference} filename={item.cv?.originalName} reviewPath={`/recruitment-workflow/${item._id}/cv-review`} downloadPath={`/recruitment-workflow/${item._id}/cv`} onClose={() => setCvReviewOpen(false)} />}
    </div>,
    document.body
  );
}

export default function AdminRecruitmentAts() {
  const { user } = useAuth();
  const [data, setData] = useState({ submissions: [], vacancies: [], stats: {}, canReview: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("pipeline");
  const [search, setSearch] = useState("");
  const [vacancy, setVacancy] = useState("");
  const [mine, setMine] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const result = await api("/recruitment-workflow/overview");
      setData(result);
      setError("");
      if (selected) setSelected(result.submissions.find((item) => item._id === selected._id) || null);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return data.submissions.filter((item) => {
      const searchable = `${item.candidateName} ${item.email} ${item.phone} ${item.reference} ${item.job?.title}`.toLowerCase();
      return (!query || searchable.includes(query)) && (!vacancy || item.job?._id === vacancy) && (!mine || item.submittedBy?.user === user?.id);
    });
  }, [data.submissions, mine, search, user?.id, vacancy]);

  const archived = filtered.filter((item) => ["Admin rejected", "Client rejected", "Withdrawn"].includes(item.stage));

  return (
    <div className="ats-page">
      <section className="ats-hero">
        <div><span className="ats-live"><i /> LIVE RECRUITMENT OPERATIONS</span><h1>Recruitment Command Centre</h1><p>One accountable workflow from recruiter submission to client approval, interview and placement.</p></div>
        <button className="ats-primary-action" type="button" onClick={() => setSubmitOpen(true)}><Plus size={19} /><span>Submit candidate<small>Send to admin review</small></span></button>
      </section>

      <section className="ats-metrics">
        <Metric icon={BriefcaseBusiness} label="Open vacancies" value={data.stats.activeVacancies} note="Ready for submissions" tone="navy" />
        <Metric icon={Clock3} label="Awaiting review" value={data.stats.awaitingAdmin} note="Internal quality gate" tone="amber" />
        <Metric icon={UsersRound} label="With clients" value={data.stats.withClient} note="Awaiting feedback" tone="blue" />
        <Metric icon={CalendarDays} label="Interviews" value={data.stats.interviews} note="Requested or scheduled" tone="violet" />
        <Metric icon={CheckCircle2} label="Hired" value={data.stats.hired} note="Successful placements" tone="green" />
      </section>

      <section className="ats-workspace">
        <div className="ats-toolbar-top">
          <nav><button className={tab === "pipeline" ? "active" : ""} onClick={() => setTab("pipeline")}>Candidate pipeline <span>{data.submissions.length}</span></button><button className={tab === "vacancies" ? "active" : ""} onClick={() => setTab("vacancies")}>Active vacancies <span>{data.vacancies.length}</span></button></nav>
          <div className="ats-toolbar-actions"><button type="button" className={mine ? "active" : ""} onClick={() => setMine((value) => !value)}><CircleUserRound size={16} /> My submissions</button></div>
        </div>
        <div className="ats-filters">
          <label><Search size={17} /><input placeholder="Search candidate, reference or role..." value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <label><Filter size={17} /><select value={vacancy} onChange={(event) => setVacancy(event.target.value)}><option value="">All vacancies</option>{data.vacancies.map((job) => <option key={job._id} value={job._id}>{job.title} — {job.location}</option>)}</select></label>
          <span>{filtered.length} visible candidate{filtered.length === 1 ? "" : "s"}</span>
        </div>

        {error && <div className="ats-alert error">{error}</div>}
        {loading ? <div className="ats-loading"><span /> Loading live recruitment pipeline...</div> : tab === "pipeline" ? (
          <>
            <div className="ats-board">
              {boardColumns.map((column) => {
                const items = filtered.filter((item) => column.stages.includes(item.stage));
                return <section className={`ats-board-column ${column.tone}`} key={column.key}><header><span>{column.label}</span><strong>{items.length}</strong></header><div>{items.map((item) => <CandidateCard key={item._id} item={item} onOpen={setSelected} />)}{!items.length && <div className="ats-empty-column"><UsersRound size={20} /><span>No candidates at this stage</span></div>}</div></section>;
              })}
            </div>
            {archived.length > 0 && <section className="ats-closed-section"><header><div><span>Closed records</span><p>Rejected and withdrawn submissions remain visible for governance and audit.</p></div><strong>{archived.length}</strong></header><div className="ats-closed-grid">{archived.map((item) => <CandidateCard key={item._id} item={item} onOpen={setSelected} />)}</div></section>}
          </>
        ) : (
          <div className="ats-vacancy-grid">
            {data.vacancies.map((job) => {
              const jobSubmissions = data.submissions.filter((item) => item.job?._id === job._id);
              return <article className="ats-vacancy-card" key={job._id}><header><span className={`ats-priority ${String(job.priority || "Medium").toLowerCase()}`}>{job.priority || "Medium"} priority</span><span>{job.reference || `VAC-${job._id.slice(-5).toUpperCase()}`}</span></header><h2>{job.title}</h2><p>{job.clientName || "Confidential client"}</p><div className="ats-vacancy-meta"><span><MapPin size={15} />{job.location}</span><span><BriefcaseBusiness size={15} />{job.type}</span></div><div className="ats-vacancy-stats"><div><strong>{job.openings || 1}</strong><span>Openings</span></div><div><strong>{jobSubmissions.length}</strong><span>Submitted</span></div><div><strong>{jobSubmissions.filter((item) => item.stage.includes("Interview")).length}</strong><span>Interviews</span></div></div><footer><span>Closes {dateLabel(job.closingDate)}</span><button type="button" onClick={() => { setSubmitOpen(true); }}>Submit candidate <ArrowRight size={15} /></button></footer></article>;
            })}
          </div>
        )}
      </section>
      {submitOpen && <CandidateSubmitModal vacancies={data.vacancies} onClose={() => setSubmitOpen(false)} onCreated={load} />}
      {selected && <CandidateDetail item={selected} canReview={data.canReview} onClose={() => setSelected(null)} onUpdated={(updated) => { setSelected(updated); load(); }} />}
    </div>
  );
}
