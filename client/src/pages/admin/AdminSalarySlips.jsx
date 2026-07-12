import { useEffect, useMemo, useState } from "react";
import { api, downloadFile } from "../../api/client.js";

const initialForm = {
  employeeName: "",
  employeeEmail: "",
  employeePhone: "",
  employeeId: "",
  jobTitle: "",
  department: "",
  payPeriodStart: "",
  payPeriodEnd: "",
  paymentDate: "",
  paymentMethod: "Bank transfer",
  exchangeRateLabel: "GBP exchange rate at issue",
  exchangeRateValue: "",
  paymentNotice: "Full payment may take additional time to be received because payment is processed through a broker. Payments may also be received partially before the remaining balance is completed.",
  basicSalary: "",
  overtime: "",
  bonus: "",
  commission: "",
  otherAllowance: "",
  tax: "",
  nationalInsurance: "",
  pension: "",
  otherDeduction: "",
  senderEmail: "",
  cc: "",
  customMessage: "",
  notes: ""
};

const money = (value) => `£${Number(value || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (value) => (value ? new Date(value).toLocaleDateString("en-GB") : "-");

function splitCc(value) {
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

export default function AdminSalarySlips() {
  const [form, setForm] = useState(initialForm);
  const [slips, setSlips] = useState([]);
  const [senders, setSenders] = useState([]);
  const [editingId, setEditingId] = useState("");
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const totals = useMemo(() => {
    const gross = ["basicSalary", "overtime", "bonus", "commission", "otherAllowance"].reduce((sum, key) => sum + Number(form[key] || 0), 0);
    const deductions = ["tax", "nationalInsurance", "pension", "otherDeduction"].reduce((sum, key) => sum + Number(form[key] || 0), 0);
    return { gross, deductions, net: gross - deductions };
  }, [form]);

  async function loadSlips() {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
    const data = await api(`/hr/salary-slips${query ? `?${query}` : ""}`);
    setSlips(data);
    if (!selected && data[0]) setSelected(data[0]);
  }

  useEffect(() => {
    api("/hr/senders").then((data) => {
      setSenders(data);
      if (data[0]) setForm((current) => ({ ...current, senderEmail: current.senderEmail || data[0].address }));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    loadSlips().catch((err) => setError(err.message));
  }, [filters.search, filters.status]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function resetForm() {
    setEditingId("");
    setForm({ ...initialForm, senderEmail: senders[0]?.address || "" });
  }

  async function saveSlip(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const payload = { ...form, cc: splitCc(form.cc) };
      const saved = editingId
        ? await api(`/hr/salary-slips/${editingId}`, { method: "PUT", body: payload })
        : await api("/hr/salary-slips", { method: "POST", body: payload });
      setMessage(editingId ? "Salary slip updated." : "Salary slip draft created.");
      setSelected(saved);
      resetForm();
      await loadSlips();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function editSlip(slip) {
    setEditingId(slip._id);
    setSelected(slip);
    setForm({
      ...initialForm,
      ...slip,
      payPeriodStart: slip.payPeriodStart?.slice(0, 10) || "",
      payPeriodEnd: slip.payPeriodEnd?.slice(0, 10) || "",
      paymentDate: slip.paymentDate?.slice(0, 10) || "",
      cc: (slip.cc || []).join(", ")
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function sendSlip(slip) {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      const response = await api(`/hr/salary-slips/${slip._id}/send`, { method: "POST", body: { fromEmail: slip.senderEmail } });
      setMessage(`Salary slip ${response.slip.slipNumber} sent to ${response.slip.employeeEmail}.`);
      setSelected(response.slip);
      await loadSlips();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function deleteSlip(slip) {
    if (!window.confirm(`Delete salary slip ${slip.slipNumber}?`)) return;
    await api(`/hr/salary-slips/${slip._id}`, { method: "DELETE" });
    setMessage("Salary slip deleted.");
    if (selected?._id === slip._id) setSelected(null);
    await loadSlips();
  }

  const stats = useMemo(() => ({
    total: slips.length,
    sent: slips.filter((slip) => slip.status === "Sent").length,
    drafts: slips.filter((slip) => slip.status === "Draft").length,
    net: slips.reduce((sum, slip) => sum + Number(slip.netPay || 0), 0)
  }), [slips]);

  return (
    <section className="hr-page">
      <div className="hr-hero">
        <div>
          <span className="section-kicker">HR documents</span>
          <h2>Salary slip centre</h2>
          <p>Create professional PDF salary slips, send them directly by email, and keep a clear HR audit trail.</p>
        </div>
        <div className="hr-hero-panel">
          <strong>{stats.sent}</strong>
          <span>sent salary slips</span>
        </div>
      </div>

      {(message || error) && <div className={error ? "form-error" : "form-success"}>{error || message}</div>}

      <div className="hr-stats">
        <div><span>Total drafts</span><strong>{stats.total}</strong></div>
        <div><span>Sent</span><strong>{stats.sent}</strong></div>
        <div><span>Draft</span><strong>{stats.drafts}</strong></div>
        <div><span>Visible net pay</span><strong>{money(stats.net)}</strong></div>
      </div>

      <div className="hr-grid">
        <form className="hr-card hr-form-card" onSubmit={saveSlip}>
          <div className="hr-card-heading">
            <span>Salary document</span>
            <h3>{editingId ? "Edit salary slip" : "Create salary slip"}</h3>
          </div>
          <div className="hr-form-grid">
            <label>Employee name<input value={form.employeeName} onChange={(e) => update("employeeName", e.target.value)} required /></label>
            <label>Employee email<input type="email" value={form.employeeEmail} onChange={(e) => update("employeeEmail", e.target.value)} required /></label>
            <label>Employee phone<input value={form.employeePhone} onChange={(e) => update("employeePhone", e.target.value)} /></label>
            <label>Employee ID<input value={form.employeeId} onChange={(e) => update("employeeId", e.target.value)} /></label>
            <label>Job title<input value={form.jobTitle} onChange={(e) => update("jobTitle", e.target.value)} /></label>
            <label>Department<input value={form.department} onChange={(e) => update("department", e.target.value)} /></label>
            <label>Pay period start<input type="date" value={form.payPeriodStart} onChange={(e) => update("payPeriodStart", e.target.value)} required /></label>
            <label>Pay period end<input type="date" value={form.payPeriodEnd} onChange={(e) => update("payPeriodEnd", e.target.value)} required /></label>
            <label>Payment date<input type="date" value={form.paymentDate} onChange={(e) => update("paymentDate", e.target.value)} required /></label>
            <label>Payment method<input value={form.paymentMethod} onChange={(e) => update("paymentMethod", e.target.value)} /></label>
            <label>Currency rate label<input value={form.exchangeRateLabel} onChange={(e) => update("exchangeRateLabel", e.target.value)} placeholder="GBP exchange rate at issue" /></label>
            <label>Currency rate<input value={form.exchangeRateValue} onChange={(e) => update("exchangeRateValue", e.target.value)} placeholder="e.g. 1 GBP = 355 PKR" /></label>
            <label>Basic salary<input type="number" step="0.01" value={form.basicSalary} onChange={(e) => update("basicSalary", e.target.value)} /></label>
            <label>Overtime<input type="number" step="0.01" value={form.overtime} onChange={(e) => update("overtime", e.target.value)} /></label>
            <label>Bonus<input type="number" step="0.01" value={form.bonus} onChange={(e) => update("bonus", e.target.value)} /></label>
            <label>Commission<input type="number" step="0.01" value={form.commission} onChange={(e) => update("commission", e.target.value)} /></label>
            <label>Other allowance<input type="number" step="0.01" value={form.otherAllowance} onChange={(e) => update("otherAllowance", e.target.value)} /></label>
            <label>Tax<input type="number" step="0.01" value={form.tax} onChange={(e) => update("tax", e.target.value)} /></label>
            <label>National Insurance<input type="number" step="0.01" value={form.nationalInsurance} onChange={(e) => update("nationalInsurance", e.target.value)} /></label>
            <label>Pension<input type="number" step="0.01" value={form.pension} onChange={(e) => update("pension", e.target.value)} /></label>
            <label>Other deduction<input type="number" step="0.01" value={form.otherDeduction} onChange={(e) => update("otherDeduction", e.target.value)} /></label>
            <label>Send from<select value={form.senderEmail} onChange={(e) => update("senderEmail", e.target.value)}>{senders.map((sender) => <option key={sender.address} value={sender.address}>{sender.label} ({sender.address})</option>)}</select></label>
            <label className="full">CC emails<input value={form.cc} onChange={(e) => update("cc", e.target.value)} placeholder="optional, comma separated" /></label>
            <label className="full">Optional message<textarea value={form.customMessage} onChange={(e) => update("customMessage", e.target.value)} placeholder="Leave blank to use the standard salary slip email." /></label>
            <label className="full">Payment timing note<textarea value={form.paymentNotice} onChange={(e) => update("paymentNotice", e.target.value)} /></label>
            <label className="full">Internal notes<textarea value={form.notes} onChange={(e) => update("notes", e.target.value)} /></label>
          </div>
          <div className="hr-totals">
            <span>Gross <strong>{money(totals.gross)}</strong></span>
            <span>Deductions <strong>{money(totals.deductions)}</strong></span>
            <span className="net">Net pay <strong>{money(totals.net)}</strong></span>
          </div>
          <div className="hr-actions">
            {editingId && <button type="button" className="secondary" onClick={resetForm}>Cancel edit</button>}
            <button type="submit" disabled={loading}>{loading ? "Saving..." : editingId ? "Update slip" : "Create salary slip"}</button>
          </div>
        </form>

        <aside className="hr-card hr-preview-card">
          <span className="section-kicker">Selected record</span>
          {selected ? (
            <>
              <h3>{selected.employeeName}</h3>
              <p>{selected.jobTitle || "Employee"} · {selected.slipNumber}</p>
              <div className="hr-detail-list">
                <span>Email <strong>{selected.employeeEmail}</strong></span>
                <span>Period <strong>{dateLabel(selected.payPeriodStart)} - {dateLabel(selected.payPeriodEnd)}</strong></span>
                <span>Status <strong>{selected.status}</strong></span>
                <span>Net pay <strong>{money(selected.netPay)}</strong></span>
                {selected.exchangeRateValue && <span>Currency rate <strong>{selected.exchangeRateValue}</strong></span>}
              </div>
              <div className="hr-preview-actions">
                <button type="button" className="secondary" onClick={() => downloadFile(`/hr/salary-slips/${selected._id}/pdf`, `Innovex-Salary-Slip-${selected.slipNumber}.pdf`)}>Download PDF</button>
                <button type="button" onClick={() => sendSlip(selected)} disabled={loading}>Send email</button>
              </div>
            </>
          ) : (
            <p>Select or create a salary slip to preview actions.</p>
          )}
        </aside>
      </div>

      <div className="hr-card hr-table-card">
        <div className="hr-table-tools">
          <div>
            <span className="section-kicker">Salary register</span>
            <h3>Salary slips</h3>
          </div>
          <input value={filters.search} onChange={(e) => setFilters((current) => ({ ...current, search: e.target.value }))} placeholder="Search employee, email, role..." />
          <select value={filters.status} onChange={(e) => setFilters((current) => ({ ...current, status: e.target.value }))}>
            <option value="">All statuses</option>
            <option value="Draft">Draft</option>
            <option value="Sent">Sent</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
        <div className="table-scroll">
          <table>
            <thead><tr><th>Slip</th><th>Employee</th><th>Period</th><th>Net pay</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {slips.map((slip) => (
                <tr key={slip._id}>
                  <td><strong>{slip.slipNumber}</strong><br /><span>{dateLabel(slip.paymentDate)}</span></td>
                  <td><strong>{slip.employeeName}</strong><br /><span>{slip.employeeEmail}</span></td>
                  <td>{dateLabel(slip.payPeriodStart)}<br />{dateLabel(slip.payPeriodEnd)}</td>
                  <td><strong>{money(slip.netPay)}</strong></td>
                  <td><span className={`hr-status ${slip.status.toLowerCase()}`}>{slip.status}</span></td>
                  <td className="action-row">
                    <button type="button" className="secondary" onClick={() => setSelected(slip)}>View</button>
                    <button type="button" className="secondary" onClick={() => editSlip(slip)}>Edit</button>
                    <button type="button" onClick={() => sendSlip(slip)}>Send</button>
                    <button type="button" className="danger" onClick={() => deleteSlip(slip)}>Delete</button>
                  </td>
                </tr>
              ))}
              {!slips.length && <tr><td colSpan="6">No salary slips found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
