import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileSignature,
  Mail,
  Plus,
  RefreshCw,
  Send,
  Trash2,
  XCircle
} from "lucide-react";
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

const today = new Date().toISOString().slice(0, 10);

const initialForm = {
  title: "Terms of Business",
  agreementType: "Recruitment",
  clientName: "",
  contactName: "",
  clientEmail: "",
  clientAddress: "",
  clientCompanyNumber: "",
  effectiveDate: today,
  validUntil: "",
  paymentDueDays: 14,
  invoiceCycle: "Invoice to be issued on candidate start date unless agreed otherwise.",
  rebatePeriodDays: 28,
  rebateTerms: "Standard rebate or replacement support applies only when invoices are paid within agreed terms.",
  roleRates: [{ ...blankRate }],
  specialTerms: "",
  internalNotes: "",
  senderEmail: "info@innovexresourcegroup.co.uk",
  cc: "",
  message: ""
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

function cleanEmail(value) {
  return String(value || "")
    .replace(/^mailto:/i, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(cleanEmail(value));
}

function splitEmails(value) {
  return String(value || "")
    .split(/[,\n;]/)
    .map(cleanEmail)
    .filter(Boolean);
}

function formFromTerms(terms) {
  return {
    ...initialForm,
    ...terms,
    effectiveDate: dateValue(terms.effectiveDate),
    validUntil: dateValue(terms.validUntil),
    cc: Array.isArray(terms.cc) ? terms.cc.join(", ") : "",
    roleRates: terms.roleRates?.length ? terms.roleRates : [{ ...blankRate }],
    message: ""
  };
}

function buildPayload(form) {
  return {
    title: "Terms of Business",
    agreementType: form.agreementType,
    clientName: form.clientName.trim(),
    contactName: form.contactName.trim(),
    clientEmail: cleanEmail(form.clientEmail),
    clientAddress: form.clientAddress.trim(),
    clientCompanyNumber: form.clientCompanyNumber.trim(),
    effectiveDate: form.effectiveDate || today,
    validUntil: form.validUntil || null,
    paymentDueDays: Number(form.paymentDueDays || 0),
    invoiceCycle: form.invoiceCycle.trim(),
    rebatePeriodDays: Number(form.rebatePeriodDays || 0),
    rebateTerms: form.rebateTerms.trim(),
    roleRates: form.roleRates
      .map((rate) => ({
        roleTitle: String(rate.roleTitle || "").trim(),
        feeType: rate.feeType || "Percentage",
        rateValue: Number(rate.rateValue || 0),
        rateUnit: String(rate.rateUnit || "").trim() || (rate.feeType === "Flat Fee" ? "fixed fee" : "% of annual salary"),
        paymentTrigger: String(rate.paymentTrigger || "").trim() || "Payable on candidate start date",
        notes: String(rate.notes || "").trim()
      }))
      .filter((rate) => rate.roleTitle),
    specialTerms: form.specialTerms.trim(),
    internalNotes: form.internalNotes.trim(),
    senderEmail: cleanEmail(form.senderEmail),
    cc: splitEmails(form.cc)
  };
}

export default function AdminClientTerms() {
  const [items, setItems] = useState([]);
  const [senders, setSenders] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState("");
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ search: "", status: "", agreementType: "" });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  async function load(nextFilters = filters) {
    const query = new URLSearchParams(Object.entries(nextFilters).filter(([, value]) => value)).toString();
    const [termsData, senderData] = await Promise.all([api(`/terms${query ? `?${query}` : ""}`), api("/terms/senders")]);
    setItems(termsData);
    setSenders(senderData);
    if (!form.senderEmail && senderData[0]?.address) {
      setForm((current) => ({ ...current, senderEmail: senderData[0].address }));
    }
    if (!selected && termsData[0]) setSelected(termsData[0]);
  }

  useEffect(() => {
    load().catch((error) => setStatus({ type: "error", message: error.message }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stats = useMemo(() => {
    const draft = items.filter((item) => item.status === "Draft").length;
    const sent = items.filter((item) => item.status === "Sent").length;
    const signed = items.filter((item) => item.status === "Signed").length;
    return { total: items.length, draft, sent, signed };
  }, [items]);

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateRate(index, field, value) {
    setForm((current) => ({
      ...current,
      roleRates: current.roleRates.map((rate, rateIndex) => (rateIndex === index ? { ...rate, [field]: value } : rate))
    }));
  }

  function addRate() {
    setForm((current) => ({ ...current, roleRates: [...current.roleRates, { ...blankRate }] }));
  }

  function removeRate(index) {
    setForm((current) => ({
      ...current,
      roleRates: current.roleRates.filter((_, rateIndex) => rateIndex !== index)
    }));
  }

  function selectTerms(item) {
    setSelected(item);
    setForm(formFromTerms(item));
    setEditingId("");
  }

  function resetForm() {
    setForm({ ...initialForm, senderEmail: senders[0]?.address || initialForm.senderEmail });
    setEditingId("");
  }

  function validateForm() {
    if (!form.clientName.trim()) return "Client/company name is required.";
    if (!isEmail(form.clientEmail)) return "Client email must be a real email address, for example manager@carehome.co.uk.";
    const invalidCc = splitEmails(form.cc).find((email) => !isEmail(email));
    if (invalidCc) return `CC email looks invalid: ${invalidCc}`;
    if (!form.roleRates.some((rate) => String(rate.roleTitle || "").trim())) return "Add at least one role and rate before saving terms.";
    return "";
  }

  async function saveTerms(event) {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setStatus({ type: "error", message: validationError });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const saved = await api(editingId ? `/terms/${editingId}` : "/terms", {
        method: editingId ? "PUT" : "POST",
        body: buildPayload(form)
      });
      setSelected(saved);
      setStatus({ type: "success", message: editingId ? "Commercial schedule updated." : "Client terms draft created." });
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
      const fromEmail = form.senderEmail || selected.senderEmail || senders[0]?.address || initialForm.senderEmail;
      const response = await api(`/terms/${selected._id}/send`, {
        method: "POST",
        body: { fromEmail, cc: splitEmails(form.cc), message: form.message }
      });
      setSelected(response.terms);
      setForm(formFromTerms(response.terms));
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
      const signed = await api(`/terms/${selected._id}/mark-signed`, {
        method: "POST",
        body: { signedBy: selected.contactName || selected.clientName }
      });
      setSelected(signed);
      setForm(formFromTerms(signed));
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
      const cancelled = await api(`/terms/${selected._id}/cancel`, {
        method: "POST",
        body: { cancellationReason }
      });
      setSelected(cancelled);
      setForm(formFromTerms(cancelled));
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

  const selectedRates = selected?.roleRates || [];

  return (
    <section className="admin-page admin-client-terms-page terms-simple-page">
      <div className="terms-simple-hero">
        <div className="terms-hero-copy">
          <span className="section-kicker">Client terms centre</span>
          <h1>Client terms and commercial schedule</h1>
          <p>
            Use your original IRG Terms of Business. The CRM only prepares the client-specific schedule: client details, role rates, payment days and rebate period.
          </p>
          <div className="terms-hero-steps">
            <span>Client details</span>
            <span>Rates & rebate</span>
            <span>Send PDF</span>
          </div>
        </div>
        <div className="terms-simple-note">
          <FileSignature size={24} />
          <strong>Original IRG terms protected</strong>
          <span>The final PDF attaches your fixed terms after the commercial schedule. Staff should not rewrite legal clauses.</span>
        </div>
      </div>

      <StatusMessage status={status} />

      <div className="terms-stat-grid terms-simple-stats">
        <div className="terms-stat"><span>Total terms</span><strong>{stats.total}</strong></div>
        <div className="terms-stat"><span>Draft schedules</span><strong>{stats.draft}</strong></div>
        <div className="terms-stat"><span>Sent to clients</span><strong>{stats.sent}</strong></div>
        <div className="terms-stat"><span>Signed terms</span><strong>{stats.signed}</strong></div>
      </div>

      <div className="terms-simple-workspace">
        <form className="terms-simple-card terms-simple-form" onSubmit={saveTerms}>
          <div className="terms-simple-card-head">
            <span className="section-kicker">Commercial schedule</span>
            <h2>{editingId ? "Edit client schedule" : "Create client schedule"}</h2>
            <p>Fill only the details that change from client to client.</p>
          </div>

          <div className="terms-step-title">Client information</div>
          <div className="terms-form-grid">
            <label>Client / company name<input value={form.clientName} onChange={(event) => updateField("clientName", event.target.value)} required /></label>
            <label>Contact person<input value={form.contactName} onChange={(event) => updateField("contactName", event.target.value)} /></label>
            <label>Client email<input type="email" value={form.clientEmail} onChange={(event) => updateField("clientEmail", event.target.value)} placeholder="manager@carehome.co.uk" required /></label>
            <label>Agreement type<select value={form.agreementType} onChange={(event) => updateField("agreementType", event.target.value)}><option>Recruitment</option><option>Healthcare Staffing</option><option>Training</option><option>Website</option><option>SEO</option><option>Compliance</option><option>Other</option></select></label>
            <label className="terms-full">Registered / trading address<textarea value={form.clientAddress} onChange={(event) => updateField("clientAddress", event.target.value)} rows="2" /></label>
          </div>

          <div className="terms-step-title">Payment and rebate settings</div>
          <div className="terms-form-grid">
            <label>Effective date<input type="date" value={form.effectiveDate} onChange={(event) => updateField("effectiveDate", event.target.value)} /></label>
            <label>Valid until<input type="date" value={form.validUntil} onChange={(event) => updateField("validUntil", event.target.value)} /></label>
            <label>Invoice due within days<input type="number" min="0" value={form.paymentDueDays} onChange={(event) => updateField("paymentDueDays", event.target.value)} /></label>
            <label>Rebate period days<input type="number" min="0" value={form.rebatePeriodDays} onChange={(event) => updateField("rebatePeriodDays", event.target.value)} /></label>
            <label className="terms-full">Invoice/payment cycle<textarea value={form.invoiceCycle} onChange={(event) => updateField("invoiceCycle", event.target.value)} rows="2" /></label>
            <label className="terms-full">Rebate note<textarea value={form.rebateTerms} onChange={(event) => updateField("rebateTerms", event.target.value)} rows="2" /></label>
          </div>

          <div className="terms-section-title">
            <div>
              <h3>Role rates</h3>
              <p>Add the role-specific fees you normally change for each client.</p>
            </div>
            <button type="button" className="ghost compact" onClick={addRate}><Plus size={16} /> Add role</button>
          </div>
          <div className="terms-rate-stack">
            {form.roleRates.map((rate, index) => (
              <div className="terms-rate-card terms-commercial-row" key={rate._id || `rate-${index}`}>
                <label>Role title<input value={rate.roleTitle} onChange={(event) => updateRate(index, "roleTitle", event.target.value)} placeholder="Registered Manager" /></label>
                <label>Fee type<select value={rate.feeType} onChange={(event) => updateRate(index, "feeType", event.target.value)}><option>Percentage</option><option>Flat Fee</option><option>Hourly Margin</option><option>Custom</option></select></label>
                <label>Rate<input type="number" value={rate.rateValue} onChange={(event) => updateRate(index, "rateValue", event.target.value)} placeholder="8" /></label>
                <label>Rate unit<input value={rate.rateUnit} onChange={(event) => updateRate(index, "rateUnit", event.target.value)} placeholder="% of annual salary" /></label>
                <label className="terms-full">Payment trigger<input value={rate.paymentTrigger} onChange={(event) => updateRate(index, "paymentTrigger", event.target.value)} /></label>
                <label className="terms-full">Role notes<input value={rate.notes} onChange={(event) => updateRate(index, "notes", event.target.value)} placeholder="Optional client-specific note" /></label>
                {form.roleRates.length > 1 && <button type="button" className="ghost danger compact terms-remove-rate" onClick={() => removeRate(index)}><Trash2 size={15} /> Remove role</button>}
              </div>
            ))}
          </div>

          <div className="terms-step-title">Send settings</div>
          <div className="terms-form-grid">
            <label>Send from<select value={form.senderEmail} onChange={(event) => updateField("senderEmail", event.target.value)}>{senders.map((sender) => <option key={sender.address} value={sender.address}>{sender.label} ({sender.address})</option>)}</select></label>
            <label>CC emails<input value={form.cc} onChange={(event) => updateField("cc", event.target.value)} placeholder="optional, comma separated" /></label>
            <label className="terms-full">Optional internal note<textarea value={form.internalNotes} onChange={(event) => updateField("internalNotes", event.target.value)} rows="2" placeholder="Only visible inside CRM" /></label>
            <label className="terms-full">Optional email message<textarea value={form.message} onChange={(event) => updateField("message", event.target.value)} rows="3" placeholder="Leave blank to use the standard professional email." /></label>
          </div>

          <div className="terms-actions">
            {editingId && <button type="button" className="ghost" onClick={resetForm}>Cancel edit</button>}
            <SubmitButton loading={loading} loadingText="Saving schedule...">{editingId ? "Update Schedule" : "Save Draft Terms"}</SubmitButton>
          </div>
        </form>

        <aside className="terms-simple-card terms-client-preview">
          <div className="terms-simple-card-head">
            <span className="section-kicker">Selected client</span>
            <h2>{selected?.clientName || "No terms selected"}</h2>
            <p>{selected ? `${selected.documentNumber} - ${selected.agreementType}` : "Select a draft from the register after saving."}</p>
          </div>

          {selected ? (
            <>
              <span className={`terms-status ${statusClass(selected.status)}`}>{selected.status}</span>
              <dl className="terms-preview-list">
                <div><dt>Email</dt><dd>{selected.clientEmail}</dd></div>
                <div><dt>Status</dt><dd>{selected.status}</dd></div>
                <div><dt>Rates</dt><dd>{selectedRates.length} role rate{selectedRates.length === 1 ? "" : "s"}</dd></div>
                <div><dt>Effective</dt><dd>{formatDate(selected.effectiveDate)}</dd></div>
              </dl>
              <div className="terms-rate-preview">
                <h3>Commercial rates</h3>
                {selectedRates.length ? selectedRates.map((rate) => (
                  <div key={rate._id || rate.roleTitle}>
                    <strong>{rate.roleTitle}</strong>
                    <span>{rate.feeType} - {rate.rateValue}{rate.feeType === "Percentage" ? "%" : ` ${rate.rateUnit || ""}`}</span>
                  </div>
                )) : <p>No role rates added.</p>}
              </div>
              <div className="terms-preview-actions">
                <button type="button" className="ghost" onClick={() => downloadFile(`/terms/${selected._id}/pdf`, `Innovex-Terms-${selected.documentNumber}.pdf`)}><Download size={16} /> Download PDF</button>
                <button type="button" className="button" disabled={sending} onClick={sendTerms}>{sending ? <RefreshCw size={16} className="spin" /> : <Send size={16} />} Send Terms</button>
                <button type="button" className="ghost success" onClick={markSigned}><CheckCircle2 size={16} /> Mark signed</button>
                <button type="button" className="ghost danger" onClick={cancelTerms}><XCircle size={16} /> Cancel</button>
              </div>
            </>
          ) : (
            <div className="terms-empty-preview">
              <Mail size={28} />
              <strong>Create a draft first</strong>
              <span>After saving, download or send the commercial schedule with your original IRG terms attached.</span>
            </div>
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
            <thead><tr><th>Document</th><th>Client</th><th>Type</th><th>Status</th><th>Schedule</th><th>Updated</th><th>Actions</th></tr></thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id}>
                  <td><strong>{item.documentNumber}</strong><br /><span>{item.title}</span></td>
                  <td><strong>{item.clientName}</strong><br /><span>{item.clientEmail}</span></td>
                  <td>{item.agreementType}</td>
                  <td><span className={`terms-status ${statusClass(item.status)}`}>{item.status}</span></td>
                  <td><strong>{item.roleRates?.length || 0} rate{item.roleRates?.length === 1 ? "" : "s"}</strong><br /><span>{item.roleRates?.[0]?.roleTitle || "Commercial schedule"}</span></td>
                  <td>{formatDate(item.updatedAt)}</td>
                  <td>
                    <div className="table-actions">
                      <button type="button" className="ghost compact" onClick={() => selectTerms(item)}>View</button>
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
