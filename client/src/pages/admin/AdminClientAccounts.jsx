import { useEffect, useMemo, useState } from "react";
import { Activity, BadgePoundSterling, Building2, CalendarClock, ChevronLeft, ChevronRight, CircleAlert, Mail, MapPin, Merge, Phone, Plus, Search, UsersRound, X } from "lucide-react";
import { api } from "../../api/client.js";
import { hasPermission } from "../../auth/permissions.js";
import AdminSectionHero from "../../components/AdminSectionHero.jsx";
import StatusMessage from "../../components/StatusMessage.jsx";
import SubmitButton from "../../components/SubmitButton.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

const emptyForm = { name: "", tradingName: "", accountType: "Prospect", status: "New", industry: "", companyNumber: "", website: "", email: "", phone: "", city: "", postcode: "", contactName: "", contactEmail: "", notes: "" };
const money = (value) => new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", maximumFractionDigits: 0 }).format(Number(value || 0));
const date = (value) => value ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value)) : "—";

export default function AdminClientAccounts() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "clients.manage");
  const [summary, setSummary] = useState({ total: 0, active: 0, prospects: 0, atRisk: 0, duplicateCount: 0 });
  const [data, setData] = useState({ items: [], total: 0, page: 1, pages: 1 });
  const [filters, setFilters] = useState({ search: "", status: "", accountType: "" });
  const [selectedId, setSelectedId] = useState("");
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [status, setStatus] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState("");

  async function load(page = 1) {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      Object.entries(filters).forEach(([key, value]) => value && params.set(key, value));
      const [list, totals] = await Promise.all([api(`/client-accounts?${params}`), api("/client-accounts/summary")]);
      setData(list); setSummary(totals);
      if (!selectedId && list.items[0]) setSelectedId(list.items[0]._id);
    } catch (error) { setStatus({ type: "error", message: error.message }); }
    finally { setLoading(false); }
  }

  async function loadDetail(id) {
    if (!id) return setDetail(null);
    setDetailLoading(true);
    try { setDetail(await api(`/client-accounts/${id}`)); }
    catch (error) { setStatus({ type: "error", message: error.message }); }
    finally { setDetailLoading(false); }
  }

  useEffect(() => { load(1); }, [filters.status, filters.accountType]);
  useEffect(() => { loadDetail(selectedId); }, [selectedId]);

  function openCreate() { setEditingId(""); setForm(emptyForm); setFormOpen(true); }
  function openEdit() {
    const account = detail?.account;
    if (!account) return;
    const primary = account.contacts?.find((contact) => contact.primary) || account.contacts?.[0] || {};
    setEditingId(account._id);
    setForm({ ...emptyForm, ...account, city: account.address?.city || "", postcode: account.address?.postcode || "", contactName: primary.name || "", contactEmail: primary.email || "" });
    setFormOpen(true);
  }

  async function save(event) {
    event.preventDefault();
    const payload = { ...form, address: { city: form.city, postcode: form.postcode }, contacts: form.contactName ? [{ name: form.contactName, email: form.contactEmail, primary: true, decisionMaker: true }] : [] };
    try {
      const result = await api(editingId ? `/client-accounts/${editingId}` : "/client-accounts", { method: editingId ? "PUT" : "POST", body: payload });
      setFormOpen(false); setSelectedId(result.account._id); setStatus({ type: "success", message: editingId ? "Organisation updated" : "Organisation added to CRM" });
      await load(data.page); await loadDetail(result.account._id);
    } catch (error) { setStatus({ type: "error", message: error.message }); }
  }

  async function archiveAccount() {
    if (!detail?.account || !window.confirm(`Archive ${detail.account.name}? Linked records will be retained.`)) return;
    try { await api(`/client-accounts/${detail.account._id}`, { method: "DELETE", body: { reason: "Archived from Organisation 360" } }); setSelectedId(""); setDetail(null); await load(1); }
    catch (error) { setStatus({ type: "error", message: error.message }); }
  }

  const timelineGroups = useMemo(() => detail?.timeline || [], [detail]);

  return <div className="client360-page">
    <AdminSectionHero eyebrow="Connected client intelligence" title="Organisation 360" description="One accountable record for companies, contacts, vacancies, conversations, documents, training and revenue." aside={<div className="workspace-hero-count"><Building2 size={18} /><span><small>ACTIVE ACCOUNTS</small><strong>{summary.active}</strong></span></div>} />
    <StatusMessage status={status} />
    <section className="client360-stats">
      <article><Building2 /><span><small>All organisations</small><strong>{summary.total}</strong></span></article>
      <article><UsersRound /><span><small>Open prospects</small><strong>{summary.prospects}</strong></span></article>
      <article><CircleAlert /><span><small>At risk</small><strong>{summary.atRisk}</strong></span></article>
      <article><Merge /><span><small>Possible duplicates</small><strong>{summary.duplicateCount}</strong></span></article>
    </section>
    <section className="client360-toolbar">
      <form onSubmit={(event) => { event.preventDefault(); load(1); }}><Search size={17} /><input value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} placeholder="Search company, contact, email or number" /><button>Search</button></form>
      <select value={filters.accountType} onChange={(event) => setFilters({ ...filters, accountType: event.target.value })}><option value="">All account types</option>{["Prospect", "Client", "Partner", "Supplier", "Former Client"].map((value) => <option key={value}>{value}</option>)}</select>
      <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}><option value="">All statuses</option>{["New", "Qualified", "Active", "At Risk", "Dormant", "Closed"].map((value) => <option key={value}>{value}</option>)}</select>
      {canManage && <button className="primary-button" type="button" onClick={openCreate}><Plus size={17} /> New organisation</button>}
    </section>
    <section className="client360-workspace">
      <aside className="client360-list">
        <header><strong>{data.total} organisations</strong><span>Last activity</span></header>
        {loading ? Array.from({ length: 6 }, (_, index) => <div className="client360-row skeleton" key={index} />) : data.items.map((account) => <button key={account._id} className={`client360-row${selectedId === account._id ? " selected" : ""}`} onClick={() => setSelectedId(account._id)}>
          <span className="client360-avatar">{account.name.slice(0, 2).toUpperCase()}</span><span className="client360-row-copy"><strong>{account.name}</strong><small>{account.industry || account.accountType} · {account.address?.city || account.websiteDomain || "Profile ready"}</small><span>{account.contacts?.[0]?.name || account.email || "No primary contact"}</span></span><span className={`client360-status ${account.status.toLowerCase().replaceAll(" ", "-")}`}>{account.status}</span>
        </button>)}
        {!loading && !data.items.length && <div className="client360-empty"><Building2 /><strong>No organisations found</strong><span>Adjust the filters or add the first master account.</span></div>}
        <footer><button disabled={data.page <= 1} onClick={() => load(data.page - 1)}><ChevronLeft /></button><span>Page {data.page} of {data.pages}</span><button disabled={data.page >= data.pages} onClick={() => load(data.page + 1)}><ChevronRight /></button></footer>
      </aside>
      <main className="client360-detail">
        {detailLoading ? <div className="client360-detail-loading">Loading connected record…</div> : detail ? <>
          <header className="client360-profile-head"><div><span className="client360-profile-logo">{detail.account.name.slice(0, 2).toUpperCase()}</span><span><small>{detail.account.accountType} · {detail.account.status}</small><h2>{detail.account.name}</h2><p>{detail.account.industry || "Business account"}</p></span></div>{canManage && <div><button onClick={openEdit}>Edit profile</button><button className="danger-subtle" onClick={archiveAccount}>Archive</button></div>}</header>
          <div className="client360-contact-strip">{detail.account.email && <a href={`mailto:${detail.account.email}`}><Mail />{detail.account.email}</a>}{detail.account.phone && <a href={`tel:${detail.account.phone}`}><Phone />{detail.account.phone}</a>}{(detail.account.address?.city || detail.account.address?.postcode) && <span><MapPin />{[detail.account.address.city, detail.account.address.postcode].filter(Boolean).join(", ")}</span>}</div>
          <section className="client360-metrics"><article><Activity /><span><small>Leads</small><strong>{detail.metrics.leads}</strong></span></article><article><CalendarClock /><span><small>Vacancies</small><strong>{detail.metrics.vacancies}</strong></span></article><article><BadgePoundSterling /><span><small>Recorded revenue</small><strong>{money(detail.metrics.revenue)}</strong></span></article><article><CircleAlert /><span><small>Outstanding</small><strong>{money(detail.metrics.outstanding)}</strong></span></article></section>
          <div className="client360-body-grid"><section className="client360-contacts"><header><div><small>RELATIONSHIPS</small><h3>Contacts</h3></div><span>{detail.account.contacts?.length || 0}</span></header>{detail.account.contacts?.length ? detail.account.contacts.map((contact) => <article key={contact._id}><span>{contact.name.slice(0, 2).toUpperCase()}</span><div><strong>{contact.name}</strong><small>{contact.jobTitle || (contact.decisionMaker ? "Decision maker" : "Contact")}</small><p>{contact.email || contact.phone}</p></div>{contact.primary && <em>Primary</em>}</article>) : <p className="client360-muted">Add the people your team works with.</p>}</section>
          <section className="client360-timeline"><header><div><small>CONNECTED HISTORY</small><h3>Activity timeline</h3></div><span>{timelineGroups.length}</span></header>{timelineGroups.length ? timelineGroups.map((item, index) => <article key={`${item.type}-${item.id}-${index}`}><span className={`timeline-dot ${item.type}`} /><div><small>{item.type} · {date(item.at)}</small><strong>{item.title}</strong><p>{item.detail}</p></div></article>) : <p className="client360-muted">Linked activity will appear here.</p>}</section></div>
        </> : <div className="client360-empty-detail"><Building2 /><h2>Select an organisation</h2><p>Review its contacts, commercial position and complete CRM history.</p></div>}
      </main>
    </section>
    {formOpen && <div className="client360-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setFormOpen(false)}><section className="client360-modal" role="dialog" aria-modal="true"><header><div><small>MASTER ACCOUNT</small><h2>{editingId ? "Edit organisation" : "New organisation"}</h2></div><button onClick={() => setFormOpen(false)}><X /></button></header><form onSubmit={save}>
      <div className="client360-form-grid"><label><span>Organisation name *</span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label><span>Industry</span><input value={form.industry} onChange={(event) => setForm({ ...form, industry: event.target.value })} /></label><label><span>Account type</span><select value={form.accountType} onChange={(event) => setForm({ ...form, accountType: event.target.value })}>{["Prospect", "Client", "Partner", "Supplier", "Former Client"].map((value) => <option key={value}>{value}</option>)}</select></label><label><span>Status</span><select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{["New", "Qualified", "Active", "At Risk", "Dormant", "Closed"].map((value) => <option key={value}>{value}</option>)}</select></label><label><span>Company number</span><input value={form.companyNumber} onChange={(event) => setForm({ ...form, companyNumber: event.target.value })} /></label><label><span>Website</span><input value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} /></label><label><span>Company email</span><input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label><span>Company phone</span><input value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label><label><span>City</span><input value={form.city} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label><label><span>Postcode</span><input value={form.postcode} onChange={(event) => setForm({ ...form, postcode: event.target.value })} /></label><label><span>Primary contact</span><input value={form.contactName} onChange={(event) => setForm({ ...form, contactName: event.target.value })} /></label><label><span>Contact email</span><input type="email" value={form.contactEmail} onChange={(event) => setForm({ ...form, contactEmail: event.target.value })} /></label><label className="wide"><span>Internal notes</span><textarea value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} rows="4" /></label></div><footer><button type="button" onClick={() => setFormOpen(false)}>Cancel</button><SubmitButton>{editingId ? "Save organisation" : "Create organisation"}</SubmitButton></footer>
    </form></section></div>}
  </div>;
}
