import { useEffect, useState } from "react";
import { Download, Eye, FileCheck2, ScanSearch, Search, UsersRound } from "lucide-react";
import { api, downloadFile } from "../../api/client.js";
import AdminSectionHero from "../../components/AdminSectionHero.jsx";
import CvReviewModal from "../../components/CvReviewModal.jsx";
import StatusMessage from "../../components/StatusMessage.jsx";

const isReleased = (item) => ["Clean", "Validated"].includes(item.cv?.scanStatus);

export default function AdminApplications() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [reviewing, setReviewing] = useState(null);
  const [notice, setNotice] = useState(null);
  const load = () => {
    const query = new URLSearchParams(Object.entries({ status, search }).filter(([, value]) => value)).toString();
    api(`/applications${query ? `?${query}` : ""}`).then(setItems).catch(() => {});
  };
  useEffect(() => {
    load();
  }, [status]);
  async function scan(item) {
    try {
      const result = await api(`/applications/${item._id}/security-scan`, { method: "POST" });
      setNotice({ message: result.message });
      load();
    } catch (error) { setNotice({ type: "error", message: error.message }); load(); }
  }
  return (
    <div className="workspace-module-page applications-admin-page">
      <AdminSectionHero icon={FileCheck2} eyebrow="Recruitment operations" title="Applications" description="Review incoming candidates, update progress and keep every application moving." aside={<div className="workspace-hero-count"><UsersRound size={18} /><span><small>APPLICATIONS</small><strong>{items.length}</strong></span></div>} />
      <StatusMessage status={notice} />
      <section className="workspace-filter-bar"><div><Search size={17} /><input placeholder="Search candidate, email or phone..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} /></div><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option>New</option><option>Reviewed</option><option>Shortlisted</option><option>Rejected</option></select><button type="button" className="button" onClick={load}>Search</button></section>
      <div className="table-wrap workspace-data-table"><table><thead><tr><th>Candidate</th><th>Job</th><th>Status</th><th>CV</th></tr></thead><tbody>
        {items.map((item) => <tr key={item._id}><td>{item.name}<br /><span className="muted">{item.email} · {item.phone}</span></td><td>{item.job?.title}</td><td><select value={item.status} onChange={(e) => api(`/applications/${item._id}/status`, { method: "PUT", body: { status: e.target.value } }).then(load)}><option>New</option><option>Reviewed</option><option>Shortlisted</option><option>Rejected</option></select></td><td>{item.cv?.filename ? <div className="compact-actions">{isReleased(item) ? <><button className="button small" onClick={() => setReviewing(item)}><Eye size={14} /> Review</button><button className="button secondary small" onClick={() => downloadFile(`/applications/${item._id}/download`, item.cv.originalName)}><Download size={14} /> Download</button></> : <><span className="security-state quarantined">{item.cv?.scanStatus || "Quarantined"}</span><button className="button secondary small" onClick={() => scan(item)}><ScanSearch size={14} /> Scan again</button></>}</div> : "No CV"}</td></tr>)}
      </tbody></table>{!items.length && <div className="workspace-empty-state"><FileCheck2 size={30} /><strong>No applications found</strong><span>New job applications will appear here.</span></div>}</div>
      {reviewing && <CvReviewModal candidateName={reviewing.name} reference={reviewing.job?.title} filename={reviewing.cv?.originalName} reviewPath={`/applications/${reviewing._id}/cv-review`} downloadPath={`/applications/${reviewing._id}/download`} onClose={() => setReviewing(null)} />}
    </div>
  );
}
