import { useState } from "react";
import { BadgeCheck, Copy, FileUp, MapPin, SearchCheck, Target } from "lucide-react";
import { api } from "../../api/client.js";
import AdminSectionHero from "../../components/AdminSectionHero.jsx";
import StatusMessage from "../../components/StatusMessage.jsx";
import SubmitButton from "../../components/SubmitButton.jsx";

const emptyForm = { name: "", email: "", phone: "", postcode: "", desiredRole: "", experience: "", availability: "", shiftPreference: "", cvText: "" };

function scoreClass(score) {
  if (score >= 80) return "strong";
  if (score >= 65) return "good";
  if (score >= 50) return "review";
  return "low";
}

function referralNote(candidateName, match) {
  const { vacancy } = match;
  const where = [vacancy.clientName, vacancy.location].filter(Boolean).join(", ");
  const distance = Number.isFinite(match.distanceMiles) ? `${match.distanceMiles} miles away` : "distance to confirm";
  return `${candidateName || "Candidate"} for ${vacancy.title}${vacancy.reference ? ` (${vacancy.reference})` : ""}${where ? ` at ${where}` : ""}: ${match.matchScore}% match, ${distance}. ${match.reasons.slice(0, 3).join("; ")}.`;
}

export default function AdminCandidateMatch() {
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState("");

  const update = (field) => (event) => setForm((current) => ({ ...current, [field]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setLoading(true); setStatus(null); setResult(null);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => value && body.append(key, value));
      if (file) body.append("cv", file);
      const data = await api("/candidate-match", { method: "POST", body });
      setResult({ ...data, candidateName: form.name || "Candidate" });
      if (!data.matches.length) setStatus({ type: "info", message: "No open vacancies matched. Try adding more detail about the candidate's role and experience." });
    } catch (error) {
      setStatus({ type: "error", message: error.message || "Matching could not be completed." });
    } finally {
      setLoading(false);
    }
  }

  async function copy(text, id) {
    try { await navigator.clipboard.writeText(text); setCopied(id); window.setTimeout(() => setCopied(""), 1800); } catch { setStatus({ type: "error", message: "Copy is blocked by the browser. Select the text manually." }); }
  }

  return (
    <div className="cvm-page">
      <AdminSectionHero icon={SearchCheck} eyebrow="Vacancy Intelligence" title="CV to vacancy match" description="Add a candidate's details and CV. Every open vacancy is scored by distance from the candidate's postcode, skills, role, shift and eligibility, and the best places to refer them are listed with the reasons." />
      <form className="card cvm-form" onSubmit={submit}>
        <div className="cvm-grid">
          <label><span>Candidate name</span><input value={form.name} onChange={update("name")} placeholder="e.g. Jane Doe" /></label>
          <label><span>Postcode <em>(important for distance)</em></span><input value={form.postcode} onChange={update("postcode")} placeholder="e.g. BD3 8AA" /></label>
          <label><span>Email</span><input type="email" value={form.email} onChange={update("email")} /></label>
          <label><span>Phone</span><input value={form.phone} onChange={update("phone")} /></label>
          <label><span>Desired role</span><input value={form.desiredRole} onChange={update("desiredRole")} placeholder="e.g. Registered Nurse" /></label>
          <label><span>Experience</span><input value={form.experience} onChange={update("experience")} placeholder="e.g. 6 years nursing home" /></label>
          <label><span>Availability</span><input value={form.availability} onChange={update("availability")} placeholder="e.g. Immediate, full time" /></label>
          <label><span>Shift preference</span><input value={form.shiftPreference} onChange={update("shiftPreference")} placeholder="e.g. Nights, weekends" /></label>
        </div>
        <label className="cvm-file"><FileUp size={20} /><span><strong>{file ? file.name : "Attach CV (PDF or Word)"}</strong><small>The CV is only read to score vacancies. It is not saved.</small></span><input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setFile(event.target.files?.[0] || null)} /></label>
        <label className="cvm-text"><span>Or paste extra CV text / notes (optional)</span><textarea rows={4} value={form.cvText} onChange={update("cvText")} /></label>
        <StatusMessage status={status} />
        <div className="cvm-actions"><SubmitButton loading={loading} loadingText="Matching vacancies...">Find best vacancies</SubmitButton></div>
      </form>

      {result && result.matches.length > 0 && <section className="cvm-results" aria-live="polite">
        <header>
          <div><h2>Best places to refer {result.candidateName}</h2><p>{result.analysedVacancies} open vacancies checked{result.candidateLocation?.found ? "" : ". The postcode could not be located, so distance is estimated from text."}</p></div>
          <button type="button" className="button secondary small" onClick={() => copy(result.matches.slice(0, 5).map((match, index) => `${index + 1}. ${referralNote(result.candidateName, match)}`).join("\n"), "all")}><Copy size={15} />{copied === "all" ? "Copied" : "Copy top 5"}</button>
        </header>
        {result.matches.map((match, index) => <article className={`cvm-card ${scoreClass(match.matchScore)}`} key={match.vacancy.id}>
          <span className="cvm-rank">{index + 1}</span>
          <div className="cvm-main">
            <div className="cvm-title"><h3>{match.vacancy.title}</h3><b className="cvm-score">{match.matchScore}%</b></div>
            <p className="cvm-meta"><span><MapPin size={14} />{[match.vacancy.location, match.vacancy.postcode].filter(Boolean).join(" · ") || "Location not set"}</span>{Number.isFinite(match.distanceMiles) && <span><Target size={14} />{match.distanceMiles} miles away</span>}{match.vacancy.reference && <span>{match.vacancy.reference}</span>}{match.vacancy.salary && <span>{match.vacancy.salary}</span>}{match.vacancy.shift && <span>{match.vacancy.shift}</span>}</p>
            {match.vacancy.clientName && <p className="cvm-client"><BadgeCheck size={14} />Client: <strong>{match.vacancy.clientName}</strong> <em>(internal only)</em></p>}
            <p className="cvm-verdict">{match.recommendation}</p>
            <ul>{match.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
            {match.dataQualityIssues?.length > 0 && <small className="cvm-warn">Limited data: {match.dataQualityIssues.join(", ")}</small>}
            <div className="cvm-card-actions"><button type="button" className="button secondary small" onClick={() => copy(referralNote(result.candidateName, match), match.vacancy.id)}><Copy size={14} />{copied === match.vacancy.id ? "Copied" : "Copy referral note"}</button></div>
          </div>
        </article>)}
        <p className="cvm-disclaimer">{result.method} Protected characteristics are not used. A recruiter should always review before referring.</p>
      </section>}
    </div>
  );
}
