import { useEffect, useMemo, useState } from "react";
import { api, downloadFile } from "../../api/client.js";

const initialForm = {
  candidateName: "",
  candidateEmail: "",
  candidatePhone: "",
  roleTitle: "",
  department: "",
  employmentType: "Full time",
  startDate: "",
  workLocation: "",
  salaryType: "Annual salary",
  salaryAmount: "",
  hoursPerWeek: "",
  reportingTo: "",
  probationPeriod: "6 months",
  offerExpiryDate: "",
  conditions: "",
  benefits: "",
  notes: "",
  senderEmail: "",
  cc: "",
  customMessage: "",
  status: "Draft"
};

const money = (value) => `£${Number(value || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (value) => (value ? new Date(value).toLocaleDateString("en-GB") : "-");

function splitCc(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

export default function AdminOfferLetters() {
  const [form, setForm] = useState(initialForm);
  const [offers, setOffers] = useState([]);
  const [senders, setSenders] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function loadOffers() {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
    const data = await api(`/hr/offer-letters${query ? `?${query}` : ""}`);
    setOffers(data);
    if (!selected && data[0]) setSelected(data[0]);
  }

  useEffect(() => {
    api("/hr/senders").then((data) => {
      setSenders(data);
      if (data[0]) setForm((current) => ({ ...current, senderEmail: current.senderEmail || data[0].address }));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadOffers().catch((err) => setError(err.message));
  }, [filters.search, filters.status]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditingId("");
    setForm({ ...initialForm, senderEmail: senders[0]?.address || "" });
  }

  async function saveOffer(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const payload = { ...form, cc: splitCc(form.cc) };
      const saved = editingId
        ? await api(`/hr/offer-letters/${editingId}`, { method: "PUT", body: payload })
        : await api("/hr/offer-letters", { method: "POST", body: payload });
      setMessage(editingId ? "Offer letter updated." : "Offer letter draft created.");
      setSelected(saved);
      resetForm();
      await loadOffers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function editOffer(offer) {
    setEditingId(offer._id);
    setSelected(offer);
    setForm({
      ...initialForm,
      ...offer,
      startDate: offer.startDate?.slice(0, 10) || "",
      offerExpiryDate: offer.offerExpiryDate?.slice(0, 10) || "",
      cc: (offer.cc || []).join(", ")
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function sendOffer(offer) {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await api(`/hr/offer-letters/${offer._id}/send`, { method: "POST", body: { fromEmail: offer.senderEmail } });
      setMessage(`Offer letter ${response.offer.offerNumber} sent to ${response.offer.candidateEmail}.`);
      setSelected(response.offer);
      await loadOffers();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteOffer(offer) {
    if (!window.confirm(`Delete offer letter ${offer.offerNumber}?`)) return;
    try {
      await api(`/hr/offer-letters/${offer._id}`, { method: "DELETE" });
      setMessage("Offer letter deleted.");
      if (selected?._id === offer._id) setSelected(null);
      await loadOffers();
    } catch (err) {
      setError(err.message);
    }
  }

  const stats = useMemo(() => ({
    total: offers.length,
    sent: offers.filter((offer) => offer.status === "Sent").length,
    accepted: offers.filter((offer) => offer.status === "Accepted").length,
    draft: offers.filter((offer) => offer.status === "Draft").length
  }), [offers]);

  return (
    <section className="hr-page">
      <div className="hr-hero">
        <div>
          <span className="section-kicker">HR documents</span>
          <h2>Offer letter centre</h2>
          <p>Create polished offer letters, attach them as PDFs, email candidates directly, and keep every record inside the CRM.</p>
        </div>
        <div className="hr-hero-panel">
          <strong>{stats.sent}</strong>
          <span>offer letters sent</span>
        </div>
      </div>

      {(message || error) && <div className={error ? "form-error" : "form-success"}>{error || message}</div>}

      <div className="hr-stats">
        <div><span>Total offers</span><strong>{stats.total}</strong></div>
        <div><span>Sent</span><strong>{stats.sent}</strong></div>
        <div><span>Accepted</span><strong>{stats.accepted}</strong></div>
        <div><span>Draft</span><strong>{stats.draft}</strong></div>
      </div>

      <div className="hr-grid">
        <form className="hr-card hr-form-card" onSubmit={saveOffer}>
          <div className="hr-card-heading">
            <span>Candidate document</span>
            <h3>{editingId ? "Edit offer letter" : "Create offer letter"}</h3>
          </div>
          <div className="hr-form-grid">
            <label>Candidate name<input value={form.candidateName} onChange={(e) => update("candidateName", e.target.value)} required /></label>
            <label>Candidate email<input type="email" value={form.candidateEmail} onChange={(e) => update("candidateEmail", e.target.value)} required /></label>
            <label>Candidate phone<input value={form.candidatePhone} onChange={(e) => update("candidatePhone", e.target.value)} /></label>
            <label>Role title<input value={form.roleTitle} onChange={(e) => update("roleTitle", e.target.value)} required /></label>
            <label>Department<input value={form.department} onChange={(e) => update("department", e.target.value)} /></label>
            <label>Employment type<select value={form.employmentType} onChange={(e) => update("employmentType", e.target.value)}><option>Full time</option><option>Part time</option><option>Temporary</option><option>Contract</option><option>Permanent</option></select></label>
            <label>Start date<input type="date" value={form.startDate} onChange={(e) => update("startDate", e.target.value)} /></label>
            <label>Work location<input value={form.workLocation} onChange={(e) => update("workLocation", e.target.value)} /></label>
            <label>Salary type<select value={form.salaryType} onChange={(e) => update("salaryType", e.target.value)}><option>Annual salary</option><option>Hourly rate</option><option>Day rate</option><option>Fixed fee</option></select></label>
            <label>Salary / rate<input type="number" step="0.01" value={form.salaryAmount} onChange={(e) => update("salaryAmount", e.target.value)} /></label>
            <label>Hours per week<input type="number" step="0.01" value={form.hoursPerWeek} onChange={(e) => update("hoursPerWeek", e.target.value)} /></label>
            <label>Reporting to<input value={form.reportingTo} onChange={(e) => update("reportingTo", e.target.value)} /></label>
            <label>Probation period<input value={form.probationPeriod} onChange={(e) => update("probationPeriod", e.target.value)} /></label>
            <label>Offer expiry date<input type="date" value={form.offerExpiryDate} onChange={(e) => update("offerExpiryDate", e.target.value)} /></label>
            <label>Status<select value={form.status} onChange={(e) => update("status", e.target.value)}><option>Draft</option><option>Sent</option><option>Accepted</option><option>Declined</option><option>Withdrawn</option></select></label>
            <label>Send from<select value={form.senderEmail} onChange={(e) => update("senderEmail", e.target.value)}>{senders.map((sender) => <option key={sender.address} value={sender.address}>{sender.label} ({sender.address})</option>)}</select></label>
            <label className="full">Conditions<textarea value={form.conditions} onChange={(e) => update("conditions", e.target.value)} placeholder="Subject to right-to-work checks, references, DBS checks, etc." /></label>
            <label className="full">Benefits<textarea value={form.benefits} onChange={(e) => update("benefits", e.target.value)} placeholder="Annual leave, pension, training, progression, etc." /></label>
            <label className="full">CC emails<input value={form.cc} onChange={(e) => update("cc", e.target.value)} placeholder="optional, comma separated" /></label>
            <label className="full">Optional message<textarea value={form.customMessage} onChange={(e) => update("customMessage", e.target.value)} placeholder="Leave blank to use the standard offer-letter email." /></label>
            <label className="full">Internal notes<textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} /></label>
          </div>
          <div className="hr-totals">
            <span>Package <strong>{money(form.salaryAmount)}</strong></span>
            <span>Hours <strong>{form.hoursPerWeek || "-"}</strong></span>
            <span className="net">Expiry <strong>{dateLabel(form.offerExpiryDate)}</strong></span>
          </div>
          <div className="hr-actions">
            {editingId && <button type="button" className="secondary" onClick={resetForm}>Cancel edit</button>}
            <button type="submit" disabled={loading}>{loading ? "Saving..." : editingId ? "Update offer" : "Create offer letter"}</button>
          </div>
        </form>

        <aside className="hr-card hr-preview-card">
          <span className="section-kicker">Selected record</span>
          {selected ? (
            <>
              <h3>{selected.candidateName}</h3>
              <p>{selected.roleTitle || "Candidate"} · {selected.offerNumber}</p>
              <div className="hr-detail-list">
                <span>Email <strong>{selected.candidateEmail}</strong></span>
                <span>Start date <strong>{dateLabel(selected.startDate)}</strong></span>
                <span>Status <strong>{selected.status}</strong></span>
                <span>Package <strong>{money(selected.salaryAmount)}</strong></span>
              </div>
              <div className="hr-preview-actions">
                <button type="button" className="secondary" onClick={() => downloadFile(`/hr/offer-letters/${selected._id}/pdf`, `Innovex-Offer-Letter-${selected.offerNumber}.pdf`)}>Download PDF</button>
                <button type="button" onClick={() => sendOffer(selected)} disabled={loading}>Send email</button>
              </div>
            </>
          ) : (
            <p>Select or create an offer letter to preview actions.</p>
          )}
        </aside>
      </div>

      <div className="hr-card hr-table-card">
        <div className="hr-table-tools">
          <div>
            <span className="section-kicker">Offer register</span>
            <h3>Offer letters</h3>
          </div>
          <input value={filters.search} onChange={(e) => setFilters((current) => ({ ...current, search: e.target.value }))} placeholder="Search candidate, email, role..." />
          <select value={filters.status} onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value }))}>
            <option value="">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Accepted">Accepted</option>
            <option value="Declined">Declined</option>
            <option value="Withdrawn">Withdrawn</option>
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Offer</th><th>Candidate</th><th>Role</th><th>Start</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {offers.map((offer) => (
                <tr key={offer._id}>
                  <td><strong>{offer.offerNumber}</strong><br /><span>{dateLabel(offer.createdAt)}</span></td>
                  <td><strong>{offer.candidateName}</strong><br /><span>{offer.candidateEmail}</span></td>
                  <td><strong>{offer.roleTitle}</strong><br /><span>{offer.employmentType}</span></td>
                  <td>{dateLabel(offer.startDate)}</td>
                  <td><span className={`hr-status ${offer.status.toLowerCase()}`}>{offer.status}</span></td>
                  <td className="action-row">
                    <button type="button" className="secondary" onClick={() => setSelected(offer)}>View</button>
                    <button type="button" className="secondary" onClick={() => editOffer(offer)}>Edit</button>
                    <button type="button" onClick={() => sendOffer(offer)}>Send</button>
                    <button type="button" className="danger" onClick={() => deleteOffer(offer)}>Delete</button>
                  </td>
                </tr>
              ))}
              {!offers.length && <tr><td colSpan="6">No offer letters found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
