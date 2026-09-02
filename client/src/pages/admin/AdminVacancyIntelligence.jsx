import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, BarChart3, BookOpenCheck, BrainCircuit, BriefcaseBusiness, Check, ChevronRight, Download, FileSearch, Gauge, ListChecks, Mail, MapPin, RefreshCw, Save, Search, Send, ShieldCheck, SlidersHorizontal, Sparkles, Target, ThumbsDown, ThumbsUp, UploadCloud, UserRoundCheck, UsersRound, X } from "lucide-react";
import { api, downloadFile } from "../../api/client.js";
import CvReviewModal from "../../components/CvReviewModal.jsx";
import StatusMessage from "../../components/StatusMessage.jsx";
import SubmitButton from "../../components/SubmitButton.jsx";

const emptyVacancy = {
  title: "",
  location: "",
  postcode: "",
  radiusMiles: 25,
  salary: "",
  type: "Permanent",
  shift: "",
  requirements: "",
  description: "",
  isActive: true
};

const stages = ["Shortlisted", "Contacted", "Interested", "Submitted", "Interview", "Offered", "Placed", "Rejected"];

function scoreClass(score) {
  if (score >= 80) return "strong";
  if (score >= 65) return "good";
  if (score >= 50) return "review";
  return "low";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";
}

function conciseOverview(value = "", limit = 380) {
  const text = String(value || "").replace(/\s+/g, " ").trim();
  if (text.length <= limit) return text;
  const shortened = text.slice(0, limit);
  return `${shortened.slice(0, shortened.lastIndexOf(" "))}…`;
}

function vacancyForm(job) {
  return {
    ...emptyVacancy,
    ...job,
    requirements: Array.isArray(job.requirements) ? job.requirements.join("\n") : ""
  };
}

function criteriaForm(job = {}) {
  const criteria = job.criteriaReview || {};
  const score = job.scoreProfile || {};
  return {
    mandatorySkills: (criteria.mandatorySkills?.length ? criteria.mandatorySkills : job.intelligence?.skills || []).join("\n"),
    desirableSkills: (criteria.desirableSkills?.length ? criteria.desirableSkills : job.intelligence?.desirableRequirements || []).join("\n"),
    qualifications: (criteria.qualifications?.length ? criteria.qualifications : job.intelligence?.qualifications || []).join("\n"),
    minimumExperienceYears: criteria.minimumExperienceYears || job.intelligence?.experienceYears || 0,
    registrationRequired: Boolean(criteria.registrationRequired),
    registrationTerms: (criteria.registrationTerms || []).join("\n"),
    rightToWorkRequired: criteria.rightToWorkRequired !== false,
    drivingRequired: Boolean(criteria.drivingRequired),
    availabilityRequirement: criteria.availabilityRequirement || job.shift || "",
    scoreProfile: {
      name: score.name || "Balanced",
      skills: score.skills ?? 30,
      experience: score.experience ?? 25,
      qualifications: score.qualifications ?? 20,
      location: score.location ?? 15,
      availability: score.availability ?? 5,
      recency: score.recency ?? 5
    }
  };
}

export default function AdminVacancyIntelligence() {
  const [vacancies, setVacancies] = useState([]);
  const [summary, setSummary] = useState({});
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState(emptyVacancy);
  const [document, setDocument] = useState(null);
  const [editing, setEditing] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [matching, setMatching] = useState(false);
  const [matches, setMatches] = useState([]);
  const [matchMeta, setMatchMeta] = useState(null);
  const [minimumScore, setMinimumScore] = useState(45);
  const [preparing, setPreparing] = useState(false);
  const [prepareProgress, setPrepareProgress] = useState(null);
  const [selectedCompare, setSelectedCompare] = useState([]);
  const [preview, setPreview] = useState(null);
  const [working, setWorking] = useState("");
  const [workspaceTab, setWorkspaceTab] = useState("overview");
  const [criteriaDraft, setCriteriaDraft] = useState(criteriaForm());
  const [savingCriteria, setSavingCriteria] = useState(false);
  const [senderAccounts, setSenderAccounts] = useState([]);
  const [selectedSender, setSelectedSender] = useState("");
  const [emailModal, setEmailModal] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  const selectedVacancy = useMemo(() => vacancies.find((vacancy) => vacancy._id === selectedId) || null, [vacancies, selectedId]);
  const comparison = useMemo(() => matches.filter((match) => selectedCompare.includes(String(match.candidateId))), [matches, selectedCompare]);
  const criteriaQuality = useMemo(() => {
    if (!selectedVacancy) return 0;
    const criteria = selectedVacancy.criteriaReview || {};
    return Math.min(100, 30 + (criteria.mandatorySkills?.length || 0) * 6 + (criteria.qualifications?.length || 0) * 7 + Number(Boolean(criteria.minimumExperienceYears)) * 8 + Number(criteria.reviewStatus === "Reviewed") * 25);
  }, [selectedVacancy]);
  const scoreWeightTotal = Object.entries(criteriaDraft.scoreProfile || {}).filter(([key]) => key !== "name").reduce((total, [, value]) => total + Number(value || 0), 0);

  async function load(preferredId = selectedId) {
    setLoading(true);
    try {
      const [data, metrics] = await Promise.all([api("/vacancy-intelligence"), api("/vacancy-intelligence/summary")]);
      setVacancies(data.items || []);
      setSummary(metrics || {});
      setCanManage(Boolean(data.canManage));
      const nextId = preferredId && data.items?.some((item) => item._id === preferredId) ? preferredId : data.items?.[0]?._id || "";
      setSelectedId(nextId);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    api("/vacancy-intelligence/senders").then((data) => {
      setSenderAccounts(data.senders || []);
      setSelectedSender(data.senders?.[0]?.address || "");
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedVacancy) setCriteriaDraft(criteriaForm(selectedVacancy));
  }, [selectedVacancy?._id, selectedVacancy?.updatedAt]);

  useEffect(() => () => {
    if (preview?.url) URL.revokeObjectURL(preview.url);
  }, [preview]);

  async function saveVacancy(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      if (document) body.append("document", document);
      const result = await api(editing ? `/vacancy-intelligence/${editing}` : "/vacancy-intelligence", { method: editing ? "PUT" : "POST", body });
      setStatus({ message: result.message });
      setForm(emptyVacancy);
      setDocument(null);
      setEditing(null);
      setMatches([]);
      await load(result.item?._id);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSaving(false);
    }
  }

  function editVacancy(job) {
    setEditing(job._id);
    setForm(vacancyForm(job));
    setDocument(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function prepareLibrary() {
    setPreparing(true);
    setPrepareProgress({ indexed: 0, remaining: "Checking" });
    let totalIndexed = 0;
    try {
      for (let batch = 0; batch < 30; batch += 1) {
        const result = await api("/candidate-cvs/index-library", { method: "POST", body: { limit: 8 } });
        totalIndexed += result.indexed || 0;
        setPrepareProgress({ indexed: totalIndexed, remaining: result.remaining || 0 });
        if (!result.remaining || (!result.indexed && result.failed?.length)) break;
      }
      setStatus({ message: `${totalIndexed} CVs prepared. Vacancy matching library is up to date.` });
      await load(selectedId);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setPreparing(false);
    }
  }

  async function runMatches(id = selectedId) {
    if (!id) return;
    setMatching(true);
    setSelectedCompare([]);
    try {
      const data = await api(`/vacancy-intelligence/${id}/matches?minimumScore=${minimumScore}&limit=200`);
      setMatches(data.matches || []);
      setMatchMeta({ analysedCandidates: data.analysedCandidates, returned: data.returned, generatedAt: data.generatedAt });
      setWorkspaceTab("matches");
      setStatus({ message: `${data.analysedCandidates} indexed CVs analysed. ${data.returned} candidates meet the selected score.` });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setMatching(false);
    }
  }

  async function saveCriteria(event) {
    event.preventDefault();
    if (!selectedId) return;
    setSavingCriteria(true);
    try {
      const result = await api(`/vacancy-intelligence/${selectedId}/criteria`, { method: "PATCH", body: { criteria: criteriaDraft, scoreProfile: criteriaDraft.scoreProfile } });
      setStatus({ message: result.message });
      await load(selectedId);
      setWorkspaceTab("overview");
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSavingCriteria(false);
    }
  }

  function openVacancyEmail(match) {
    setEmailModal({
      match,
      subject: `${selectedVacancy.title} opportunity in ${selectedVacancy.location} – Innovex Resource Group`,
      introduction: `Based on your profile, we thought you may be interested in this ${selectedVacancy.title} opportunity.`
    });
  }

  async function sendVacancyEmail(event) {
    event.preventDefault();
    if (!emailModal || !selectedSender) return;
    setSendingEmail(true);
    try {
      const result = await api(`/vacancy-intelligence/${selectedId}/email-candidate`, { method: "POST", body: { candidateId: emailModal.match.candidateId, matchScore: emailModal.match.matchScore, fromEmail: selectedSender, subject: emailModal.subject, introduction: emailModal.introduction } });
      setMatches((current) => current.map((item) => String(item.candidateId) === String(emailModal.match.candidateId) ? { ...item, pipeline: result.pipeline } : item));
      setStatus({ message: result.message });
      setEmailModal(null);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSendingEmail(false);
    }
  }

  async function submitFeedback(match, verdict) {
    setWorking(`feedback-${match.candidateId}`);
    try {
      const result = await api(`/vacancy-intelligence/${selectedId}/feedback`, { method: "POST", body: { candidateId: match.candidateId, matchScore: match.matchScore, verdict } });
      setMatches((current) => current.map((item) => String(item.candidateId) === String(match.candidateId) ? { ...item, recruiterFeedback: result.feedback } : item));
      setStatus({ message: result.message });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setWorking("");
    }
  }

  async function updatePipeline(match, stage) {
    setWorking(`pipeline-${match.candidateId}`);
    try {
      const result = await api(`/vacancy-intelligence/${selectedId}/pipeline`, { method: "PATCH", body: { candidateId: match.candidateId, stage, matchScore: match.matchScore } });
      setMatches((current) => current.map((item) => String(item.candidateId) === String(match.candidateId) ? { ...item, pipeline: result.pipeline } : item));
      setStatus({ message: result.message });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setWorking("");
    }
  }

  function toggleCompare(match) {
    const id = String(match.candidateId);
    setSelectedCompare((current) => current.includes(id) ? current.filter((item) => item !== id) : current.length < 3 ? [...current, id] : current);
  }

  function openCv(match) {
    setPreview({ match });
  }

  const filteredVacancies = vacancies.filter((vacancy) => !search.trim() || `${vacancy.title} ${vacancy.location} ${vacancy.vacancyId}`.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <section className="admin-page vacancy-intelligence-page">
      <header className="vacancy-intelligence-hero">
        <div>
          <span className="eyebrow"><BrainCircuit size={16} /> Privacy-safe recruitment intelligence</span>
          <h1>Vacancy Intelligence</h1>
          <p>Upload a job description, analyse your CV library and build an evidence-backed shortlist in minutes.</p>
        </div>
        <div className="vacancy-hero-badge"><ShieldCheck size={22} /><span><strong>Human decision required</strong>Protected characteristics excluded</span></div>
      </header>

      <StatusMessage status={status} />

      <section className="vacancy-metric-grid">
        <article><BriefcaseBusiness /><span>Vacancies</span><strong>{summary.total || 0}</strong><small>{summary.active || 0} active</small></article>
        <article><FileSearch /><span>Searchable CVs</span><strong>{summary.indexedCandidates || 0}</strong><small>Securely indexed</small></article>
        <article><ListChecks /><span>Shortlists</span><strong>{summary.vacanciesWithShortlists || 0}</strong><small>Vacancies in progress</small></article>
        <article><UserRoundCheck /><span>Placements</span><strong>{summary.vacanciesWithPlacements || 0}</strong><small>Tracked outcomes</small></article>
      </section>

      {canManage && (
        <form className="card vacancy-create-card" onSubmit={saveVacancy}>
          <div className="vacancy-section-head">
            <div><span className="eyebrow"><Sparkles size={15} /> Intelligent vacancy setup</span><h2>{editing ? "Update vacancy intelligence" : "Upload and analyse a vacancy"}</h2><p>PDF/DOCX content is extracted securely. You can also paste the description directly.</p></div>
            {editing && <button className="button secondary small" type="button" onClick={() => { setEditing(null); setForm(emptyVacancy); setDocument(null); }}>Cancel edit</button>}
          </div>
          <div className="vacancy-form-grid">
            <label><span>Job title *</span><input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Registered Manager" required /></label>
            <label><span>Location *</span><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Cardiff" required /></label>
            <label><span>Postcode</span><input value={form.postcode} onChange={(event) => setForm({ ...form, postcode: event.target.value })} placeholder="CF10" /></label>
            <label><span>Search radius</span><select value={form.radiusMiles} onChange={(event) => setForm({ ...form, radiusMiles: event.target.value })}>{[5, 10, 15, 25, 35, 50, 75, 100].map((radius) => <option value={radius} key={radius}>{radius} miles</option>)}</select></label>
            <label><span>Salary</span><input value={form.salary} onChange={(event) => setForm({ ...form, salary: event.target.value })} placeholder="£40,000 - £45,000" /></label>
            <label><span>Job type</span><select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}><option>Permanent</option><option>Temporary</option><option>Contract</option></select></label>
            <label><span>Shift</span><input value={form.shift} onChange={(event) => setForm({ ...form, shift: event.target.value })} placeholder="Days / full time" /></label>
            <label className="vacancy-active-check"><span>Status</span><div><input type="checkbox" checked={form.isActive} onChange={(event) => setForm({ ...form, isActive: event.target.checked })} /> Active vacancy</div></label>
          </div>
          <div className="vacancy-document-grid">
            <label className="vacancy-file-drop">
              <UploadCloud size={24} />
              <strong>{document ? document.name : editing && selectedVacancy?.sourceDocument?.originalName ? selectedVacancy.sourceDocument.originalName : "Choose job description"}</strong>
              <small>Genuine PDF or DOCX · maximum 5 MB</small>
              <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setDocument(event.target.files?.[0] || null)} />
            </label>
            <label><span>Key requirements</span><textarea value={form.requirements} onChange={(event) => setForm({ ...form, requirements: event.target.value })} placeholder="One mandatory or desirable requirement per line" /></label>
          </div>
          <label className="vacancy-description-field"><span>Job description {document ? "(uploaded file will be used)" : "*"}</span><textarea value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="Paste the complete job description here, or upload it above..." required={!document} /></label>
          <div className="vacancy-form-actions">
            <SubmitButton loading={saving} loadingText="Analysing vacancy..."><BrainCircuit size={17} /> {editing ? "Update intelligence" : "Create and analyse"}</SubmitButton>
            <button className="button secondary" type="button" onClick={prepareLibrary} disabled={preparing}><RefreshCw size={16} className={preparing ? "spin" : ""} /> {preparing ? `Preparing ${prepareProgress?.indexed || 0} · ${prepareProgress?.remaining ?? "-"} remaining` : "Prepare CV library"}</button>
          </div>
        </form>
      )}

      <div className="vacancy-workspace-grid">
        <aside className="card vacancy-list-panel">
          <div className="vacancy-list-title"><div><span className="eyebrow">Vacancy portfolio</span><h2>Select a role</h2></div><span>{vacancies.length}</span></div>
          <label className="vacancy-list-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search vacancies" /></label>
          <div className="vacancy-list">
            {loading ? <p>Loading vacancies...</p> : filteredVacancies.map((vacancy) => (
              <button type="button" className={selectedId === vacancy._id ? "active" : ""} key={vacancy._id} onClick={() => { setSelectedId(vacancy._id); setMatches([]); setMatchMeta(null); setWorkspaceTab("overview"); }}>
                <span className={`vacancy-status-dot ${vacancy.isActive ? "active" : "closed"}`} />
                <span><strong>{vacancy.title}</strong><small><MapPin size={12} /> {vacancy.location}</small><em>{vacancy.vacancyId}</em></span>
                <ChevronRight size={17} />
              </button>
            ))}
            {!loading && !filteredVacancies.length && <p>No matching vacancies.</p>}
          </div>
        </aside>

        <main className="vacancy-match-workspace">
          {!selectedVacancy ? (
            <div className="card vacancy-no-selection"><Target size={42} /><h2>Select or create a vacancy</h2><p>The intelligence workspace will appear here.</p></div>
          ) : (
            <>
              <nav className="vacancy-workspace-tabs" aria-label="Vacancy intelligence sections">
                <button type="button" className={workspaceTab === "overview" ? "active" : ""} onClick={() => setWorkspaceTab("overview")}><BriefcaseBusiness size={17} /><span>Overview<small>Role and quality</small></span></button>
                <button type="button" className={workspaceTab === "criteria" ? "active" : ""} onClick={() => setWorkspaceTab("criteria")}><SlidersHorizontal size={17} /><span>Criteria<small>Review scoring rules</small></span><em>{selectedVacancy.criteriaReview?.reviewStatus === "Reviewed" ? "Reviewed" : "Action"}</em></button>
                <button type="button" className={workspaceTab === "matches" ? "active" : ""} onClick={() => setWorkspaceTab("matches")}><UsersRound size={17} /><span>Matches<small>Shortlist candidates</small></span>{matchMeta && <em>{matches.length}</em>}</button>
              </nav>

              {workspaceTab === "overview" && (
                <article className="card vacancy-analysis-card vacancy-overview-card">
                  <div className="vacancy-analysis-top">
                    <div><span className="vacancy-record-id">{selectedVacancy.vacancyId}</span><h2>{selectedVacancy.title}</h2><p><MapPin size={15} /> {selectedVacancy.location}{selectedVacancy.postcode ? ` · ${selectedVacancy.postcode}` : ""} · {selectedVacancy.type}</p></div>
                    <div className="vacancy-analysis-actions">
                      {canManage && <button className="button secondary small" type="button" onClick={() => editVacancy(selectedVacancy)}>Edit vacancy</button>}
                      {canManage && selectedVacancy.sourceDocument?.originalName && <button className="button secondary small" type="button" onClick={() => downloadFile(`/vacancy-intelligence/${selectedVacancy._id}/document`, selectedVacancy.sourceDocument.originalName)}><Download size={14} /> Original JD</button>}
                    </div>
                  </div>
                  <div className="vacancy-overview-grid">
                    <section><span className="eyebrow">Role overview</span><p className="vacancy-analysis-summary">{conciseOverview(selectedVacancy.intelligence?.summary || selectedVacancy.description)}</p></section>
                    <aside className="vacancy-quality-panel"><div className="vacancy-quality-score"><strong>{criteriaQuality}</strong><span>/100</span></div><div><strong>Matching readiness</strong><p>{selectedVacancy.criteriaReview?.reviewStatus === "Reviewed" ? "Recruiter criteria approved" : "Review must-haves before shortlisting"}</p></div></aside>
                  </div>
                  <div className="vacancy-criteria-preview">
                    <section><strong><BadgeCheck size={16} /> Must-have skills</strong><div>{(selectedVacancy.criteriaReview?.mandatorySkills || []).slice(0, 7).map((item) => <span key={item}>{item}</span>)}{!selectedVacancy.criteriaReview?.mandatorySkills?.length && <small>None confirmed</small>}</div></section>
                    <section><strong><ListChecks size={16} /> Qualifications</strong><div>{(selectedVacancy.criteriaReview?.qualifications || []).slice(0, 7).map((item) => <span key={item}>{item}</span>)}{!selectedVacancy.criteriaReview?.qualifications?.length && <small>None confirmed</small>}</div></section>
                    <section><strong><Sparkles size={16} /> Desirable</strong><div>{(selectedVacancy.criteriaReview?.desirableSkills || []).slice(0, 7).map((item) => <span key={item}>{item}</span>)}{!selectedVacancy.criteriaReview?.desirableSkills?.length && <small>None confirmed</small>}</div></section>
                  </div>
                  <div className="vacancy-analysis-facts">
                    <span><strong>{selectedVacancy.criteriaReview?.minimumExperienceYears || 0}+</strong> years requested</span>
                    <span><strong>{selectedVacancy.criteriaReview?.mandatorySkills?.length || 0}</strong> confirmed must-haves</span>
                    <span><strong>{selectedVacancy.criteriaReview?.qualifications?.length || 0}</strong> qualifications</span>
                    <span><strong>{selectedVacancy.radiusMiles || 25}</strong> mile radius</span>
                  </div>
                  <details className="vacancy-raw-jd"><summary>View original job description</summary><p>{selectedVacancy.description}</p></details>
                  <div className="vacancy-overview-actions"><button className="button secondary" type="button" onClick={() => setWorkspaceTab("criteria")}><SlidersHorizontal size={16} /> Review criteria</button><button className="button" type="button" onClick={() => runMatches()} disabled={matching}><Sparkles size={17} /> {matching ? "Analysing..." : "Run intelligent matching"}</button></div>
                </article>
              )}

              {workspaceTab === "criteria" && (
                <form className="card vacancy-criteria-editor" onSubmit={saveCriteria}>
                  <div className="vacancy-section-head"><div><span className="eyebrow"><SlidersHorizontal size={15} /> Recruiter review</span><h2>Approve the matching criteria</h2><p>The system suggests criteria from the JD. Confirm them before using the shortlist for decisions.</p></div><span className={`criteria-review-state ${selectedVacancy.criteriaReview?.reviewStatus === "Reviewed" ? "reviewed" : "pending"}`}>{selectedVacancy.criteriaReview?.reviewStatus === "Reviewed" ? <BadgeCheck size={16} /> : <AlertTriangle size={16} />}{selectedVacancy.criteriaReview?.reviewStatus || "Pending review"}</span></div>
                  <div className="vacancy-criteria-grid">
                    <label><span>Mandatory skills <small>one per line</small></span><textarea value={criteriaDraft.mandatorySkills} onChange={(event) => setCriteriaDraft({ ...criteriaDraft, mandatorySkills: event.target.value })} /></label>
                    <label><span>Desirable skills <small>one per line</small></span><textarea value={criteriaDraft.desirableSkills} onChange={(event) => setCriteriaDraft({ ...criteriaDraft, desirableSkills: event.target.value })} /></label>
                    <label><span>Qualifications <small>one per line</small></span><textarea value={criteriaDraft.qualifications} onChange={(event) => setCriteriaDraft({ ...criteriaDraft, qualifications: event.target.value })} /></label>
                    <label><span>Registration terms <small>e.g. NMC PIN</small></span><textarea value={criteriaDraft.registrationTerms} onChange={(event) => setCriteriaDraft({ ...criteriaDraft, registrationTerms: event.target.value })} /></label>
                    <label><span>Minimum experience (years)</span><input type="number" min="0" max="40" value={criteriaDraft.minimumExperienceYears} onChange={(event) => setCriteriaDraft({ ...criteriaDraft, minimumExperienceYears: event.target.value })} /></label>
                    <label><span>Availability requirement</span><input value={criteriaDraft.availabilityRequirement} onChange={(event) => setCriteriaDraft({ ...criteriaDraft, availabilityRequirement: event.target.value })} placeholder="Full-time, nights, immediate..." /></label>
                  </div>
                  <fieldset className="vacancy-eligibility-switches"><legend>Eligibility gates</legend>
                    <label><input type="checkbox" checked={criteriaDraft.registrationRequired} onChange={(event) => setCriteriaDraft({ ...criteriaDraft, registrationRequired: event.target.checked })} /><span><strong>Professional registration</strong><small>Flag missing or unverified registration</small></span></label>
                    <label><input type="checkbox" checked={criteriaDraft.rightToWorkRequired} onChange={(event) => setCriteriaDraft({ ...criteriaDraft, rightToWorkRequired: event.target.checked })} /><span><strong>Right to work</strong><small>Require recruiter confirmation</small></span></label>
                    <label><input type="checkbox" checked={criteriaDraft.drivingRequired} onChange={(event) => setCriteriaDraft({ ...criteriaDraft, drivingRequired: event.target.checked })} /><span><strong>Driving requirement</strong><small>Check licence or travel evidence</small></span></label>
                  </fieldset>
                  <section className="vacancy-weight-editor"><div><span className="eyebrow"><BarChart3 size={15} /> Score profile</span><h3>{criteriaDraft.scoreProfile.name} weighting</h3></div><span className={scoreWeightTotal === 100 ? "valid" : "invalid"}>{scoreWeightTotal}% total</span><div className="vacancy-weight-grid">{[["skills", "Skills"], ["experience", "Experience"], ["qualifications", "Qualifications"], ["location", "Location"], ["availability", "Availability"], ["recency", "CV recency"]].map(([key, label]) => <label key={key}><span>{label}</span><div><input type="range" min="0" max="50" step="5" value={criteriaDraft.scoreProfile[key]} onChange={(event) => setCriteriaDraft({ ...criteriaDraft, scoreProfile: { ...criteriaDraft.scoreProfile, [key]: Number(event.target.value) } })} /><strong>{criteriaDraft.scoreProfile[key]}%</strong></div></label>)}</div></section>
                  <div className="vacancy-criteria-actions"><button className="button secondary" type="button" onClick={() => setCriteriaDraft(criteriaForm(selectedVacancy))}>Reset</button><SubmitButton loading={savingCriteria} loadingText="Saving criteria..." disabled={scoreWeightTotal !== 100}><Save size={16} /> Approve and save criteria</SubmitButton></div>
                </form>
              )}

              {workspaceTab === "matches" && <>
                <section className="card vacancy-match-controls">
                  <div><span className="eyebrow"><Gauge size={15} /> Candidate ranking</span><h2>Evidence-backed shortlist</h2><p>Synonym-aware matching, eligibility gates and real postcode distance with a human decision at every stage.</p></div>
                  <label><span>Minimum score: <strong>{minimumScore}%</strong></span><input type="range" min="0" max="90" step="5" value={minimumScore} onChange={(event) => setMinimumScore(event.target.value)} /></label>
                  <button className="button" type="button" onClick={() => runMatches()} disabled={matching}><RefreshCw size={17} className={matching ? "spin" : ""} /> {matching ? "Analysing CV library..." : "Refresh matching"}</button>
                </section>

                {matchMeta && <div className="vacancy-match-meta"><BrainCircuit size={16} /> {matchMeta.analysedCandidates} CVs analysed · {matchMeta.returned} ranked results · {formatDate(matchMeta.generatedAt)}</div>}

                {comparison.length > 0 && (
                  <section className="card vacancy-comparison">
                    <div className="vacancy-section-head"><div><span className="eyebrow">Side-by-side review</span><h2>Candidate comparison</h2></div><button className="button secondary small" type="button" onClick={() => setSelectedCompare([])}>Clear comparison</button></div>
                    <div className="vacancy-comparison-grid">{comparison.map((match) => <article key={match.candidateId}><span className={`match-score ${scoreClass(match.matchScore)}`}>{match.matchScore}%</span><h3>{match.name}</h3><p>{match.desiredRole || "Role not recorded"}</p><dl><div><dt>Skills</dt><dd>{match.breakdown.skills}%</dd></div><div><dt>Experience</dt><dd>{match.breakdown.roleExperience}%</dd></div><div><dt>Location</dt><dd>{match.breakdown.location}%</dd></div><div><dt>Qualifications</dt><dd>{match.breakdown.qualifications}%</dd></div></dl></article>)}</div>
                  </section>
                )}

                <section className="vacancy-results-list">
                  {matches.map((match, index) => (
                    <article className="card vacancy-match-card" key={match.candidateId}>
                      <div className="vacancy-match-rank">#{index + 1}</div>
                      <div className={`vacancy-score-ring ${scoreClass(match.matchScore)}`}><strong>{match.matchScore}</strong><small>%</small></div>
                      <div className="vacancy-match-main">
                        <div className="vacancy-match-name"><div><span>{match.recordId}</span><h2>{match.name}</h2><p>{match.desiredRole || "Desired role not recorded"} · {match.postcode || match.city || "Location not recorded"}</p></div><div className="vacancy-match-badges"><span className={`eligibility-badge ${(match.eligibility?.status || "review").toLowerCase()}`}>{match.eligibility?.status === "Pass" ? <BadgeCheck size={14} /> : <AlertTriangle size={14} />}{match.eligibility?.status || "Review"}</span><span className="confidence-badge"><Gauge size={14} /> {match.confidence?.label || "Confidence pending"}</span></div></div>
                        <div className="vacancy-score-bars">{Object.entries(match.breakdown).map(([label, score]) => <div key={label}><span>{label.replace(/([A-Z])/g, " $1")}</span><div><i style={{ width: `${score}%` }} /></div><strong>{score}%</strong></div>)}</div>
                        <div className="vacancy-match-details">
                          <div><strong><Check size={15} /> Matched evidence</strong><div className="vacancy-match-chips matched">{match.matchedSkills.length ? match.matchedSkills.map((skill) => <span key={skill}>{skill}</span>) : <span>Profile relevance detected</span>}</div></div>
                          <div><strong><FileSearch size={15} /> Recruiter checks</strong><div className="vacancy-match-chips missing">{match.missingSkills.length ? match.missingSkills.map((skill) => <span key={skill}>{skill}</span>) : <span>No keyword gaps found</span>}</div></div>
                        </div>
                        {match.eligibility?.checks?.length > 0 && <div className="vacancy-eligibility-matrix"><strong><AlertTriangle size={15} /> Eligibility verification</strong>{match.eligibility.checks.map((check) => <span key={`${check.label}-${check.status}`}><i className={check.status.toLowerCase()} />{check.label}<em>{check.status}</em></span>)}</div>}
                        {match.dataQualityIssues?.length > 0 && <div className="vacancy-data-quality"><AlertTriangle size={15} /><span><strong>Data quality:</strong> {match.dataQualityIssues.join(" · ")}</span></div>}
                        {match.evidence?.length > 0 && <details className="vacancy-evidence"><summary>View CV evidence</summary>{match.evidence.map((snippet, snippetIndex) => <blockquote key={snippetIndex}>…{snippet}…</blockquote>)}</details>}
                        <div className="vacancy-feedback-dock"><span><strong>Was this ranking useful?</strong>{match.recruiterFeedback?.verdict && <em>Saved: {match.recruiterFeedback.verdict}</em>}</span><button type="button" className={match.recruiterFeedback?.verdict === "Accurate" ? "active" : ""} onClick={() => submitFeedback(match, "Accurate")} disabled={working === `feedback-${match.candidateId}`}><ThumbsUp size={14} /> Accurate</button><button type="button" className={match.recruiterFeedback?.verdict === "Needs correction" ? "active" : ""} onClick={() => submitFeedback(match, "Needs correction")} disabled={working === `feedback-${match.candidateId}`}><ThumbsDown size={14} /> Needs correction</button></div>
                        <div className="vacancy-match-footer"><span><ShieldCheck size={14} /> {match.safeguards}</span><span><MapPin size={14} /> {match.locationAssessment}</span></div>
                      </div>
                      <div className="vacancy-match-actions">
                        <span className={`match-recommendation ${scoreClass(match.matchScore)}`}>{match.recommendation}</span>
                        <button className="button vacancy-email-button small" type="button" onClick={() => openVacancyEmail(match)} disabled={!match.email || !senderAccounts.length}><Mail size={14} /> Email vacancy</button>
                        <button className="button secondary small" type="button" onClick={() => toggleCompare(match)} disabled={!selectedCompare.includes(String(match.candidateId)) && selectedCompare.length >= 3}>{selectedCompare.includes(String(match.candidateId)) ? <X size={14} /> : <UsersRound size={14} />} {selectedCompare.includes(String(match.candidateId)) ? "Remove" : "Compare"}</button>
                        {match.cv && <button className="button secondary small vacancy-review-button" type="button" onClick={() => openCv(match)} disabled={working === `preview-${match.candidateId}`}><BookOpenCheck size={14} /> {working === `preview-${match.candidateId}` ? "Opening CV..." : "Review complete CV"}</button>}
                        <label><span>Pipeline</span><select value={match.pipeline?.stage || ""} onChange={(event) => updatePipeline(match, event.target.value)} disabled={working === `pipeline-${match.candidateId}`}><option value="" disabled>Add to pipeline</option>{stages.map((stage) => <option key={stage}>{stage}</option>)}</select></label>
                        {match.pipeline?.vacancyEmailSentAt && <small className="vacancy-email-sent"><BadgeCheck size={13} /> Sent {formatDate(match.pipeline.vacancyEmailSentAt)}</small>}
                      </div>
                    </article>
                  ))}
                  {!matching && matchMeta && !matches.length && <div className="card vacancy-no-results"><FileSearch size={38} /><h2>No candidates meet this score</h2><p>Lower the minimum score, confirm CVs are prepared, or improve candidate profile data.</p></div>}
                  {!matching && !matchMeta && <div className="card vacancy-no-results"><Target size={38} /><h2>Run matching to build a shortlist</h2><p>Review the vacancy criteria first, then analyse every securely indexed CV.</p><button className="button" type="button" onClick={() => runMatches()}><Sparkles size={16} /> Run matching</button></div>}
                </section>
              </>}
            </>
          )}
        </main>
      </div>

      {emailModal && (
        <div className="vacancy-email-overlay" role="dialog" aria-modal="true" aria-labelledby="vacancy-email-title">
          <form className="vacancy-email-modal" onSubmit={sendVacancyEmail}>
            <header><div><span className="eyebrow"><Send size={15} /> Candidate communication</span><h2 id="vacancy-email-title">Email vacancy details</h2><p>Review the personalised message before it is sent and recorded in the activity log.</p></div><button type="button" onClick={() => setEmailModal(null)} aria-label="Close email"><X size={21} /></button></header>
            <section className="vacancy-email-recipient"><div className="vacancy-email-avatar">{emailModal.match.name?.charAt(0)?.toUpperCase()}</div><div><strong>{emailModal.match.name}</strong><span>{emailModal.match.email}</span></div><em>{emailModal.match.matchScore}% match</em></section>
            <div className="vacancy-email-fields">
              <label><span>Send from</span><select value={selectedSender} onChange={(event) => setSelectedSender(event.target.value)} required>{senderAccounts.map((account) => <option value={account.address} key={account.address}>{account.name} — {account.address}</option>)}</select></label>
              <label><span>Email subject</span><input value={emailModal.subject} onChange={(event) => setEmailModal({ ...emailModal, subject: event.target.value })} maxLength="180" required /></label>
              <label><span>Personal introduction</span><textarea value={emailModal.introduction} onChange={(event) => setEmailModal({ ...emailModal, introduction: event.target.value })} maxLength="1200" required /></label>
            </div>
            <section className="vacancy-email-snapshot"><span className="eyebrow">Vacancy details included automatically</span><h3>{selectedVacancy.title}</h3><p><MapPin size={14} /> {selectedVacancy.location}{selectedVacancy.postcode ? ` · ${selectedVacancy.postcode}` : ""} · {selectedVacancy.type}</p><div>{selectedVacancy.salary && <span>{selectedVacancy.salary}</span>}{selectedVacancy.shift && <span>{selectedVacancy.shift}</span>}</div></section>
            <div className="vacancy-email-assurance"><ShieldCheck size={17} /><span><strong>Secure and auditable</strong>The send is logged, archived to the mailbox Sent folder, and the candidate pipeline is updated to Contacted.</span></div>
            <footer><button className="button secondary" type="button" onClick={() => setEmailModal(null)}>Cancel</button><SubmitButton loading={sendingEmail} loadingText="Sending securely..." disabled={!selectedSender}><Send size={16} /> Confirm and send</SubmitButton></footer>
          </form>
        </div>
      )}

      {preview && <CvReviewModal candidateName={preview.match.name} reference={`${preview.match.recordId} · ${preview.match.matchScore}% vacancy match`} filename={preview.match.cv?.originalName} reviewPath={`/candidate-cvs/${preview.match.candidateId}/review-text`} canDownload={false} onClose={() => setPreview(null)} />}
    </section>
  );
}
