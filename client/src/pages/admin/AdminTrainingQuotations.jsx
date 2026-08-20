import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, FilePlus2, GraduationCap, Mail, Pencil, Plus, Search, Send, Trash2, X } from "lucide-react";
import { api, downloadFile } from "../../api/client.js";
import { hasPermission } from "../../auth/permissions.js";
import StatusMessage from "../../components/StatusMessage.jsx";
import SubmitButton from "../../components/SubmitButton.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

function dateInput(value = new Date()) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function money(value) {
  return `£${Number(value || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateLabel(value) {
  return value ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "-";
}

const defaultInclusions = ["Qualified trainer", "Training materials", "Certification", "Administrative support", "Trainer travel and expenses"];

function blankLine() {
  return { course: "", title: "", description: "", delegates: 15, sessions: 1, unitPrice: "", discountPercent: 0 };
}

function initialForm(senderEmail = "") {
  return {
    issueDate: dateInput(), validDays: 14, clientName: "", contactName: "", contactJobTitle: "", clientEmail: "", clientPhone: "", clientAddress: "",
    trainingLocations: "", deliverySummary: "Training can be delivered at the client location or another agreed venue according to operational requirements.",
    programmeTitle: "Training programme", programmeDescription: "Training will be scheduled subject to trainer availability and delivered around the operational needs of your service.",
    lineItems: [blankLine()], inclusions: defaultInclusions, paymentTerms: "50% deposit is due before the session. The session date is confirmed upon receipt of the deposit. The remaining 50% is due following delivery.",
    timescaleTerms: "The first session can be scheduled subject to availability and around the operational needs of the client.", additionalTerms: "",
    openingMessage: "Thank you for your enquiry and for confirming your training requirements. We are pleased to provide the following quotation for face-to-face training delivered on-site.",
    closingMessage: "We would be delighted to support your organisation in delivering consistently high-quality, professional training. Please contact us if you require any clarification or wish to discuss the proposed programme.",
    signatoryName: "Haider Zaman Syed", signatoryTitle: "General Manager", senderEmail, cc: "", customMessage: ""
  };
}

function toForm(item) {
  return {
    ...initialForm(item.senderEmail || ""), ...item, issueDate: dateInput(item.issueDate),
    cc: (item.cc || []).join(", "), inclusions: item.inclusions || defaultInclusions,
    lineItems: (item.lineItems || []).map((line) => ({ ...line, course: line.course || "" }))
  };
}

export default function AdminTrainingQuotations() {
  const { user } = useAuth();
  const canDelete = hasPermission(user, "trainingQuotations.manage");
  const [quotations, setQuotations] = useState([]);
  const [courses, setCourses] = useState([]);
  const [senders, setSenders] = useState([]);
  const [form, setForm] = useState(initialForm());
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState(null);
  const [filters, setFilters] = useState({ search: "", status: "" });

  async function load() {
    try {
      const query = new URLSearchParams(filters);
      setQuotations(await api(`/training-quotations?${query.toString()}`));
    } catch (error) { setStatus({ type: "error", message: error.message }); }
  }

  useEffect(() => {
    Promise.all([api("/training-quotations/options"), api("/training-quotations")])
      .then(([options, list]) => {
        setCourses(options.courses || []);
        setSenders(options.senders || []);
        setQuotations(list || []);
        const senderEmail = options.senders?.[0]?.address || "";
        setForm(initialForm(senderEmail));
      })
      .catch((error) => setStatus({ type: "error", message: error.message }));
  }, []);

  const totals = useMemo(() => form.lineItems.reduce((summary, line) => {
    const gross = Number(line.sessions || 1) * Number(line.unitPrice || 0);
    const final = gross * (1 - Number(line.discountPercent || 0) / 100);
    return { subtotal: summary.subtotal + gross, discount: summary.discount + gross - final, total: summary.total + final };
  }, { subtotal: 0, discount: 0, total: 0 }), [form.lineItems]);

  function updateLine(index, key, value) {
    const lineItems = form.lineItems.map((line, lineIndex) => lineIndex === index ? { ...line, [key]: value } : line);
    setForm({ ...form, lineItems });
  }

  function chooseCourse(index, courseId) {
    const course = courses.find((item) => item._id === courseId);
    const lineItems = form.lineItems.map((line, lineIndex) => lineIndex === index ? {
      ...line, course: courseId, title: course?.title || line.title, description: course?.duration ? `${course.duration}${course.category ? ` | ${course.category}` : ""}` : course?.description || line.description
    } : line);
    setForm({ ...form, lineItems });
  }

  function removeLine(index) {
    setForm({ ...form, lineItems: form.lineItems.length > 1 ? form.lineItems.filter((_, lineIndex) => lineIndex !== index) : [blankLine()] });
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, validDays: Number(form.validDays || 14), cc: form.cc, lineItems: form.lineItems.map((line) => ({ ...line, delegates: Number(line.delegates || 1), sessions: Number(line.sessions || 1), unitPrice: Number(line.unitPrice), discountPercent: Number(line.discountPercent || 0) })) };
      const saved = await api(editing ? `/training-quotations/${editing}` : "/training-quotations", { method: editing ? "PUT" : "POST", body: payload });
      setStatus({ message: editing ? `Quotation ${saved.quotationNumber} updated.` : `Draft ${saved.quotationNumber} created.` });
      setSelected(saved);
      setEditing(null);
      setForm(initialForm(form.senderEmail || senders[0]?.address || ""));
      await load();
    } catch (error) { setStatus({ type: "error", message: error.message }); }
    finally { setSaving(false); }
  }

  function edit(item) {
    setEditing(item._id);
    setSelected(item);
    setForm(toForm(item));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function download(item) {
    try { await downloadFile(`/training-quotations/${item._id}/pdf`, `Innovex-Training-Quotation-${item.quotationNumber}.pdf`); }
    catch (error) { setStatus({ type: "error", message: error.message }); }
  }

  async function sendQuotation() {
    if (!selected) return;
    setSending(true);
    try {
      const result = await api(`/training-quotations/${selected._id}/send`, { method: "POST", body: { fromEmail: form.senderEmail || selected.senderEmail || senders[0]?.address, cc: form.cc || (selected.cc || []).join(", "), customMessage: form.customMessage || selected.customMessage || "" } });
      setSelected(result.quotation);
      setStatus({ message: result.message || "Quotation sent with PDF attachment." });
      await load();
    } catch (error) { setStatus({ type: "error", message: error.message }); }
    finally { setSending(false); }
  }

  async function changeStatus(item, nextStatus) {
    try {
      const updated = await api(`/training-quotations/${item._id}`, { method: "PUT", body: { status: nextStatus } });
      setSelected(updated);
      setStatus({ message: `${item.quotationNumber} marked ${nextStatus}.` });
      await load();
    } catch (error) { setStatus({ type: "error", message: error.message }); }
  }

  async function remove(item) {
    if (!confirm(`Delete ${item.quotationNumber}?`)) return;
    try {
      await api(`/training-quotations/${item._id}`, { method: "DELETE" });
      if (selected?._id === item._id) setSelected(null);
      setStatus({ message: "Quotation deleted." });
      await load();
    } catch (error) { setStatus({ type: "error", message: error.message }); }
  }

  return (
    <>
      <section className="quotation-hero">
        <div><span className="eyebrow">Training proposals</span><h1><GraduationCap size={30} /> Course Quotations</h1><p>Create a polished training proposal, enter every price manually, download the PDF and email it to your client without leaving the portal.</p></div>
        <div className="quotation-hero-card"><FilePlus2 size={23} /><span>Simple workflow</span><strong>Draft → PDF → Send</strong><small>Every quotation is numbered and retained in history.</small></div>
      </section>
      <StatusMessage status={status} />

      <div className="quotation-work-grid">
        <form className="card quotation-form" onSubmit={save}>
          <div className="quotation-form-head"><div><span className="eyebrow">Quotation builder</span><h2>{editing ? "Edit quotation" : "Create new quotation"}</h2></div>{editing && <button type="button" className="button secondary small" onClick={() => { setEditing(null); setForm(initialForm(senders[0]?.address || "")); }}>Cancel edit</button>}</div>

          <section className="quotation-form-section"><h3>Client and reference details</h3><div className="quotation-form-grid">
            <label><span>Issue date</span><input type="date" value={form.issueDate} onChange={(e) => setForm({ ...form, issueDate: e.target.value })} required /></label>
            <label><span>Valid for (days)</span><input type="number" min="1" max="365" value={form.validDays} onChange={(e) => setForm({ ...form, validDays: e.target.value })} required /></label>
            <label><span>Client/company</span><input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} required /></label>
            <label><span>Contact person</span><input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} required /></label>
            <label><span>Job title</span><input value={form.contactJobTitle} onChange={(e) => setForm({ ...form, contactJobTitle: e.target.value })} /></label>
            <label><span>Client email</span><input type="email" value={form.clientEmail} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} required /></label>
            <label><span>Client phone</span><input value={form.clientPhone} onChange={(e) => setForm({ ...form, clientPhone: e.target.value })} /></label>
            <label className="span-2"><span>Client address</span><textarea rows="2" value={form.clientAddress} onChange={(e) => setForm({ ...form, clientAddress: e.target.value })} /></label>
          </div></section>

          <section className="quotation-form-section"><h3>Delivery and programme</h3><div className="quotation-form-grid">
            <label className="span-2"><span>Opening message</span><textarea rows="3" value={form.openingMessage} onChange={(e) => setForm({ ...form, openingMessage: e.target.value })} required /></label>
            <label><span>Training locations</span><textarea rows="3" placeholder="Postcodes or full venue details" value={form.trainingLocations} onChange={(e) => setForm({ ...form, trainingLocations: e.target.value })} required /></label>
            <label><span>Location/delivery note</span><textarea rows="3" value={form.deliverySummary} onChange={(e) => setForm({ ...form, deliverySummary: e.target.value })} required /></label>
            <label><span>Programme heading</span><input value={form.programmeTitle} onChange={(e) => setForm({ ...form, programmeTitle: e.target.value })} /></label>
            <label><span>Programme description</span><textarea rows="3" value={form.programmeDescription} onChange={(e) => setForm({ ...form, programmeDescription: e.target.value })} required /></label>
          </div></section>

          <section className="quotation-form-section"><div className="quotation-section-head"><div><h3>Courses and manual prices</h3><p>Select an existing course or type a custom training line. Prices are never auto-filled.</p></div><button type="button" className="button secondary small" onClick={() => setForm({ ...form, lineItems: [...form.lineItems, blankLine()] })}><Plus size={16} /> Add line</button></div>
            <div className="quotation-lines">{form.lineItems.map((line, index) => <article className="quotation-line" key={index}>
              <div className="quotation-line-top"><strong>Training line {index + 1}</strong><button type="button" onClick={() => removeLine(index)} aria-label="Remove quotation line"><X size={17} /></button></div>
              <div className="quotation-line-grid">
                <label className="span-2"><span>Choose portal course (optional)</span><select value={line.course} onChange={(e) => chooseCourse(index, e.target.value)}><option value="">Custom training line</option>{courses.map((course) => <option value={course._id} key={course._id}>{course.title}</option>)}</select></label>
                <label className="span-2"><span>Course/session title</span><input value={line.title} onChange={(e) => updateLine(index, "title", e.target.value)} required /></label>
                <label className="span-2"><span>Description</span><input value={line.description} onChange={(e) => updateLine(index, "description", e.target.value)} /></label>
                <label><span>Delegates</span><input type="number" min="1" value={line.delegates} onChange={(e) => updateLine(index, "delegates", e.target.value)} /></label>
                <label><span>Sessions</span><input type="number" min="1" value={line.sessions} onChange={(e) => updateLine(index, "sessions", e.target.value)} required /></label>
                <label><span>Your price per session (£)</span><input type="number" min="0" step="0.01" value={line.unitPrice} onChange={(e) => updateLine(index, "unitPrice", e.target.value)} required /></label>
                <label><span>Discount %</span><input type="number" min="0" max="100" step="0.01" value={line.discountPercent} onChange={(e) => updateLine(index, "discountPercent", e.target.value)} /></label>
              </div>
            </article>)}</div>
            <div className="quotation-total-bar"><span>Subtotal <strong>{money(totals.subtotal)}</strong></span><span>Discount <strong>-{money(totals.discount)}</strong></span><span className="total">Quotation total <strong>{money(totals.total)}</strong></span></div>
          </section>

          <section className="quotation-form-section"><h3>Inclusions and commercial terms</h3><div className="quotation-form-grid">
            <label className="span-2"><span>Included in every session (one per line)</span><textarea rows="4" value={form.inclusions.join("\n")} onChange={(e) => setForm({ ...form, inclusions: e.target.value.split("\n") })} /></label>
            <label><span>Payment terms</span><textarea rows="4" value={form.paymentTerms} onChange={(e) => setForm({ ...form, paymentTerms: e.target.value })} required /></label>
            <label><span>Timescale</span><textarea rows="4" value={form.timescaleTerms} onChange={(e) => setForm({ ...form, timescaleTerms: e.target.value })} required /></label>
            <label className="span-2"><span>Additional terms (optional)</span><textarea rows="3" value={form.additionalTerms} onChange={(e) => setForm({ ...form, additionalTerms: e.target.value })} /></label>
            <label className="span-2"><span>Closing message</span><textarea rows="4" value={form.closingMessage} onChange={(e) => setForm({ ...form, closingMessage: e.target.value })} required /></label>
            <label><span>Signatory name</span><input value={form.signatoryName} onChange={(e) => setForm({ ...form, signatoryName: e.target.value })} required /></label>
            <label><span>Signatory title</span><input value={form.signatoryTitle} onChange={(e) => setForm({ ...form, signatoryTitle: e.target.value })} required /></label>
          </div></section>
          <SubmitButton loading={saving} loadingText="Saving quotation..."><FilePlus2 size={17} /> {editing ? "Update Quotation" : "Save Draft Quotation"}</SubmitButton>
        </form>

        <aside className="quotation-side">
          <section className="card quotation-send-card">
            <div className="quotation-side-title"><Mail size={21} /><div><h2>Send quotation</h2><p>Save or select a quotation first.</p></div></div>
            {selected ? <>
              <div className="quotation-selected"><span>{selected.status}</span><strong>{selected.quotationNumber}</strong><small>{selected.clientName} · {money(selected.total)}</small></div>
              <label><span>From mailbox</span><select value={form.senderEmail || selected.senderEmail || senders[0]?.address || ""} onChange={(e) => setForm({ ...form, senderEmail: e.target.value })}>{senders.map((sender) => <option value={sender.address} key={sender.address}>{sender.label} — {sender.address}</option>)}</select></label>
              <label><span>CC emails</span><input placeholder="email1@example.com, email2@example.com" value={form.cc} onChange={(e) => setForm({ ...form, cc: e.target.value })} /></label>
              <label><span>Email message (optional)</span><textarea rows="5" placeholder="Portal will use a professional default message if left blank." value={form.customMessage} onChange={(e) => setForm({ ...form, customMessage: e.target.value })} /></label>
              <div className="quotation-send-actions"><button type="button" className="button secondary" onClick={() => download(selected)}><Download size={17} /> Download PDF</button><button type="button" className="button" disabled={sending || !senders.length} onClick={sendQuotation}><Send size={17} /> {sending ? "Sending..." : "Email PDF"}</button></div>
            </> : <div className="quotation-empty"><GraduationCap size={32} /><strong>No quotation selected</strong><span>Create a draft or select one from history.</span></div>}
          </section>
        </aside>
      </div>

      <section className="quotation-history">
        <div className="quotation-history-head"><div><span className="eyebrow">Document register</span><h2>Quotation history</h2></div><div className="quotation-filters"><label><Search size={16} /><input placeholder="Search reference, client or course" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></label><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option><option>Draft</option><option>Sent</option><option>Accepted</option><option>Declined</option><option>Expired</option></select><button className="button small" type="button" onClick={load}>Search</button></div></div>
        <div className="table-wrap quotation-table"><table><thead><tr><th>Quotation</th><th>Client</th><th>Courses</th><th>Date</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>
          {quotations.map((item) => <tr key={item._id} className={selected?._id === item._id ? "selected-row" : ""}><td><strong>{item.quotationNumber}</strong>{item.sentAt && <><br /><span className="muted">Sent {dateLabel(item.sentAt)}</span></>}</td><td><strong>{item.clientName}</strong><br /><span className="muted">{item.contactName} · {item.clientEmail}</span></td><td>{item.lineItems?.map((line) => line.title).join(", ")}</td><td>{dateLabel(item.issueDate)}</td><td><strong>{money(item.total)}</strong></td><td><select className={`quotation-status ${item.status.toLowerCase()}`} value={item.status} onChange={(e) => changeStatus(item, e.target.value)}><option>Draft</option><option>Sent</option><option>Accepted</option><option>Declined</option><option>Expired</option></select></td><td><div className="quotation-row-actions"><button title="Select" onClick={() => { setSelected(item); setForm((current) => ({ ...current, senderEmail: item.senderEmail || current.senderEmail, cc: (item.cc || []).join(", "), customMessage: item.customMessage || "" })); }}><CheckCircle2 size={16} /></button><button title="Download PDF" onClick={() => download(item)}><Download size={16} /></button><button title="Edit" onClick={() => edit(item)}><Pencil size={16} /></button>{canDelete && <button title="Delete" onClick={() => remove(item)}><Trash2 size={16} /></button>}</div></td></tr>)}
          {!quotations.length && <tr><td colSpan="7">No course quotations found.</td></tr>}
        </tbody></table></div>
      </section>
    </>
  );
}
