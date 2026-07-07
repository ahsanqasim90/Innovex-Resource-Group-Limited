import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, FileSignature, Mail, Plus, RefreshCw, Send, ShieldCheck, Trash2, XCircle } from "lucide-react";
import { api, downloadFile } from "../../api/client.js";
import StatusMessage from "../../components/StatusMessage.jsx";
import SubmitButton from "../../components/SubmitButton.jsx";

const blankRate = {
  roleTitle: "",
  feeType: "Percentage",
  rateValue: "",
  rateUnit: "% of annual salary",
  paymentTrigger: "Payable on candidate start date",
  notes: ""
};

const defaultClauses = [
  {
    heading: "Scope of services",
    body: "Innovex Resource Group Limited will introduce suitable candidates and/or provide recruitment support to the client in line with the commercial schedule agreed in this document.",
    order: 1
  },
  {
    heading: "Candidate introductions",
    body: "An introduction is considered active where Innovex provides a candidate profile, CV, contact details, interview arrangement, or any other candidate information to the client.",
    order: 2
  },
  {
    heading: "Fees and payment",
    body: "Fees are payable in accordance with the role rates, payment cycle, invoice due date, and payment trigger stated in the commercial schedule.",
    order: 3
  },
  {
    heading: "Rebate and replacement terms",
    body: "Any rebate or replacement support only applies where the client has paid the relevant invoice within the agreed payment terms and has notified Innovex in writing within the agreed rebate period.",
    order: 4
  },
  {
    heading: "Confidentiality",
    body: "Candidate information, rates, commercial terms, and recruitment documentation shared by Innovex are confidential and must not be disclosed to third parties without written permission.",
    order: 5
  },
  {
    heading: "Acceptance",
    body: "By signing or confirming acceptance of these terms, the client agrees that the commercial schedule and terms of business apply to introductions and services provided by Innovex Resource Group Limited.",
    order: 6
  }
];

const initialForm = {
  title: "Terms of Business",
  agreementType: "Recruitment",
  clientName: "",
  contactName: "",
  clientEmail: "",
  clientAddress: "",
  clientCompanyNumber: "",
  effectiveDate: new Date().toISOString().slice(0, 10),
  validUntil: "",
  paymentDueDays: 14,
  invoiceCycle: "Invoice issued on candidate start date or as agreed.",
  rebatePeriodDays: 28,
  rebateTerms: "Rebate or replacement support is subject to the invoice being paid within agreed terms and written notice being received within the rebate period.",
  roleRates: [{ ...blankRate }],
  clauses: defaultClauses,
  specialTerms: "",
  internalNotes: "",
  senderEmail: "info@innovexresourcegroup.co.uk",
  cc: ""
};

function dateValue(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : "";
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-GB") : "-";
}

function statusClass(status) {
  return String(status || "Draft").toLowerCase();
}

function formFromTerms(terms) {
  return {
    ...initialForm,
    ...terms,
    effectiveDate: dateValue(terms.effectiveDate),
    validUntil: dateValue(terms.validUntil),
    cc: Array.isArray(terms.cc) ? terms.cc.join(", ") : "",
    roleRates: terms.roleRates?.length ? terms.roleRates : [{ ...blankRate }],
    clauses: terms.clauses?.length ? terms.clauses : defaultClauses
  };
}

export default function AdminClientTerms() {
  const [items, setItems] = useState([]);
  const [senders, setSenders] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ search: "", status: "", agreementType: "" });
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  async function load() {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
    const [termsData, senderData] = await Promise.all([api(`/terms${query ? `?${query}` : ""}`), api("/terms/senders")]);
    setItems(termsData);
    setSenders(senderData);
    if (!selected && termsData[0]) setSelected(termsData[0]);
  }

  useEffect(() => {
    load().catch((error) => setStatus({ type: "error", message: error.message }));
  }, []);

  const stats = useMemo(() => {
    const draft = items.filter((item) => item.status === "Draft").length;
    const sent = items.filter((item) => item.status === "Sent").length;
    const signed = items.filter((item) => item.status === "Signed").length;
    return { total: items.length, draft, sent, signed };
  }, [items]);

  const selectedRates = selected?.roleRates || form.roleRates || [];

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateRate(index, field, value) {
    setForm((current) => ({
      ...current,
      roleRates: current.roleRates.map((rate, rateIndex) => (rateIndex === index ? { ...rate, [field]: value } : rate))
    }));
  }

  function updateClause(index, field, value) {
    setForm((current) => ({
      ...current,
      clauses: current.clauses.map((clause, clauseIndex) => (clauseIndex === index ? { ...clause, [field]: value } : clause))
    }));
  }

  function resetForm() {
    setForm(initialForm);
    setEditingId("");
    setMessage("");
  }

  async function saveTerms(event) {
    event.preventDefault();
    setLoading(true);
    setStatus(null);
    try {
      const saved = await api(editingId ? `/terms/${editingId}` : "/terms", {
        method: editingId ? "PUT" : "POST",
        body: form
      });
      setSelected(saved);
      setStatus({ type: "success", message: editingId ? "Client terms updated." : "Client terms created." });
      resetForm();
      await load();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }

  async function sendTerms() {
    if (!selected) return;
    setSending(true);
    setStatus(null);
    try {
      const response = await api(`/terms/${selected._id}/send`, {
        method: "POST",
        body: { fromEmail: form.senderEmail || selected.senderEmail, cc: form.cc || selected.cc, message }
      });
      setSelected(response.terms);
      setStatus({ type: "success", message: `Terms sent to ${response.terms.clientEmail}.` });
      await load();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSending(false);
    }
  }

  async function markSigned() {
    if (!selected) return;
    try {
      const signed = await api(`/terms/${selected._id}/mark-signed`, { method: "POST", body: { signedBy: selected.contactName || selected.clientName } });
      setSelected(signed);
      setStatus({ type: "success", message: "Terms marked as signed." });
      await load();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  async function cancelTerms() {
    if (!selected) return;
    const cancellationReason = window.prompt("Cancellation reason");
    if (cancellationReason === null) return;
    try {
      const cancelled = await api(`/terms/${selected._id}/cancel`, { method: "POST", body: { cancellationReason } });
      setSelected(cancelled);
      setStatus({ type: "success", message: "Terms cancelled." });
      await load();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  async function deleteTerms(id) {
    if (!window.confirm("Delete this draft terms document?")) return;
    try {
      await api(`/terms/${id}`, { method: "DELETE" });
      setStatus({ type: "success", message: "Draft terms deleted." });
      if (selected?._id === id) setSelected(null);
      await load();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  return (
    <section className="admin-page admin-client-terms-page">
      <div className="terms-hero">
        <div className="terms-hero-icon"><FileSignature size={30} /></div>
        <div>
          <span className="section-kicker">Client terms centre</span>
          <h1>Prepare, send and track client terms</h1>
          <p>Create client-specific terms with rates, payment cycles, rebate rules, PDF output and sender-controlled email delivery.</p>
        </div>
        <div className="terms-hero-card">
          <ShieldCheck size={22} />
          <strong>Controlled before candidates are shared</strong>
          <span>Draft, send, sign and archive from one workspace.</span>
        </div>
      </div>

      <StatusMessage status={status} />

      <div className="terms-stat-grid">
        <div className="terms-stat"><span>Total terms</span><strong>{stats.total}</strong></div>
        <div className="terms-stat"><span>Drafts</span><strong>{stats.draft}</strong></div>
        <div className="terms-stat"><span>Sent to clients</span><strong>{stats.sent}</strong></div>
        <div className="terms-stat"><span>Signed</span><strong>{stats.signed}</strong></div>
      </div>

      <div className="terms-workspace">
        <form className="terms-panel terms-form-panel" onSubmit={saveTerms}>
          <div className="terms-panel-head">
            <span className="section-kicker">Terms builder</span>
            <h2>{editingId ? "Edit client terms" : "Create client terms"}</h2>
          </div>

          <div className="terms-form-grid">
            <label>Client / company name<input value={form.clientName} onChange={(event) => updateField("clientName", event.target.value)} required /></label>
            <label>Contact name<input value={form.contactName} onChange={(event) => updateField("contactName", event.target.value)} /></label>
            <label>Client email<input type="email" value={form.clientEmail} onChange={(event) => updateField("clientEmail", event.target.value)} required /></label>
            <label>Agreement type<select value={form.agreementType} onChange={(event) => updateField("agreementType", event.target.value)}><option>Recruitment</option><option>Healthcare Staffing</option><option>Training</option><option>Website</option><option>SEO</option><option>Compliance</option><option>Other</option></select></label>
            <label className="terms-full">Client address<textarea value={form.clientAddress} onChange={(event) => updateField("clientAddress", event.target.value)} rows="2" /></label>
            <label>Effective date<input type="date" value={form.effectiveDate} onChange={(event) => updateField("effectiveDate", event.target.value)} /></label>
            <label>Valid until<input type="date" value={form.validUntil} onChange={(event) => updateField("validUntil", event.target.value)} /></label>
            <label>Payment due days<input type="number" min="0" value={form.paymentDueDays} onChange={(event) => updateField("paymentDueDays", event.target.value)} /></label>
            <label>Rebate period days<input type="number" min="0" value={form.rebatePeriodDays} onChange={(event) => updateField("rebatePeriodDays", event.target.value)} /></label>
            <label className="terms-full">Invoice/payment cycle<textarea value={form.invoiceCycle} onChange={(event) => updateField("invoiceCycle", event.target.value)} rows="2" /></label>
            <label className="terms-full">Rebate terms<textarea value={form.rebateTerms} onChange={(event) => updateField("rebateTerms", event.target.value)} rows="2" /></label>
          </div>

          <div className="terms-section-title">
            <h3>Role rates</h3>
            <button type="button" className="ghost compact" onClick={() => updateField("roleRates", [...form.roleRates, { ...blankRate }])}><Plus size={16} /> Add role</button>
          </div>
          <div className="terms-rate-stack">
            {form.roleRates.map((rate, index) => (
              <div className="terms-rate-card" key={`${index}-${rate.roleTitle}`}>
                <label>Role title<input value={rate.roleTitle} onChange={(event) => updateRate(index, "roleTitle", event.target.value)} placeholder="Registered Manager" /></label>
                <label>Fee type<select value={rate.feeType} onChange={(event) => updateRate(index, "feeType", event.target.value)}><option>Percentage</option><option>Flat Fee</option><option>Hourly Margin</option><option>Custom</option></select></label>
                <label>Rate<input type="number" value={rate.rateValue} onChange={(event) => updateRate(index, "rateValue", event.target.value)} /></label>
                <label>Rate unit<input value={rate.rateUnit} onChange={(event) => updateRate(index, "rateUnit", event.target.value)} /></label>
                <label className="terms-full">Payment trigger<input value={rate.paymentTrigger} onChange={(event) => updateRate(index, "paymentTrigger", event.target.value)} /></label>
                <label className="terms-full">Notes<input value={rate.notes} onChange={(event) => updateRate(index, "notes", event.target.value)} /></label>
                {form.roleRates.length > 1 && <button type="button" className="ghost danger compact" onClick={() => updateField("roleRates", form.roleRates.filter((_, rateIndex) => rateIndex !== index))}><Trash2 size={15} /> Remove</button>}
              </div>
            ))}
          </div>

          <div className="terms-section-title">
            <h3>Editable clauses</h3>
            <button type="button" className="ghost compact" onClick={() => updateField("clauses", [...form.clauses, { heading: "", body: "", order: form.clauses.length + 1 }])}><Plus size={16} /> Add clause</button>
          </div>
          <div className="terms-clause-stack">
            {form.clauses.map((clause, index) => (
              <div className="terms-clause-card" key={`${index}-${clause.heading}`}>
                <input value={clause.heading} onChange={(event) => updateClause(index, "heading", event.target.value)} placeholder="Clause heading" />
                <textarea value={clause.body} onChange={(event) => updateClause(index, "body", event.target.value)} rows="3" placeholder="Clause wording" />
              </div>
            ))}
          </div>

          <div className="terms-form-grid">
            <label className="terms-full">Special terms<textarea value={form.specialTerms} onChange={(event) => updateField("specialTerms", event.target.value)} rows="3" placeholder="Client-specific payment, rebate or service conditions" /></label>
            <label>Send from<select value={form.senderEmail} onChange={(event) => updateField("senderEmail", event.target.value)}>{senders.map((sender) => <option key={sender.address} value={sender.address}>{sender.label} ({sender.address})</option>)}</select></label>
            <label>CC emails<input value={form.cc} onChange={(event) => updateField("cc", event.target.value)} placeholder="optional, comma separated" /></label>
          </div>

          <div className="terms-actions">
            {editingId && <button type="button" className="ghost" onClick={resetForm}>Cancel edit</button>}
            <SubmitButton loading={loading} loadingText="Saving terms...">{editingId ? "Update Terms" : "Create Terms"}</SubmitButton>
          </div>
        </form>

        <aside className="terms-panel terms-preview-panel">
          <div className="terms-panel-head">
            <span className="section-kicker">Client preview</span>
            <h2>{selected?.clientName || "Select terms"}</h2>
            <p>{selected ? `${selected.documentNumber} | ${selected.agreementType}` : "Choose a terms record below to preview and send."}</p>
          </div>
          {selected && (
            <>
              <span className={`terms-status ${statusClass(selected.status)}`}>{selected.status}</span>
              <dl className="terms-preview-list">
                <div><dt>Email</dt><dd>{selected.clientEmail}</dd></div>
                <div><dt>Payment terms</dt><dd>{selected.paymentDueDays} days</dd></div>
                <div><dt>Rebate</dt><dd>{selected.rebatePeriodDays} days</dd></div>
                <div><dt>Effective</dt><dd>{formatDate(selected.effectiveDate)}</dd></div>
              </dl>
              <div className="terms-rate-preview">
                <h3>Role rates</h3>
                {selectedRates.length ? selectedRates.map((rate) => (
                  <div key={rate._id || rate.roleTitle}>
                    <strong>{rate.roleTitle}</strong>
                    <span>{rate.feeType} | {rate.rateValue}{rate.feeType === "Percentage" ? "%" : ` ${rate.rateUnit || ""}`}</span>
                  </div>
                )) : <p>No role rates added.</p>}
              </div>
              <label>Custom email note<textarea value={message} onChange={(event) => setMessage(event.target.value)} rows="4" placeholder="Optional message to client" /></label>
              <div className="terms-preview-actions">
                <button type="button" className="ghost" onClick={() => downloadFile(`/terms/${selected._id}/pdf`, `Innovex-Terms-${selected.documentNumber}.pdf`)}><Download size={16} /> Download PDF</button>
                <button type="button" className="button" disabled={sending} onClick={sendTerms}>{sending ? <RefreshCw size={16} className="spin" /> : <Send size={16} />} Send Terms</button>
                <button type="button" className="ghost success" onClick={markSigned}><CheckCircle2 size={16} /> Mark signed</button>
                <button type="button" className="ghost danger" onClick={cancelTerms}><XCircle size={16} /> Cancel</button>
              </div>
            </>
          )}
        </aside>
      </div>

      <div className="terms-panel terms-register">
        <div className="terms-register-head">
          <div>
            <span className="section-kicker">Terms register</span>
            <h2>Client terms documents</h2>
          </div>
          <div className="terms-filters">
            <input placeholder="Search client, email, role..." value={filters.search} onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} />
            <select value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}><option value="">All statuses</option><option>Draft</option><option>Sent</option><option>Signed</option><option>Expired</option><option>Cancelled</option></select>
            <button type="button" className="button compact" onClick={() => load().catch((error) => setStatus({ type: "error", message: error.message }))}>Search</button>
          </div>
        </div>
        <div className="table-wrap terms-table-wrap">
          <table>
            <thead><tr><th>Document</th><th>Client</th><th>Type</th><th>Status</th><th>Payment</th><th>Updated</th><th>Actions</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id}>
                  <td><strong>{item.documentNumber}</strong><br /><span>{item.title}</span></td>
                  <td><strong>{item.clientName}</strong><br /><span>{item.clientEmail}</span></td>
                  <td>{item.agreementType}</td>
                  <td><span className={`terms-status ${statusClass(item.status)}`}>{item.status}</span></td>
                  <td>{item.paymentDueDays} days<br /><span>Rebate {item.rebatePeriodDays} days</span></td>
                  <td>{formatDate(item.updatedAt)}</td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="ghost compact" onClick={() => { setSelected(item); setForm(formFromTerms(item)); }}>View</button>
                      <button type="button" className="ghost compact" onClick={() => { setEditingId(item._id); setSelected(item); setForm(formFromTerms(item)); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
                      {item.status === "Draft" && <button type="button" className="ghost danger compact" onClick={() => deleteTerms(item._id)}>Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
              {!items.length && <tr><td colSpan="7">No client terms found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
