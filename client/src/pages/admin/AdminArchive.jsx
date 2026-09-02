import { useEffect, useState } from "react";
import { ArchiveRestore, DatabaseBackup, FileClock, Gavel, RefreshCw, Search, ShieldAlert } from "lucide-react";
import { api } from "../../api/client.js";
import AdminSectionHero from "../../components/AdminSectionHero.jsx";
import StatusMessage from "../../components/StatusMessage.jsx";

const labels = { applications: "Applications", blogs: "Blogs", businessLeads: "Business leads", calls: "Calls", candidates: "Candidates", clients: "Organisations", terms: "Client terms", courses: "Courses", cvs: "CV uploads", interviews: "Interviews", invoices: "Invoices", jobs: "Vacancies", meetings: "Meetings", offerLetters: "Offer letters", partners: "Partners", salarySlips: "Salary slips", testimonials: "Testimonials", trainingBookings: "Training bookings", trainingQuotations: "Training quotations", users: "Team members", webLeads: "Web leads" };

export default function AdminArchive() {
  const [data, setData] = useState({ items: [], total: 0 });
  const [type, setType] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try { setData(await api(`/archive${type ? `?type=${encodeURIComponent(type)}` : ""}`)); }
    catch (error) { setStatus({ type: "error", message: error.message }); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [type]);

  async function restore(item) {
    try { await api(`/archive/${item.type}/${item.id}/restore`, { method: "POST" }); setStatus({ type: "success", message: `${item.label} restored` }); await load(); }
    catch (error) { setStatus({ type: "error", message: error.message }); }
  }

  async function toggleHold(item) {
    const reason = !item.legalHold ? window.prompt("Reason for legal hold:", "Retention required for legal or compliance review") : "";
    if (!item.legalHold && !reason) return;
    try { await api(`/archive/${item.type}/${item.id}/legal-hold`, { method: "PATCH", body: { enabled: !item.legalHold, reason } }); await load(); }
    catch (error) { setStatus({ type: "error", message: error.message }); }
  }

  const visible = data.items.filter((item) => `${item.label} ${item.archiveReason}`.toLowerCase().includes(search.toLowerCase()));
  return <div className="archive-page">
    <AdminSectionHero eyebrow="Data lifecycle control" title="Archive & Retention" description="Restore archived records, enforce retention periods and protect evidence with auditable legal holds." aside={<div className="workspace-hero-count"><DatabaseBackup size={18} /><span><small>RETAINED RECORDS</small><strong>{data.total}</strong></span></div>} />
    <StatusMessage status={status} />
    <section className="archive-policy-strip"><article><FileClock /><div><strong>Recoverable by default</strong><span>Archived data stays available until its retention date.</span></div></article><article><Gavel /><div><strong>Legal-hold protection</strong><span>Held records cannot be permanently purged.</span></div></article><article><ShieldAlert /><div><strong>No cascade deletion</strong><span>Linked applications and activity remain intact.</span></div></article></section>
    <section className="archive-toolbar"><label><Search /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search retained records" /></label><select value={type} onChange={(e) => setType(e.target.value)}><option value="">All record types</option>{Object.entries(labels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><button onClick={load}><RefreshCw /> Refresh</button></section>
    <section className="archive-table"><header><span>Record</span><span>Archived</span><span>Retention</span><span>Protection</span><span>Actions</span></header>{loading ? <div className="archive-empty">Loading retained records…</div> : visible.map((item) => <article key={`${item.type}-${item.id}`}><div><span className="archive-record-icon"><DatabaseBackup /></span><span><strong>{item.label}</strong><small>{labels[item.type] || item.type} · {item.archiveReason || "Archived"}</small></span></div><time>{new Date(item.archivedAt).toLocaleDateString("en-GB")}</time><time>{item.retentionUntil ? new Date(item.retentionUntil).toLocaleDateString("en-GB") : "Not set"}</time><button className={`legal-hold-button${item.legalHold ? " active" : ""}`} onClick={() => toggleHold(item)}><Gavel />{item.legalHold ? "Legal hold" : "Add hold"}</button><button className="restore-button" onClick={() => restore(item)}><ArchiveRestore /> Restore</button></article>)}{!loading && !visible.length && <div className="archive-empty"><DatabaseBackup /><strong>No archived records</strong><span>Archived records matching this view will appear here.</span></div>}</section>
  </div>;
}
