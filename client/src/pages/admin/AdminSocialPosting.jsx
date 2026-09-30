import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, Facebook, Instagram, Linkedin, Megaphone, MapPin, PoundSterling, RefreshCw, Search, Send } from "lucide-react";
import { api } from "../../api/client.js";
import AdminSectionHero from "../../components/AdminSectionHero.jsx";
import StatusMessage from "../../components/StatusMessage.jsx";
import { renderJobCard } from "../../utils/socialCard.js";

const dateLabel = (value) => (value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "");

// The site's Content-Security-Policy allows data: images but not blob: images, so the preview is a data URL.
function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The image preview could not be created."));
    reader.readAsDataURL(blob);
  });
}

function ConnectionCard({ icon: Icon, name, on, text, tone }) {
  return (
    <div className={`smp-conn ${on ? "on" : "off"} ${tone || ""}`}>
      <span className="smp-conn-icon"><Icon size={18} /></span>
      <div><strong>{name}</strong><small>{text}</small></div>
      <i className="smp-conn-dot" aria-hidden="true" />
    </div>
  );
}

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

  async function loadJobs() {
    try {
      const [state, list] = await Promise.all([api("/social/status"), api("/social/jobs")]);
      setStatus(state);
      setJobs(list);
    } catch (error) {
      setMessage({ type: "error", message: error.message || "Could not load vacancies." });
    }
  }
  useEffect(() => { loadJobs(); }, []);

  async function choose(job) {
    setSelected(job); setDraft(null); setResults([]); setMessage(null); setForce(false); setPreview({ url: "", blob: null });
    try {
      const data = await api(`/social/jobs/${job._id}/draft`);
      setDraft(data);
      setCaption(data.caption);
      const blob = await renderJobCard(data.job);
      setPreview({ url: await blobToDataUrl(blob), blob });
    } catch (error) {
      setMessage({ type: "error", message: error.message || "Could not prepare the post." });
    }
  }

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return jobs.filter((job) => !term || `${job.title} ${job.location} ${job.reference || ""}`.toLowerCase().includes(term));
  }, [jobs, search]);

  const chosen = ["facebook", "instagram"].filter((key) => platforms[key] && status[key]);
  const anyConnected = status.facebook || status.instagram;
  const canPost = !busy && chosen.length > 0 && preview.blob && caption.trim().length >= 20 && draft?.publishable;

  async function postNow() {
    if (!canPost) return;
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
    setMessage({ type: "info", message: "LinkedIn opened with the caption filled in. Attach the downloaded image, choose the Innovex Company Page as the poster, then press Post." });
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
      <AdminSectionHero icon={Megaphone} eyebrow="Recruitment" title="Social posting" description="Pick a vacancy, check the image and caption, then post. The client name is never included." />

      <div className="smp-connections">
        <ConnectionCard icon={Facebook} name="Facebook Page" on={status.facebook} text={status.facebook ? "Connected: posts automatically" : "Not connected yet"} tone="fb" />
        <ConnectionCard icon={Instagram} name="Instagram" on={status.instagram} text={status.instagram ? "Connected: posts automatically" : "Not connected yet"} tone="ig" />
        <ConnectionCard icon={Linkedin} name="LinkedIn" on text="1-click: opens with the post ready" tone="li" />
      </div>
      {!anyConnected && <details className="smp-setup"><summary>How to connect Facebook and Instagram</summary>
        <p>Add these three values in Vercel (Project, Settings, Environment Variables), then redeploy: <code>FACEBOOK_PAGE_ID</code>, <code>FACEBOOK_PAGE_ACCESS_TOKEN</code>, <code>INSTAGRAM_BUSINESS_ACCOUNT_ID</code>. Until then you can still prepare the post, download the image and use LinkedIn.</p>
      </details>}

      <StatusMessage status={message} />

      <div className="smp-layout">
        <aside className="card smp-list">
          <label className="smp-search"><Search size={16} /><input placeholder="Search vacancies" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
          <p className="smp-count">{filtered.length} open {filtered.length === 1 ? "vacancy" : "vacancies"}</p>
          <div className="smp-jobs">
            {filtered.map((job) => <button type="button" key={job._id} className={selected?._id === job._id ? "active" : ""} onClick={() => choose(job)}>
              <strong>{job.title}</strong>
              <span className="smp-meta">{job.location && <span><MapPin size={12} />{job.location}</span>}{job.salary && <span><PoundSterling size={12} />{job.salary}</span>}</span>
              {(job.posted?.Facebook || job.posted?.Instagram) && <em><Check size={12} />Posted {[job.posted.Facebook && `FB ${dateLabel(job.posted.Facebook)}`, job.posted.Instagram && `IG ${dateLabel(job.posted.Instagram)}`].filter(Boolean).join(", ")}</em>}
            </button>)}
            {!filtered.length && <p className="smp-empty">No open vacancies found.</p>}
          </div>
        </aside>

        <section className="card smp-editor">
          {!selected && <div className="smp-placeholder"><Megaphone size={34} /><h3>Choose a vacancy</h3><p>Pick one from the list to see the post image and caption.</p></div>}
          {selected && !draft && <div className="smp-placeholder"><RefreshCw size={30} className="smp-spin" /><p>Preparing the post...</p></div>}
          {draft && <>
            <header className="smp-head">
              <div><h2>{selected.title}</h2><p>{[selected.location, selected.salary].filter(Boolean).join("  |  ")}</p></div>
              <button type="button" className="smp-link" onClick={() => choose(selected)}><RefreshCw size={14} />Reset</button>
            </header>
            <div className="smp-grid">
              <div className="smp-image">
                <div className="smp-frame">{preview.url ? <img src={preview.url} alt="Post image preview" /> : <span className="smp-skeleton">Creating image...</span>}</div>
                <button type="button" className="button secondary small" disabled={!preview.url} onClick={downloadImage}><Download size={14} />Download image</button>
              </div>
              <div className="smp-caption">
                <label>
                  <span>Caption <small>You can edit it</small></span>
                  <textarea rows={12} value={caption} onChange={(event) => setCaption(event.target.value)} />
                </label>
                <small className="smp-counter">{caption.length} / 2200</small>

                <div className="smp-platforms">
                  <label className={`smp-toggle ${!status.facebook ? "disabled" : ""}`}><input type="checkbox" disabled={!status.facebook} checked={platforms.facebook && status.facebook} onChange={(event) => setPlatforms({ ...platforms, facebook: event.target.checked })} /><Facebook size={16} />Facebook</label>
                  <label className={`smp-toggle ${!status.instagram ? "disabled" : ""}`}><input type="checkbox" disabled={!status.instagram} checked={platforms.instagram && status.instagram} onChange={(event) => setPlatforms({ ...platforms, instagram: event.target.checked })} /><Instagram size={16} />Instagram</label>
                </div>
                <label className="smp-force"><input type="checkbox" checked={force} onChange={(event) => setForce(event.target.checked)} />Post again even if this vacancy was posted recently</label>

                <div className="smp-actions">
                  <button type="button" className="button smp-post" disabled={!canPost} onClick={postNow}><Send size={16} />{busy ? "Posting..." : `Post now${chosen.length ? ` to ${chosen.length === 2 ? "Facebook + Instagram" : chosen[0] === "facebook" ? "Facebook" : "Instagram"}` : ""}`}</button>
                  {!anyConnected && <small className="smp-hint">Connect Facebook or Instagram to enable automatic posting.</small>}
                  <div className="smp-secondary">
                    <button type="button" className="smp-linkedin" onClick={shareToLinkedIn}><Linkedin size={16} />Share on LinkedIn</button>
                    <button type="button" className="button secondary" onClick={copyCaption}><Copy size={16} />Copy caption</button>
                  </div>
                </div>
              </div>
            </div>
            {results.length > 0 && <ul className="smp-results">{results.map((item) => <li key={item.platform} className={item.status.toLowerCase()}><strong>{item.platform}: {item.status}</strong>{item.message && <span>{item.message}</span>}{item.url && <a href={item.url} target="_blank" rel="noreferrer">View post</a>}</li>)}</ul>}
            {draft.history?.length > 0 && <div className="smp-history"><h3>Recent posts for this vacancy</h3>{draft.history.map((item, index) => <p key={index}><strong>{item.platform}</strong>: {item.status}{item.error ? ` (${item.error})` : ""} <small>{new Date(item.createdAt).toLocaleString("en-GB")} {item.postedBy?.name ? `by ${item.postedBy.name}` : ""}</small></p>)}</div>}
          </>}
        </section>
      </div>
    </div>
  );
}
