import { useEffect, useMemo, useState } from "react";
import { Bell, Building2, CalendarClock, CheckCircle2, ClipboardList, FileCheck2, Filter, LayoutDashboard, Mail, MessageSquareText, Plus, Search, Send, Settings, Target, UserCheck, UsersRound } from "lucide-react";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import StatusMessage from "../../components/StatusMessage.jsx";
import SubmitButton from "../../components/SubmitButton.jsx";

const emptyProspect = {
  businessName: "", businessCategory: "", contactPerson: "", contactJobTitle: "", telephone: "",
  secondaryPhone: "", email: "", secondaryEmail: "", websiteUrl: "", townCity: "", postcode: "",
  fullAddress: "", region: "", decisionMakerName: "", decisionMakerPosition: "", existingSupplier: "",
  websiteCondition: "", budgetIndication: "", expectedTimeline: "", preferredContactMethod: "Email",
  initialResponse: "", status: "New Prospect", interestedServices: [], notes: "",
  followUpRequired: false, followUpAt: "", followUpPriority: "Normal", followUpNotes: ""
};

const modeConfig = {
  dashboard: ["CRM Dashboard", "Your website-service prospect pipeline at a glance.", LayoutDashboard],
  add: ["Add Prospect", "Record an actionable response from your external outreach.", Plus],
  prospects: ["My Prospects", "Search, review and progress actionable website-service prospects.", UsersRound],
  emails: ["Email Requests", "Send approved information and track every message against its prospect.", Mail],
  followups: ["Follow-Ups", "Stay ahead of due, overdue and completed prospect actions.", CalendarClock],
  qualified: ["Qualified Leads", "Review high-intent opportunities ready for the Innovex sales team.", Target],
  meetings: ["Meeting Requests", "Coordinate prospect meeting requests and internal ownership.", UserCheck],
  templates: ["Email Templates", "Use approved, consistent Innovex website-service messaging.", MessageSquareText],
  reports: ["CRM Reports", "Measure prospect quality and conversion by agent.", ClipboardList],
  settings: ["CRM Settings", "Manage the business categories available to agents.", Settings]
};

function dateTime(value) {
  return value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "-";
}

function asDateTimeLocal(value) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function statusTone(status = "") {
  if (["Won", "Accepted by Innovex", "Qualified", "Meeting Booked"].includes(status)) return "success";
  if (["Lost", "Rejected by Innovex", "Not Interested", "Do Not Contact"].includes(status)) return "danger";
  if (["Interested", "Email Requested", "Proposal Required", "Proposal Sent"].includes(status)) return "gold";
  return "blue";
}

function PageHero({ mode, notifications = 0 }) {
  const [title, description, Icon] = modeConfig[mode] || modeConfig.dashboard;
  return (
    <section className="webcrm-hero">
      <div className="webcrm-hero-icon"><Icon size={28} /></div>
      <div><span className="eyebrow">Web Leads CRM</span><h1>{title}</h1><p>{description}</p></div>
      <div className="webcrm-live"><Bell size={18} /><strong>{notifications}</strong><span>unread alerts</span></div>
    </section>
  );
}

function ProspectForm({ meta, initial = emptyProspect, onSaved, compact = false }) {
  const [form, setForm] = useState({ ...emptyProspect, ...initial, interestedServices: initial.interestedServices || [] });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);

  useEffect(() => setForm({ ...emptyProspect, ...initial, interestedServices: initial.interestedServices || [] }), [initial?._id]);

  function toggleService(service) {
    setForm((current) => ({ ...current, interestedServices: current.interestedServices.includes(service) ? current.interestedServices.filter((item) => item !== service) : [...current.interestedServices, service] }));
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      if (!initial?._id) {
        const duplicate = await api("/web-leads/duplicates", { method: "POST", body: form });
        if (duplicate.duplicate && !window.confirm(`Possible duplicate found: ${duplicate.items.map((item) => item.businessName).join(", ")}. Save this prospect anyway?`)) return;
      }
      const saved = await api(initial?._id ? `/web-leads/prospects/${initial._id}` : "/web-leads/prospects", { method: initial?._id ? "PUT" : "POST", body: form });
      setStatus({ message: initial?._id ? "Prospect updated." : "Prospect added to Web Leads CRM." });
      if (!initial?._id) setForm(emptyProspect);
      onSaved?.(saved);
    } catch (error) { setStatus({ type: "error", message: error.message }); }
    finally { setSaving(false); }
  }

  return (
    <form className={`card form webcrm-prospect-form${compact ? " compact" : ""}`} onSubmit={save}>
      <div className="webcrm-section-title"><Building2 size={20} /><div><h2>{initial?._id ? "Edit prospect" : "Prospect details"}</h2><p>Only actionable business responses should be recorded.</p></div></div>
      <StatusMessage status={status} />
      <div className="form-grid">
        <label><span>Business name *</span><input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} required /></label>
        <label><span>Business category *</span><select value={form.businessCategory} onChange={(e) => setForm({ ...form, businessCategory: e.target.value })} required><option value="">Select category</option>{(meta.categories || []).filter((item) => item.isActive !== false).map((item) => <option key={item._id || item.name}>{item.name}</option>)}</select></label>
        <label><span>Contact person *</span><input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} required /></label>
        <label><span>Job title *</span><input value={form.contactJobTitle} onChange={(e) => setForm({ ...form, contactJobTitle: e.target.value })} required /></label>
        <label><span>Telephone *</span><input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} required /></label>
        <label><span>Secondary phone</span><input value={form.secondaryPhone} onChange={(e) => setForm({ ...form, secondaryPhone: e.target.value })} /></label>
        <label><span>Email *</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
        <label><span>Secondary email</span><input type="email" value={form.secondaryEmail} onChange={(e) => setForm({ ...form, secondaryEmail: e.target.value })} /></label>
        <label><span>Website URL *</span><input value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} required /></label>
        <label><span>Town or city *</span><input value={form.townCity} onChange={(e) => setForm({ ...form, townCity: e.target.value })} required /></label>
        <label><span>Postcode *</span><input value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} required /></label>
        <label><span>Region</span><input value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })} /></label>
        <label><span>Decision maker</span><input value={form.decisionMakerName} onChange={(e) => setForm({ ...form, decisionMakerName: e.target.value })} /></label>
        <label><span>Decision-maker position</span><input value={form.decisionMakerPosition} onChange={(e) => setForm({ ...form, decisionMakerPosition: e.target.value })} /></label>
        <label><span>Current supplier</span><input value={form.existingSupplier} onChange={(e) => setForm({ ...form, existingSupplier: e.target.value })} /></label>
        <label><span>Website condition</span><input value={form.websiteCondition} onChange={(e) => setForm({ ...form, websiteCondition: e.target.value })} /></label>
        <label><span>Budget indication</span><input value={form.budgetIndication} onChange={(e) => setForm({ ...form, budgetIndication: e.target.value })} /></label>
        <label><span>Expected timeline</span><input value={form.expectedTimeline} onChange={(e) => setForm({ ...form, expectedTimeline: e.target.value })} /></label>
        <label><span>Preferred contact</span><select value={form.preferredContactMethod} onChange={(e) => setForm({ ...form, preferredContactMethod: e.target.value })}>{["Email", "Telephone", "WhatsApp", "Other"].map((item) => <option key={item}>{item}</option>)}</select></label>
        <label><span>Current status *</span><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{(meta.statuses || []).map((item) => <option key={item}>{item}</option>)}</select></label>
      </div>
      <label><span>Full address</span><input value={form.fullAddress} onChange={(e) => setForm({ ...form, fullAddress: e.target.value })} /></label>
      <div className="webcrm-service-picker"><strong>Interested services *</strong><div>{(meta.services || []).map((service) => <label className={form.interestedServices.includes(service) ? "selected" : ""} key={service}><input type="checkbox" checked={form.interestedServices.includes(service)} onChange={() => toggleService(service)} />{service}</label>)}</div></div>
      <div className="webcrm-initial-followup"><label><input type="checkbox" checked={form.followUpRequired} onChange={(e) => setForm({ ...form, followUpRequired: e.target.checked })} /> Follow-up required</label>{form.followUpRequired && <div className="form-grid"><label><span>Follow-up date and time *</span><input type="datetime-local" value={form.followUpAt} onChange={(e) => setForm({ ...form, followUpAt: e.target.value })} required /></label><label><span>Priority</span><select value={form.followUpPriority} onChange={(e) => setForm({ ...form, followUpPriority: e.target.value })}>{["Low", "Normal", "High", "Urgent"].map((item) => <option key={item}>{item}</option>)}</select></label></div>}</div>
      <label><span>Initial response *</span><textarea value={form.initialResponse} onChange={(e) => setForm({ ...form, initialResponse: e.target.value })} required /></label>
      <label><span>Notes *</span><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} required /></label>
      <div className="webcrm-form-actions"><SubmitButton loading={saving} loadingText="Saving prospect...">{initial?._id ? "Save Changes" : "Add Prospect"}</SubmitButton></div>
    </form>
  );
}

function DashboardView({ data, manager }) {
  const stats = data.stats || {};
  const cards = manager
    ? [["Total prospects", stats.total], ["Email requests", stats.emailRequests], ["Emails sent", stats.emailsSent], ["Follow-ups due", stats.dueToday], ["Overdue", stats.overdue], ["Interested", stats.interested], ["Qualified", stats.qualified], ["Accepted", stats.accepted], ["Rejected", stats.rejected], ["Meetings requested", stats.meetings], ["Meetings booked", stats.meetingsBooked], ["Won", stats.won]]
    : [["Prospects submitted", stats.total], ["Email requests", stats.emailRequests], ["Emails sent", stats.emailsSent], ["Due today", stats.dueToday], ["Overdue follow-ups", stats.overdue], ["Interested", stats.interested], ["Qualified submitted", stats.qualified], ["Qualified accepted", stats.accepted], ["Meeting requests", stats.meetings], ["Meetings booked", stats.meetingsBooked]];
  return <><div className="webcrm-kpi-grid">{cards.map(([label, value]) => <article key={label}><span>{label}</span><strong>{Number(value || 0).toLocaleString()}</strong></article>)}</div><section className="card webcrm-recent"><div className="webcrm-section-title"><ClipboardList size={20} /><div><h2>Recent prospect activity</h2><p>Most recently updated actionable records.</p></div></div><ProspectTable items={data.recent || []} compact /></section></>;
}

function ProspectTable({ items, onSelect, compact = false }) {
  return <div className="table-wrap webcrm-table"><table><thead><tr><th>Business</th><th>Contact</th><th>Category</th><th>Services</th><th>Status</th><th>Agent</th><th>Updated</th>{!compact && <th>Action</th>}</tr></thead><tbody>{items.map((item) => <tr key={item._id}><td><strong>{item.businessName}</strong><br /><span className="muted">{item.postcode || item.townCity || "-"}</span></td><td>{item.contactPerson || "-"}<br /><span className="muted">{item.email || item.telephone || "-"}</span></td><td>{item.businessCategory || "-"}</td><td>{(item.interestedServices || []).slice(0, 2).join(", ") || "-"}</td><td><span className={`webcrm-status ${statusTone(item.status)}`}>{item.status}</span></td><td>{item.createdByName || "-"}</td><td>{dateTime(item.updatedAt)}</td>{!compact && <td><button className="button small" onClick={() => onSelect(item._id)}>Open</button></td>}</tr>)}{!items.length && <tr><td colSpan={compact ? 7 : 8}>No prospects found for this view.</td></tr>}</tbody></table></div>;
}

function ProspectDetail({ prospect, meta, onRefresh }) {
  const [status, setStatus] = useState(null);
  const [interaction, setInteraction] = useState({ interactionAt: asDateTimeLocal(new Date()), contactMethod: "Telephone", personSpokenTo: "", prospectResponse: "", servicesDiscussed: [], interestLevel: "Medium", followUpRequired: false, followUpAt: "", notes: "" });
  const [followUp, setFollowUp] = useState({ dueAt: "", contactMethod: "Telephone", priority: "Normal", notes: "" });
  const [email, setEmail] = useState({ fromEmail: meta.senders?.[0]?.address || "", recipient: prospect.email || "", cc: "", templateId: "", subject: "", message: "", saveAsDraft: false });
  const [meeting, setMeeting] = useState({ preferredAt: "", meetingType: "Google Meet", prospectEmail: prospect.email || "", prospectPhone: prospect.telephone || "", notes: "" });
  const [qualification, setQualification] = useState({ decisionMakerName: prospect.decisionMakerName || "", decisionMakerRole: prospect.decisionMakerPosition || "", directPhone: prospect.telephone || "", email: prospect.email || "", websiteUrl: prospect.websiteUrl || "", mainBusinessProblem: "", requiredServices: prospect.interestedServices || [], websiteCondition: prospect.websiteCondition || "", budgetIndication: prospect.budgetIndication || "", expectedTimeline: prospect.expectedTimeline || "", preferredMeetingAt: "", preferredContactMethod: prospect.preferredContactMethod || "Email", detailedNotes: "" });
  const [managerNote, setManagerNote] = useState("");
  const [assignee, setAssignee] = useState(prospect.assignedTo || "");
  const [duplicates, setDuplicates] = useState([]);

  useEffect(() => {
    if (!meta.manager) return;
    api(`/web-leads/prospects/${prospect._id}/duplicates`).then(setDuplicates).catch(() => setDuplicates([]));
  }, [meta.manager, prospect._id]);

  async function action(path, body, success) {
    try { await api(`/web-leads/prospects/${prospect._id}${path}`, { method: path.includes("follow-ups/") || path.includes("meetings/") ? "PATCH" : "POST", body }); setStatus({ message: success }); await onRefresh(); }
    catch (error) { setStatus({ type: "error", message: error.message }); }
  }

  function chooseTemplate(id) {
    const template = meta.templates?.find((item) => item._id === id);
    setEmail({ ...email, templateId: id, subject: template?.subject || "", message: String(template?.body || "").replace(/{{businessName}}/g, prospect.businessName).replace(/{{contactName}}/g, prospect.contactPerson || "there") });
  }

  async function mergeDuplicate(duplicate) {
    if (!window.confirm(`Merge ${duplicate.businessName} into ${prospect.businessName}? The duplicate record will be removed after its history is preserved.`)) return;
    try {
      await api(`/web-leads/prospects/${prospect._id}/merge`, { method: "POST", body: { duplicateId: duplicate._id } });
      setStatus({ message: "Duplicate prospect merged successfully." });
      setDuplicates((current) => current.filter((item) => item._id !== duplicate._id));
      await onRefresh();
    } catch (error) { setStatus({ type: "error", message: error.message }); }
  }

  return <section className="webcrm-detail">
    <div className="webcrm-detail-head"><div><span className="eyebrow">Prospect workspace</span><h2>{prospect.businessName}</h2><p>{prospect.contactPerson} · {prospect.telephone} · {prospect.email || "No email"}</p></div><span className={`webcrm-status ${statusTone(prospect.status)}`}>{prospect.status}</span></div>
    <StatusMessage status={status} />
    <div className="webcrm-detail-grid">
      <article className="card"><h3>Interaction note</h3><div className="form-grid"><input type="datetime-local" value={interaction.interactionAt} onChange={(e) => setInteraction({ ...interaction, interactionAt: e.target.value })} /><select value={interaction.contactMethod} onChange={(e) => setInteraction({ ...interaction, contactMethod: e.target.value })}>{["Telephone", "Email", "WhatsApp", "Other"].map((item) => <option key={item}>{item}</option>)}</select><input placeholder="Person spoken to" value={interaction.personSpokenTo} onChange={(e) => setInteraction({ ...interaction, personSpokenTo: e.target.value })} /><select value={interaction.interestLevel} onChange={(e) => setInteraction({ ...interaction, interestLevel: e.target.value })}>{["Low", "Medium", "High", "Qualified"].map((item) => <option key={item}>{item}</option>)}</select></div><div className="webcrm-service-picker"><strong>Services discussed</strong><div>{(meta.services || []).map((service) => <label className={interaction.servicesDiscussed.includes(service) ? "selected" : ""} key={service}><input type="checkbox" checked={interaction.servicesDiscussed.includes(service)} onChange={() => setInteraction((current) => ({ ...current, servicesDiscussed: current.servicesDiscussed.includes(service) ? current.servicesDiscussed.filter((item) => item !== service) : [...current.servicesDiscussed, service] }))} />{service}</label>)}</div></div><textarea placeholder="Prospect response" value={interaction.prospectResponse} onChange={(e) => setInteraction({ ...interaction, prospectResponse: e.target.value })} /><label className="webcrm-inline-check"><input type="checkbox" checked={interaction.followUpRequired} onChange={(e) => setInteraction({ ...interaction, followUpRequired: e.target.checked })} /> Follow-up required</label>{interaction.followUpRequired && <input type="datetime-local" value={interaction.followUpAt} onChange={(e) => setInteraction({ ...interaction, followUpAt: e.target.value })} />}<textarea placeholder="Notes" value={interaction.notes} onChange={(e) => setInteraction({ ...interaction, notes: e.target.value })} /><button className="button" onClick={() => action("/interactions", interaction, "Interaction saved.")}>Save interaction</button></article>
      <article className="card"><h3>Follow-up</h3><input type="datetime-local" value={followUp.dueAt} onChange={(e) => setFollowUp({ ...followUp, dueAt: e.target.value })} /><div className="form-grid"><select value={followUp.contactMethod} onChange={(e) => setFollowUp({ ...followUp, contactMethod: e.target.value })}>{["Telephone", "Email", "WhatsApp", "Other"].map((item) => <option key={item}>{item}</option>)}</select><select value={followUp.priority} onChange={(e) => setFollowUp({ ...followUp, priority: e.target.value })}>{["Low", "Normal", "High", "Urgent"].map((item) => <option key={item}>{item}</option>)}</select></div><textarea placeholder="Follow-up notes" value={followUp.notes} onChange={(e) => setFollowUp({ ...followUp, notes: e.target.value })} /><button className="button" onClick={() => action("/follow-ups", followUp, "Follow-up scheduled.")}>Schedule follow-up</button>{(prospect.followUps || []).map((item) => <div className="webcrm-action-row" key={item._id}><span>{dateTime(item.dueAt)} · {item.priority}</span><button className="button small secondary" onClick={() => action(`/follow-ups/${item._id}`, { completed: !item.completed }, item.completed ? "Follow-up reopened." : "Follow-up completed.")}>{item.completed ? "Reopen" : "Complete"}</button></div>)}</article>
      <article className="card webcrm-email-card"><h3>Approved email</h3><div className="form-grid"><select value={email.fromEmail} onChange={(e) => setEmail({ ...email, fromEmail: e.target.value })}><option value="">Send from</option>{(meta.senders || []).map((item) => <option key={item.address} value={item.address}>{item.label} · {item.address}</option>)}</select><select value={email.templateId} onChange={(e) => chooseTemplate(e.target.value)}><option value="">Select approved template</option>{(meta.templates || []).filter((item) => item.isActive).map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select><input type="email" placeholder="Recipient" value={email.recipient} onChange={(e) => setEmail({ ...email, recipient: e.target.value })} /><input placeholder="CC" value={email.cc} onChange={(e) => setEmail({ ...email, cc: e.target.value })} /></div><input placeholder="Subject" value={email.subject} onChange={(e) => setEmail({ ...email, subject: e.target.value })} /><textarea value={email.message} onChange={(e) => setEmail({ ...email, message: e.target.value })} /><div className="actions"><button className="button" onClick={() => action("/emails", { ...email, cc: email.cc.split(/[;,]/).filter(Boolean), saveAsDraft: false }, "Email sent.")}><Send size={15} /> Send</button><button className="button secondary" onClick={() => action("/emails", { ...email, cc: email.cc.split(/[;,]/).filter(Boolean), saveAsDraft: true }, "Draft saved.")}>Save draft</button></div></article>
      <article className="card"><h3>Meeting request</h3><input type="datetime-local" value={meeting.preferredAt} onChange={(e) => setMeeting({ ...meeting, preferredAt: e.target.value })} /><select value={meeting.meetingType} onChange={(e) => setMeeting({ ...meeting, meetingType: e.target.value })}>{["Telephone", "Google Meet", "Microsoft Teams", "In person"].map((item) => <option key={item}>{item}</option>)}</select><div className="form-grid"><input type="email" value={meeting.prospectEmail} onChange={(e) => setMeeting({ ...meeting, prospectEmail: e.target.value })} /><input value={meeting.prospectPhone} onChange={(e) => setMeeting({ ...meeting, prospectPhone: e.target.value })} /></div><textarea placeholder="Meeting notes" value={meeting.notes} onChange={(e) => setMeeting({ ...meeting, notes: e.target.value })} /><button className="button" onClick={() => action("/meetings", meeting, "Meeting request submitted.")}>Request meeting</button></article>
    </div>
    {!prospect.qualification?.locked && <article className="card webcrm-qualification"><div className="webcrm-section-title"><FileCheck2 size={20} /><div><h3>Submit qualified lead</h3><p>Complete every field before handing this opportunity to Innovex.</p></div></div><div className="form-grid">{[["Decision maker", "decisionMakerName"], ["Decision-maker role", "decisionMakerRole"], ["Direct phone", "directPhone"], ["Email", "email"], ["Website URL", "websiteUrl"], ["Website condition", "websiteCondition"], ["Budget indication", "budgetIndication"], ["Expected timeline", "expectedTimeline"]].map(([placeholder, key]) => <input key={key} placeholder={placeholder} value={qualification[key]} onChange={(e) => setQualification({ ...qualification, [key]: e.target.value })} />)}<input type="datetime-local" value={qualification.preferredMeetingAt} onChange={(e) => setQualification({ ...qualification, preferredMeetingAt: e.target.value })} /><input placeholder="Preferred contact method" value={qualification.preferredContactMethod} onChange={(e) => setQualification({ ...qualification, preferredContactMethod: e.target.value })} /></div><div className="webcrm-service-picker"><strong>Required services *</strong><div>{(meta.services || []).map((service) => <label className={qualification.requiredServices.includes(service) ? "selected" : ""} key={service}><input type="checkbox" checked={qualification.requiredServices.includes(service)} onChange={() => setQualification((current) => ({ ...current, requiredServices: current.requiredServices.includes(service) ? current.requiredServices.filter((item) => item !== service) : [...current.requiredServices, service] }))} />{service}</label>)}</div></div><textarea placeholder="Main business problem" value={qualification.mainBusinessProblem} onChange={(e) => setQualification({ ...qualification, mainBusinessProblem: e.target.value })} /><textarea placeholder="Detailed qualification notes" value={qualification.detailedNotes} onChange={(e) => setQualification({ ...qualification, detailedNotes: e.target.value })} /><button className="button" onClick={() => action("/qualify", qualification, "Qualified lead submitted for review.")}>Submit for review</button></article>}
    {meta.manager && duplicates.length > 0 && <article className="card webcrm-manager-review"><h3>Possible duplicate records</h3><p className="muted">Review carefully before combining records. All prospect history will be retained.</p>{duplicates.map((item) => <div className="webcrm-action-row" key={item._id}><span><strong>{item.businessName}</strong><br />{item.contactPerson || "No contact"} · {item.postcode || "No postcode"} · {item.createdByName}</span><button className="button small secondary" onClick={() => mergeDuplicate(item)}>Merge record</button></div>)}</article>}
    {meta.manager && <article className="card webcrm-manager-review"><h3>Manager review</h3><select value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">Assign internal representative</option>{(meta.internalStaff || []).map((item) => <option key={item._id} value={item._id}>{item.name} · {item.role}</option>)}</select><textarea placeholder="Manager note or information request" value={managerNote} onChange={(e) => setManagerNote(e.target.value)} /><div className="actions"><button className="button" onClick={() => action("/review", { action: "accept", note: managerNote, assignedTo: assignee || undefined }, "Lead accepted.")}>Accept</button><button className="button secondary" onClick={() => action("/review", { action: "more_info", note: managerNote, assignedTo: assignee || undefined }, "More information requested.")}>Request information</button><button className="button secondary" onClick={() => action("/review", { action: "reopen", note: managerNote, assignedTo: assignee || undefined }, "Lead reopened.")}>Reopen</button><button className="button danger" onClick={() => action("/review", { action: "reject", note: managerNote }, "Lead rejected.")}>Reject</button><button className="button secondary" onClick={() => action("/internal-notes", { note: managerNote }, "Private note added.")}>Add private note</button></div></article>}
    {meta.manager && (prospect.meetingRequests || []).length > 0 && <article className="card webcrm-manager-review"><h3>Meeting approvals</h3><p className="muted">Select an internal representative above before approving or confirming a meeting.</p>{prospect.meetingRequests.map((item) => <div className="webcrm-action-row" key={item._id}><span><strong>{item.meetingType}</strong><br />{dateTime(item.preferredAt)} · {item.status}</span><div className="actions"><button className="button small" onClick={() => action(`/meetings/${item._id}`, { status: "Confirmed", assignedTo: assignee || undefined }, "Meeting confirmed.")}>Confirm</button><button className="button small secondary" onClick={() => action(`/meetings/${item._id}`, { status: "Approved", assignedTo: assignee || undefined }, "Meeting approved.")}>Approve</button><button className="button small danger" onClick={() => action(`/meetings/${item._id}`, { status: "Rejected" }, "Meeting rejected.")}>Reject</button></div></div>)}</article>}
    <article className="card webcrm-timeline"><h3>Activity timeline</h3>{[...(prospect.timeline || [])].reverse().map((item) => <div key={item._id}><span className="webcrm-timeline-dot" /><section><strong>{item.type}</strong><p>{item.details}</p><small>{item.actor?.name || "System"} · {item.actor?.role || ""} · {dateTime(item.createdAt)}</small></section></div>)}{!prospect.timeline?.length && <p>No activity yet.</p>}</article>
  </section>;
}

function TemplatesView({ meta, reload }) {
  const [form, setForm] = useState({ name: "", type: "Initial company introduction", subject: "", body: "Hi {{contactName}},\n\n", isActive: true });
  const [editing, setEditing] = useState(null);
  async function save(e) { e.preventDefault(); await api(editing ? `/web-leads/templates/${editing}` : "/web-leads/templates", { method: editing ? "PUT" : "POST", body: form }); setForm({ name: "", type: "Initial company introduction", subject: "", body: "Hi {{contactName}},\n\n", isActive: true }); setEditing(null); reload(); }
  return <div className="webcrm-template-layout">{meta.manager && <form className="card form" onSubmit={save}><h2>{editing ? "Edit template" : "Create approved template"}</h2><input placeholder="Template name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /><input placeholder="Template type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required /><input placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required /><textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required /><label><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active and approved</label><button className="button">Save template</button></form>}<section className="webcrm-template-grid">{(meta.templates || []).map((item) => <article className="card" key={item._id}><span className={`webcrm-status ${item.isActive ? "success" : "danger"}`}>{item.isActive ? "Approved" : "Inactive"}</span><h3>{item.name}</h3><p>{item.subject}</p><small>{item.type}</small>{meta.manager && <button className="button small" onClick={() => { setEditing(item._id); setForm(item); }}>Edit</button>}</article>)}</section></div>;
}

function ReportsView({ rows, meta, onFilter }) {
  const [filters, setFilters] = useState({ from: "", to: "", agent: "", category: "", service: "", status: "" });
  return <section className="card"><div className="webcrm-section-title"><Target size={20} /><div><h2>Agent performance</h2><p>Conversion is calculated from accepted leads against submitted prospects.</p></div></div><form className="webcrm-report-filters" onSubmit={(e) => { e.preventDefault(); onFilter(filters); }}><input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /><input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />{meta.manager && <select value={filters.agent} onChange={(e) => setFilters({ ...filters, agent: e.target.value })}><option value="">All agents</option>{meta.agents.map((item) => <option value={item._id} key={item._id}>{item.name}</option>)}</select>}<select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option>{meta.categories.map((item) => <option key={item._id || item.name}>{item.name}</option>)}</select><select value={filters.service} onChange={(e) => setFilters({ ...filters, service: e.target.value })}><option value="">All services</option>{meta.services.map((item) => <option key={item}>{item}</option>)}</select><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option>{meta.statuses.map((item) => <option key={item}>{item}</option>)}</select><button className="button">Run report</button></form><div className="table-wrap webcrm-table"><table><thead><tr><th>Agent</th><th>Prospects</th><th>Emails</th><th>Follow-ups</th><th>Completed</th><th>Overdue</th><th>Interested</th><th>Qualified</th><th>Accepted</th><th>Rejected</th><th>Meetings</th><th>Booked</th><th>Won</th><th>Conversion</th></tr></thead><tbody>{rows.map((row) => <tr key={row._id?.user}><td><strong>{row._id?.name}</strong></td><td>{row.prospects}</td><td>{row.emailsSent}</td><td>{row.followUps}</td><td>{row.followUpsCompleted}</td><td>{row.followUpsOverdue}</td><td>{row.interested}</td><td>{row.qualified}</td><td>{row.accepted}</td><td>{row.rejected}</td><td>{row.meetings}</td><td>{row.meetingsBooked}</td><td>{row.won}</td><td>{row.conversionRate}%</td></tr>)}</tbody></table></div></section>;
}

function SettingsView({ categories, reload }) {
  const [name, setName] = useState("");
  async function add(e) { e.preventDefault(); await api("/web-leads/categories", { method: "POST", body: { name, isActive: true } }); setName(""); reload(); }
  async function rename(item) { const nextName = window.prompt("Update business category", item.name)?.trim(); if (!nextName || nextName === item.name) return; await api(`/web-leads/categories/${item._id}`, { method: "PATCH", body: { name: nextName } }); reload(); }
  return <section className="card webcrm-settings"><h2>Business categories</h2><form onSubmit={add}><input placeholder="New business category" value={name} onChange={(e) => setName(e.target.value)} required /><button className="button">Add category</button></form><div>{categories.map((item) => <article key={item._id || item.name}><strong>{item.name}</strong><span className={`webcrm-status ${item.isActive !== false ? "success" : "danger"}`}>{item.isActive !== false ? "Active" : "Inactive"}</span>{item._id && <div className="actions"><button className="button small secondary" onClick={() => rename(item)}>Edit</button><button className="button small secondary" onClick={async () => { await api(`/web-leads/categories/${item._id}`, { method: "PATCH", body: { isActive: item.isActive === false } }); reload(); }}>Toggle</button></div>}</article>)}</div></section>;
}

export default function AdminWebLeads({ mode = "dashboard" }) {
  const { user } = useAuth();
  const [meta, setMeta] = useState({ categories: [], services: [], statuses: [], templates: [], agents: [], senders: [] });
  const [data, setData] = useState({ stats: {}, recent: [] });
  const [prospects, setProspects] = useState([]);
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState({ search: "", status: "", category: "", service: "", agent: "" });
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [notifications, setNotifications] = useState([]);
  const [followUpView, setFollowUpView] = useState("Due today");
  const [dashboardFilters, setDashboardFilters] = useState({ period: "This month", from: "", to: "", agent: "", category: "", status: "", service: "" });
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);

  const listMode = ["prospects", "emails", "followups", "qualified", "meetings"].includes(mode);

  async function loadMeta() { const result = await api("/web-leads/meta"); setMeta(result); return result; }
  async function loadList(page = 1, activeFilters = filters) {
    const query = new URLSearchParams({ page, limit: 20, ...Object.fromEntries(Object.entries(activeFilters).filter(([, value]) => value)) });
    if (mode === "emails") query.set("emailRequested", "true");
    if (mode === "qualified") query.set("qualified", "true");
    if (mode === "meetings") query.set("meetingRequested", "true");
    const result = await api(`/web-leads/prospects?${query}`);
    setProspects(result.items || []); setPagination(result);
  }
  async function loadDashboard(active = dashboardFilters) {
    const now = new Date();
    let from = active.from, to = active.to;
    if (active.period === "Today") from = to = now.toISOString().slice(0, 10);
    if (active.period === "This week") { const start = new Date(now); start.setDate(now.getDate() - ((now.getDay() + 6) % 7)); from = start.toISOString().slice(0, 10); to = now.toISOString().slice(0, 10); }
    if (active.period === "This month") { from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10); to = now.toISOString().slice(0, 10); }
    const query = new URLSearchParams({ ...Object.fromEntries(Object.entries({ ...active, from, to }).filter(([key, value]) => key !== "period" && value)) });
    setData(await api(`/web-leads/dashboard?${query}`));
  }
  async function loadReports(active = {}) { const query = new URLSearchParams(Object.fromEntries(Object.entries(active).filter(([, value]) => value))); setReports((await api(`/web-leads/reports?${query}`)).byAgent || []); }
  async function reload() {
    setLoading(true);
    try {
      const currentMeta = await loadMeta();
      const notices = await api("/web-leads/notifications"); setNotifications(notices || []);
      if (mode === "dashboard") await loadDashboard();
      if (listMode) await loadList(1);
      if (mode === "reports") await loadReports();
      if (mode === "templates") setMeta(currentMeta);
      if (mode === "settings") setMeta(currentMeta);
    } catch (error) { setStatus({ type: "error", message: error.message }); }
    finally { setLoading(false); }
  }
  useEffect(() => { setSelected(null); reload(); }, [mode]);

  async function openProspect(id) { try { setSelected(await api(`/web-leads/prospects/${id}`)); } catch (error) { setStatus({ type: "error", message: error.message }); } }
  async function refreshSelected() { if (selected?._id) await openProspect(selected._id); await loadList(pagination.page); }

  const filteredFollowUps = useMemo(() => {
    if (mode !== "followups") return [];
    const now = new Date(); const end = new Date(); end.setHours(23, 59, 59, 999);
    return prospects.flatMap((prospect) => (prospect.followUps || []).map((item) => ({ ...item, prospect }))).filter((item) => followUpView === "Completed" ? item.completed : !item.completed && (followUpView === "Overdue" ? new Date(item.dueAt) < now : followUpView === "Due today" ? new Date(item.dueAt) >= now && new Date(item.dueAt) <= end : new Date(item.dueAt) > end)).sort((a, b) => new Date(a.dueAt) - new Date(b.dueAt));
  }, [mode, prospects, followUpView]);

  return <>
    <PageHero mode={mode} notifications={notifications.filter((item) => !item.read).length} />
    <StatusMessage status={status} />
    {!loading && notifications.some((item) => !item.read) && <section className="webcrm-notifications">{notifications.filter((item) => !item.read).slice(0, 4).map((item) => <article key={item._id}><Bell size={17} /><div><strong>{item.title}</strong><p>{item.message}</p></div><button onClick={async () => { await api(`/web-leads/notifications/${item._id}/read`, { method: "PATCH" }); setNotifications((current) => current.map((notice) => notice._id === item._id ? { ...notice, read: true } : notice)); }}>Mark read</button></article>)}</section>}
    {!loading && mode === "dashboard" && meta.manager && <form className="card webcrm-dashboard-filters" onSubmit={(e) => { e.preventDefault(); loadDashboard(dashboardFilters); }}><select value={dashboardFilters.period} onChange={(e) => setDashboardFilters({ ...dashboardFilters, period: e.target.value })}>{["Today", "This week", "This month", "Custom"].map((item) => <option key={item}>{item}</option>)}</select>{dashboardFilters.period === "Custom" && <><input type="date" value={dashboardFilters.from} onChange={(e) => setDashboardFilters({ ...dashboardFilters, from: e.target.value })} /><input type="date" value={dashboardFilters.to} onChange={(e) => setDashboardFilters({ ...dashboardFilters, to: e.target.value })} /></>}<select value={dashboardFilters.agent} onChange={(e) => setDashboardFilters({ ...dashboardFilters, agent: e.target.value })}><option value="">All agents</option>{meta.agents.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select><select value={dashboardFilters.category} onChange={(e) => setDashboardFilters({ ...dashboardFilters, category: e.target.value })}><option value="">All categories</option>{meta.categories.map((item) => <option key={item._id || item.name}>{item.name}</option>)}</select><select value={dashboardFilters.status} onChange={(e) => setDashboardFilters({ ...dashboardFilters, status: e.target.value })}><option value="">All statuses</option>{meta.statuses.map((item) => <option key={item}>{item}</option>)}</select><select value={dashboardFilters.service} onChange={(e) => setDashboardFilters({ ...dashboardFilters, service: e.target.value })}><option value="">All services</option>{meta.services.map((item) => <option key={item}>{item}</option>)}</select><button className="button">Apply</button></form>}
    {loading && <section className="card webcrm-loading">Loading secure Web Leads CRM...</section>}
    {!loading && mode === "dashboard" && <DashboardView data={data} manager={meta.manager} />}
    {!loading && mode === "add" && <ProspectForm meta={meta} onSaved={(item) => setStatus({ message: `${item.businessName} was added successfully.` })} />}
    {!loading && listMode && <>
      <section className="card webcrm-filter-bar"><div className="webcrm-section-title"><Filter size={19} /><div><h2>Search and filter</h2><p>{meta.manager ? "Manager view includes all external agents." : "Only prospects submitted by your account are searchable."}</p></div></div><form onSubmit={(e) => { e.preventDefault(); loadList(1); }}><div className="input-with-icon"><Search size={17} /><input placeholder="Business, contact, phone, email, website or postcode" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></div><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option>{meta.statuses.map((item) => <option key={item}>{item}</option>)}</select><select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option>{meta.categories.map((item) => <option key={item._id || item.name}>{item.name}</option>)}</select><select value={filters.service} onChange={(e) => setFilters({ ...filters, service: e.target.value })}><option value="">All services</option>{meta.services.map((item) => <option key={item}>{item}</option>)}</select>{meta.manager && <select value={filters.agent} onChange={(e) => setFilters({ ...filters, agent: e.target.value })}><option value="">All agents</option>{meta.agents.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select>}<button className="button">Apply filters</button></form></section>
      {mode === "followups" ? <section className="card"><div className="webcrm-followup-head"><h2>Follow-up schedule</h2><div>{["Due today", "Upcoming", "Overdue", "Completed"].map((item) => <button className={followUpView === item ? "active" : ""} key={item} onClick={() => setFollowUpView(item)}>{item}</button>)}</div></div><div className="webcrm-followup-list">{filteredFollowUps.map((item) => <button key={item._id} onClick={() => openProspect(item.prospect._id)}><span className={`webcrm-priority ${item.priority.toLowerCase()}`}>{item.priority}</span><strong>{item.prospect.businessName}</strong><span>{dateTime(item.dueAt)}</span><small>{item.completed ? "Completed" : new Date(item.dueAt) < new Date() ? "Overdue" : "Upcoming"}</small></button>)}{!filteredFollowUps.length && <p>No follow-ups found.</p>}</div></section> : <ProspectTable items={prospects} onSelect={openProspect} />}
      <div className="talent-pagination"><button className="button secondary" disabled={pagination.page <= 1} onClick={() => loadList(pagination.page - 1)}>Previous</button><span>Page {pagination.page} of {pagination.pages} · {Number(pagination.total || 0).toLocaleString()} prospects</span><button className="button secondary" disabled={pagination.page >= pagination.pages} onClick={() => loadList(pagination.page + 1)}>Next</button></div>
      {selected && <ProspectDetail prospect={selected} meta={meta} onRefresh={refreshSelected} />}
    </>}
    {!loading && mode === "templates" && <TemplatesView meta={meta} reload={reload} />}
    {!loading && mode === "reports" && <ReportsView rows={reports} meta={meta} onFilter={loadReports} user={user} />}
    {!loading && mode === "settings" && <SettingsView categories={meta.categories} reload={reload} />}
  </>;
}
