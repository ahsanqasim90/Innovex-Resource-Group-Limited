import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, Facebook, Instagram, Linkedin, Megaphone, RefreshCw, Send } from "lucide-react";
import { api } from "../../api/client.js";
import AdminSectionHero from "../../components/AdminSectionHero.jsx";
import StatusMessage from "../../components/StatusMessage.jsx";
import { renderJobCard } from "../../utils/socialCard.js";

const dateLabel = (value) => (value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "");

export default function AdminSocialPosting() {
  const [status, setStatus] = useState({ facebook: false, instagram: false });
  const [jobs, setJobs] = useState([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [draft, setDraft] = useState(null);
  const [caption, setCaption] = useState("");
  const [preview, setPreview] = useState({ url: "", blob: null });
  const [platforms, setPlatforms] = useState({ facebook: true, instagram: true });
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [results, setResults] = useState([]);
  const previewUrl = useRef("");

  async function loadJobs() {
    try {
      const [state, list] = await Promise.all([api("/social/status"), api("/social/jobs")]);
      setStatus(state);
      setJobs(list);
    } catch (error) {
      setMessage({ type: "error", message: error.message || "Could not load vacancies." });
    }
  }
  useEffect(() => { loadJobs(); return () => { if (previewUrl.current) URL.revokeObjectURL(previewUrl.current); }; }, []);

  async function choose(job) {
    setSelected(job); setDraft(null); setResults([]); setMessage(null); setForce(false);
    try {
      const data = await api(`/social/jobs/${job._id}/draft`);
      setDraft(data);
      setCaption(data.caption);
      const blob = await renderJobCard(data.job);
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
      previewUrl.current = URL.createObjectURL(blob);
      setPreview({ url: previewUrl.current, blob });
    } catch (error) {
      setMessage({ type: "error", message: error.message || "Could not prepare the post." });
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return jobs.filter((job) => !term || `${job.title} ${job.location} ${job.reference || ""}`.toLowerCase().includes(term));
  }, [jobs, search]);

  const chosen = ["facebook", "instagram"].filter((key) => platforms[key] && status[key]);

  async function postNow() {
    if (!chosen.length || !preview.blob) return;
    setBusy(true); setMessage(null); setResults([]);
    try {
      const body = new FormData();
      body.append("image", new File([preview.blob], "job.jpg", { type: "image/jpeg" }));
      body.append("jobId", selected._id);
      const media = await api("/social/media", { method: "POST", body });
      const data = await api(`/social/jobs/${selected._id}/publish`, { method: "POST", body: JSON.stringify({ platforms: chosen, caption, mediaKey: media.key, force }) });
      setResults(data.results || []);
      loadJobs();
    } catch (error) {
      setMessage({ type: "error", message: error.message || "Posting failed." });
    } finally {
      setBusy(false);
    }
  }

  async function copyCaption() {
    try { await navigator.clipboard.writeText(caption); setMessage({ type: "success", message: "Caption copied." }); } catch { setMessage({ type: "error", message: "Copy is blocked by the browser. Select the caption and copy it manually." }); }
  }

  async function shareToLinkedIn() {
    try { await navigator.clipboard.writeText(caption); } catch { /* the box is prefilled anyway */ }
    window.open(`https://www.linkedin.com/feed/?shareActive=true&text=${encodeURIComponent(caption)}`, "_blank", "noopener");
    setMessage({ type: "info", message: "LinkedIn opened with the caption filled in. Attach the downloaded image, choose Innovex Company Page as the poster, then press Post." });
  }

  function downloadImage() {
    if (!preview.url) return;
    const link = document.createElement("a");
    link.href = preview.url;
    link.download = `${(selected?.title || "job").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.jpg`;
    link.click();
  }

  return (
    <div className="smp-page">
      <AdminSectionHero icon={Megaphone} eyebrow="Recruitment" title="Social posting" description="Pick a vacancy, check the caption and image, then post to Facebook and Instagram in one click. LinkedIn opens with the post ready for you to publish. The client name is never included." />
      <div className="smp-connections">
        <span className={status.facebook ? "on" : "off"}><Facebook size={15} />Facebook {status.facebook ? "connected" : "not connected"}</span>
        <span className={status.instagram ? "on" : "off"}><Instagram size={15} />Instagram {status.instagram ? "connected" : "not connected"}</span>
        <span className="on"><Linkedin size={15} />LinkedIn: 1-click</span>
      </div>
      {(!status.facebook || !status.instagram) && <p className="smp-note">To connect Facebook and Instagram, add these values in Vercel (Settings, Environment Variables) and redeploy: <code>FACEBOOK_PAGE_ID</code>, <code>FACEBOOK_PAGE_ACCESS_TOKEN</code>, <code>INSTAGRAM_BUSINESS_ACCOUNT_ID</code>.</p>}
      <StatusMessage status={message} />
      <div className="smp-layout">
        <aside className="card smp-list">
          <input placeholder="Search vacancies" value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="smp-jobs">
            {filtered.map((job) => <button type="button" key={job._id} className={selected?._id === job._id ? "active" : ""} onClick={() => choose(job)}>
              <strong>{job.title}</strong>
              <small>{[job.location, job.salary].filter(Boolean).join(" | ")}</small>
              {(job.posted?.Facebook || job.posted?.Instagram) && <em>Posted {[job.posted.Facebook && `FB ${dateLabel(job.posted.Facebook)}`, job.posted.Instagram && `IG ${dateLabel(job.posted.Instagram)}`].filter(Boolean).join(", ")}</em>}
            </button>)}
            {!filtered.length && <p className="smp-empty">No open vacancies found.</p>}
          </div>
        </aside>
        <section className="card smp-editor">
          {!selected && <p className="smp-empty">Choose a vacancy on the left to prepare its post.</p>}
          {selected && !draft && <p className="smp-empty">Preparing the post...</p>}
          {draft && <>
            <div className="smp-grid">
              <div className="smp-image">{preview.url ? <img src={preview.url} alt="Post image preview" /> : <span>Creating image...</span>}<button type="button" className="button secondary small" onClick={downloadImage}><Download size={14} />Download image</button></div>
              <div className="smp-caption">
                <label><span>Caption (you can edit it)</span><textarea rows={13} value={caption} onChange={(event) => setCaption(event.target.value)} /></label>
                <small>{caption.length}/2200 characters</small>
                <div className="smp-platforms">
                  <label className={!status.facebook ? "disabled" : ""}><input type="checkbox" disabled={!status.facebook} checked={platforms.facebook && status.facebook} onChange={(event) => setPlatforms({ ...platforms, facebook: event.target.checked })} /><Facebook size={15} />Facebook Page</label>
                  <label className={!status.instagram ? "disabled" : ""}><input type="checkbox" disabled={!status.instagram} checked={platforms.instagram && status.instagram} onChange={(event) => setPlatforms({ ...platforms, instagram: event.target.checked })} /><Instagram size={15} />Instagram</label>
                  <label><input type="checkbox" checked={force} onChange={(event) => setForce(event.target.checked)} />Post again even if posted recently</label>
                </div>
                <div className="smp-actions">
                  <button type="button" className="button" disabled={busy || !chosen.length || caption.trim().length < 20 || !draft.publishable} onClick={postNow}><Send size={16} />{busy ? "Posting..." : `Post now${chosen.length ? ` (${chosen.length})` : ""}`}</button>
                  <button type="button" className="button secondary" onClick={shareToLinkedIn}><Linkedin size={16} />Open LinkedIn</button>
                  <button type="button" className="button secondary" onClick={copyCaption}><Copy size={16} />Copy caption</button>
                  <button type="button" className="button secondary" onClick={() => choose(selected)}><RefreshCw size={16} />Reset</button>
                </div>
              </div>
            </div>
            {results.length > 0 && <ul className="smp-results">{results.map((item) => <li key={item.platform} className={item.status.toLowerCase()}><strong>{item.platform}: {item.status}</strong>{item.message && <span>{item.message}</span>}{item.url && <a href={item.url} target="_blank" rel="noreferrer">View post</a>}</li>)}</ul>}
            {draft.history?.length > 0 && <div className="smp-history"><h3>Recent posts for this vacancy</h3>{draft.history.map((item, index) => <p key={index}>{item.platform}: {item.status}{item.error ? ` (${item.error})` : ""} <small>{new Date(item.createdAt).toLocaleString("en-GB")} {item.postedBy?.name ? `by ${item.postedBy.name}` : ""}</small></p>)}</div>}
          </>}
        </section>
      </div>
    </div>
  );
}
