import { useEffect, useState } from "react";
import { Download, Eye, FileArchive, ScanSearch, Search, UsersRound } from "lucide-react";
import { api, downloadFile } from "../../api/client.js";
import AdminSectionHero from "../../components/AdminSectionHero.jsx";
import CvReviewModal from "../../components/CvReviewModal.jsx";
import StatusMessage from "../../components/StatusMessage.jsx";

const isReleased = (item) => ["Clean", "Validated"].includes(item.cv?.scanStatus);

export default function AdminCvs() {
  const [items, setItems] = useState([]);
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [reviewing, setReviewing] = useState(null);
  const [notice, setNotice] = useState(null);
  const load = () => {
    const query = new URLSearchParams(Object.entries({ role, search }).filter(([, value]) => value)).toString();
    api(`/cv-uploads${query ? `?${query}` : ""}`).then(setItems).catch(() => {});
  };
  useEffect(() => {
    load();
  }, [role]);
  async function scan(item) {
    try {
      const result = await api(`/cv-uploads/${item._id}/security-scan`, { method: "POST" });
      setNotice({ message: result.message });
      load();
    } catch (error) { setNotice({ type: "error", message: error.message }); load(); }
  }
  return (
    <div className="workspace-module-page cv-uploads-admin-page">
      <AdminSectionHero icon={FileArchive} eyebrow="Candidate intake" title="CV Uploads" description="Review direct CV submissions and organise candidates by role, location and contact stage." aside={<div className="workspace-hero-count"><UsersRound size={18} /><span><small>PROFILES</small><strong>{items.length}</strong></span></div>} />
      <StatusMessage status={notice} />
      <section className="workspace-filter-bar"><div><Search size={17} /><input placeholder="Search candidate or contact details..." value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} /></div><input placeholder="Filter by desired role" value={role} onChange={(e) => setRole(e.target.value)} /><button type="button" className="button" onClick={load}>Apply</button></section>
      <div className="table-wrap workspace-data-table"><table><thead><tr><th>Candidate</th><th>Role</th><th>Location</th><th>Status</th><th>CV</th></tr></thead><tbody>
        {items.map((item) => <tr key={item._id}><td>{item.name}<br /><span className="muted">{item.email} · {item.phone}</span></td><td>{item.desiredRole}</td><td>{item.location}</td><td><select value={item.status} onChange={(e) => api(`/cv-uploads/${item._id}/status`, { method: "PUT", body: { status: e.target.value } }).then(load)}><option>New</option><option>Contacted</option><option>Shortlisted</option></select></td><td><div className="compact-actions">{isReleased(item) ? <><button className="button small" onClick={() => setReviewing(item)}><Eye size={14} /> Review</button><button className="button secondary small" onClick={() => downloadFile(`/cv-uploads/${item._id}/download`, item.cv?.originalName)}><Download size={14} /> Download</button></> : <><span className="security-state quarantined">{item.cv?.scanStatus || "Quarantined"}</span><button className="button secondary small" onClick={() => scan(item)}><ScanSearch size={14} /> Scan again</button></>}</div></td></tr>)}
      </tbody></table>{!items.length && <div className="workspace-empty-state"><FileArchive size={30} /><strong>No CV uploads found</strong><span>Direct candidate submissions will appear here.</span></div>}</div>
      {reviewing && <CvReviewModal candidateName={reviewing.name} reference={reviewing.desiredRole} filename={reviewing.cv?.originalName} reviewPath={`/cv-uploads/${reviewing._id}/cv-review`} downloadPath={`/cv-uploads/${reviewing._id}/download`} onClose={() => setReviewing(null)} />}
    </div>
  );
}
