import { useEffect, useState } from "react";
import { Bell, Building2, CalendarClock, ChevronDown, CircleHelp, ClipboardList, FileCheck2, Filter, LayoutDashboard, Mail, MessageSquareText, Plus, Search, Send, Settings, Target, UserCheck, UsersRound } from "lucide-react";
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

const modeGuides = {
  dashboard: {
    purpose: "Use this as your daily starting point. It shows workload, pipeline movement and the latest prospect activity.",
    steps: ["Check unread alerts and overdue follow-ups.", "Review qualified leads and meeting requests.", "Use filters only when you need a specific agent or period."],
    avoid: "Do not treat every number as a task. Start with overdue work, then due work, then new opportunities."
  },
  add: {
    purpose: "Create one clean prospect record after a real business response or useful conversation.",
    steps: ["Complete the essential company and contact fields.", "Open optional context only when that information is available.", "Record the response, services discussed and the next follow-up."],
    avoid: "Search for the business first and do not create duplicate records."
  },
  prospects: {
    purpose: "Find your assigned prospects and continue the next action from one workspace.",
    steps: ["Search by company, person, email, phone or postcode.", "Open a prospect and choose the relevant workspace tab.", "Save every interaction and schedule the next follow-up."],
    avoid: "Do not keep important call or email outcomes only in personal notes. Save them to the prospect timeline."
  },
  emails: {
    purpose: "Process prospects that need approved information or a formal email response.",
    steps: ["Open the prospect awaiting email action.", "Choose an approved template and correct sender account.", "Review the recipient, content and signature before sending."],
    avoid: "Never send an unapproved claim or overwrite the approved template meaning."
  },
  followups: {
    purpose: "Manage due, upcoming, overdue and completed prospect actions without missing commitments.",
    steps: ["Work through Overdue first, then Due today.", "Open the prospect to record the outcome.", "Complete or reschedule the follow-up immediately."],
    avoid: "Do not mark a follow-up complete until its outcome has been recorded."
  },
  qualified: {
    purpose: "Review opportunities that contain enough commercial information for an Innovex manager.",
    steps: ["Open the submitted qualification.", "Verify decision maker, need, budget and timing.", "Accept, request information, reopen or reject with a clear note."],
    avoid: "Do not accept a lead that has no clear need, contact route or next step."
  },
  meetings: {
    purpose: "Coordinate requested prospect meetings and assign the right Innovex representative.",
    steps: ["Open the meeting request and verify contact details.", "Assign an internal representative and confirm the time.", "Approve, confirm or reject while keeping notes current."],
    avoid: "Do not confirm a meeting before checking the assignee and date."
  },
  templates: {
    purpose: "Maintain consistent, approved email messaging for the whole outreach team.",
    steps: ["Use a clear template name and purpose.", "Keep placeholders such as {{contactName}} intact.", "Deactivate outdated messaging instead of reusing it."],
    avoid: "Do not include passwords, private notes or unsupported promises in templates."
  },
  reports: {
    purpose: "Compare activity and outcomes for coaching, quality control and pipeline decisions.",
    steps: ["Choose a useful date range.", "Narrow by agent, category, service or status when needed.", "Read conversion together with volume and overdue work."],
    avoid: "Do not judge performance from conversion percentage alone when sample sizes are small."
  },
  settings: {
    purpose: "Control the business categories agents can select when creating prospects.",
    steps: ["Add categories using consistent names.", "Edit spelling before the category is widely used.", "Deactivate categories that should no longer be selected."],
    avoid: "Do not create near-duplicate categories with different spelling."
  }
};

const emptyFilters = { search: "", status: "", category: "", service: "", agent: "", from: "", to: "" };

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

function qualificationFromProspect(prospect) {
  const saved = prospect.qualification || {};
  return {
    decisionMakerName: saved.decisionMakerName || prospect.decisionMakerName || "",
    decisionMakerRole: saved.decisionMakerRole || prospect.decisionMakerPosition || "",
    directPhone: saved.directPhone || prospect.telephone || "",
    email: saved.email || prospect.email || "",
    websiteUrl: saved.websiteUrl || prospect.websiteUrl || "",
    mainBusinessProblem: saved.mainBusinessProblem || "",
    requiredServices: saved.requiredServices?.length ? saved.requiredServices : prospect.interestedServices || [],
    websiteCondition: saved.websiteCondition || prospect.websiteCondition || "",
    budgetIndication: saved.budgetIndication || prospect.budgetIndication || "",
    expectedTimeline: saved.expectedTimeline || prospect.expectedTimeline || "",
    preferredMeetingAt: asDateTimeLocal(saved.preferredMeetingAt),
    preferredContactMethod: saved.preferredContactMethod || prospect.preferredContactMethod || "Email",
    detailedNotes: saved.detailedNotes || ""
  };
}

function HelpHint({ text }) {
  return <span className="webcrm-help-hint" tabIndex="0" aria-label={text}><CircleHelp size={16} /><span role="tooltip">{text}</span></span>;
}

function HelpPopover({ mode }) {
  const [open, setOpen] = useState(false);
  const guide = modeGuides[mode] || modeGuides.dashboard;
  return (
    <div className={`webcrm-help${open ? " is-open" : ""}`}>
      <button type="button" className="webcrm-help-button" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <CircleHelp size={18} /> How to use
      </button>
      <aside className="webcrm-help-popover" aria-hidden={!open}>
        <span className="eyebrow">Quick staff guide</span>
        <h3>How this section works</h3>
        <p>{guide.purpose}</p>
        <ol>{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol>
        <div className="webcrm-help-warning"><strong>Good practice</strong><span>{guide.avoid}</span></div>
      </aside>
    </div>
  );
}

function PageHero({ mode, notifications = 0 }) {
  const [title, description, Icon] = modeConfig[mode] || modeConfig.dashboard;
  return (
    <section className="webcrm-hero">
      <div className="webcrm-hero-icon"><Icon size={28} /></div>
      <div><span className="eyebrow">Web Leads CRM</span><h1>{title}</h1><p>{description}</p></div>
      <div className="webcrm-hero-tools"><HelpPopover mode={mode} /><div className="webcrm-live"><Bell size={18} /><strong>{notifications}</strong><span>unread alerts</span></div></div>
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
      <section className="webcrm-form-block">
        <div className="webcrm-block-heading"><div><span>Step 1</span><h3>Essential contact details</h3></div><HelpHint text="Enter the company and primary contact information needed for the next action. Fields marked with an asterisk are required." /></div>
        <div className="form-grid">
          <label><span>Business name *</span><input value={form.businessName} onChange={(e) => setForm({ ...form, businessName: e.target.value })} required /></label>
          <label><span>Business category *</span><select value={form.businessCategory} onChange={(e) => setForm({ ...form, businessCategory: e.target.value })} required><option value="">Select category</option>{(meta.categories || []).filter((item) => item.isActive !== false).map((item) => <option key={item._id || item.name}>{item.name}</option>)}</select></label>
          <label><span>Contact person *</span><input value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} required /></label>
          <label><span>Job title *</span><input value={form.contactJobTitle} onChange={(e) => setForm({ ...form, contactJobTitle: e.target.value })} required /></label>
          <label><span>Telephone *</span><input value={form.telephone} onChange={(e) => setForm({ ...form, telephone: e.target.value })} required /></label>
          <label><span>Email *</span><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
          <label><span>Website URL *</span><input value={form.websiteUrl} onChange={(e) => setForm({ ...form, websiteUrl: e.target.value })} required /></label>
          <label><span>Town or city *</span><input value={form.townCity} onChange={(e) => setForm({ ...form, townCity: e.target.value })} required /></label>
          <label><span>Postcode *</span><input value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} required /></label>
        </div>
      </section>
      <details className="webcrm-disclosure">
        <summary><span><strong>Optional business context</strong><small>Decision maker, address, supplier, budget and timing</small></span><ChevronDown size={19} /></summary>
        <div className="form-grid">
          <label><span>Secondary phone</span><input value={form.secondaryPhone} onChange={(e) => setForm({ ...form, secondaryPhone: e.target.value })} /></label>
          <label><span>Secondary email</span><input type="email" value={form.secondaryEmail} onChange={(e) => setForm({ ...form, secondaryEmail: e.target.value })} /></label>
          <label className="full"><span>Full address</span><input value={form.fullAddress} onChange={(e) => setForm({ ...form, fullAddress: e.target.value })} /></label>
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
      </details>
      <section className="webcrm-form-block">
        <div className="webcrm-block-heading"><div><span>Step 2</span><h3>Response and next action</h3></div><HelpHint text="Select what the prospect discussed, record their exact response, and schedule a follow-up when a next action was agreed." /></div>
        <div className="webcrm-service-picker"><strong>Interested services *</strong><div>{(meta.services || []).map((service) => <label className={form.interestedServices.includes(service) ? "selected" : ""} key={service}><input type="checkbox" checked={form.interestedServices.includes(service)} onChange={() => toggleService(service)} />{service}</label>)}</div></div>
        <div className="webcrm-initial-followup"><label><input type="checkbox" checked={form.followUpRequired} onChange={(e) => setForm({ ...form, followUpRequired: e.target.checked })} /> Follow-up required</label>{form.followUpRequired && <div className="form-grid"><label><span>Follow-up date and time *</span><input type="datetime-local" value={form.followUpAt} onChange={(e) => setForm({ ...form, followUpAt: e.target.value })} required /></label><label><span>Priority</span><select value={form.followUpPriority} onChange={(e) => setForm({ ...form, followUpPriority: e.target.value })}>{["Low", "Normal", "High", "Urgent"].map((item) => <option key={item}>{item}</option>)}</select></label></div>}</div>
        <label><span>Initial response *</span><textarea value={form.initialResponse} onChange={(e) => setForm({ ...form, initialResponse: e.target.value })} required /></label>
        <label><span>Notes *</span><textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} required /></label>
      </section>
      <div className="webcrm-form-actions"><SubmitButton loading={saving} loadingText="Saving prospect...">{initial?._id ? "Save Changes" : "Add Prospect"}</SubmitButton></div>
    </form>
  );
}

function DashboardView({ data, manager }) {
  const stats = data.stats || {};
  const primary = manager
    ? [["Total prospects", stats.total, "All records in the selected period"], ["Action due today", stats.dueToday, "Follow-ups requiring attention"], ["Overdue", stats.overdue, "Actions that have passed their due time"], ["Qualified", stats.qualified, "Leads submitted for manager review"]]
    : [["Prospects submitted", stats.total, "Records created by your account"], ["Action due today", stats.dueToday, "Follow-ups requiring attention"], ["Overdue", stats.overdue, "Complete these before new outreach"], ["Qualified submitted", stats.qualified, "Leads handed to Innovex for review"]];
  const secondary = manager
    ? [["Email requests", stats.emailRequests], ["Emails sent", stats.emailsSent], ["Interested", stats.interested], ["Accepted", stats.accepted], ["Rejected", stats.rejected], ["Meetings requested", stats.meetings], ["Meetings booked", stats.meetingsBooked], ["Won", stats.won]]
    : [["Email requests", stats.emailRequests], ["Emails sent", stats.emailsSent], ["Interested", stats.interested], ["Qualified accepted", stats.accepted], ["Meeting requests", stats.meetings], ["Meetings booked", stats.meetingsBooked]];
  return <>
    <section className="webcrm-dashboard-group">
      <div className="webcrm-group-heading"><div><span className="eyebrow">Priority view</span><h2>What needs attention</h2></div><HelpHint text="Work from left to right: overdue and due tasks first, then qualified opportunities and new activity." /></div>
      <div className="webcrm-kpi-grid primary">{primary.map(([label, value, detail]) => <article key={label}><span>{label}</span><strong>{Number(value || 0).toLocaleString()}</strong><small>{detail}</small></article>)}</div>
    </section>
    <details className="webcrm-metric-disclosure">
      <summary><span><strong>View supporting pipeline metrics</strong><small>Email, interest, meeting and outcome totals</small></span><ChevronDown size={19} /></summary>
      <div className="webcrm-kpi-strip">{secondary.map(([label, value]) => <article key={label}><span>{label}</span><strong>{Number(value || 0).toLocaleString()}</strong></article>)}</div>
    </details>
    {manager && <section className="card webcrm-agent-summary"><div className="webcrm-section-title"><UsersRound size={20} /><div><h2>Prospects by agent</h2><p>Current filtered performance snapshot for team coaching.</p></div><HelpHint text="Use this for workload balance and coaching. Prospect volume should always be read alongside quality and accepted outcomes." /></div><div className="webcrm-agent-summary-grid">{(data.byAgent || []).map((row) => <article key={row._id?.user}><strong>{row._id?.name || "Unknown agent"}</strong><span>{row.prospects} prospects</span><small>{row.interested} interested · {row.qualified} qualified · {row.accepted} accepted</small></article>)}{!data.byAgent?.length && <p className="muted">No agent activity in this period.</p>}</div></section>}
    <section className="card webcrm-recent"><div className="webcrm-section-title"><ClipboardList size={20} /><div><h2>Recent prospect activity</h2><p>Most recently updated actionable records.</p></div><HelpHint text="Open recent records when you need to verify the latest activity. Use My Prospects for full searching and workflow actions." /></div><ProspectTable items={data.recent || []} compact /></section>
  </>;
}

function ProspectTable({ items, onSelect, compact = false }) {
  return <div className="table-wrap webcrm-table"><table><thead><tr><th>Business</th><th>Contact</th><th>Category</th><th>Services</th><th>Status</th><th>Agent</th><th>Updated</th>{!compact && <th>Action</th>}</tr></thead><tbody>{items.map((item) => <tr key={item._id}><td><strong>{item.businessName}</strong><br /><span className="muted">{item.postcode || item.townCity || "-"}</span></td><td>{item.contactPerson || "-"}<br /><span className="muted">{item.email || item.telephone || "-"}</span></td><td>{item.businessCategory || "-"}</td><td>{(item.interestedServices || []).slice(0, 2).join(", ") || "-"}</td><td><span className={`webcrm-status ${statusTone(item.status)}`}>{item.status}</span></td><td>{item.createdByName || "-"}</td><td>{dateTime(item.updatedAt)}</td>{!compact && <td><button className="button small" onClick={() => onSelect(item._id)}>Open</button></td>}</tr>)}{!items.length && <tr><td colSpan={compact ? 7 : 8}>No prospects found for this view.</td></tr>}</tbody></table></div>;
}

function FollowUpRow({ item, onAction }) {
  const [dueAt, setDueAt] = useState(asDateTimeLocal(item.dueAt));
  return <div className="webcrm-action-row webcrm-followup-editor"><span><strong>{dateTime(item.dueAt)}</strong><br />{item.priority} · {item.contactMethod}</span><input aria-label="Reschedule follow-up" type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} /><div className="actions"><button className="button small secondary" onClick={() => onAction(`/follow-ups/${item._id}`, { dueAt }, "Follow-up rescheduled.")}>Reschedule</button><button className="button small secondary" onClick={() => onAction(`/follow-ups/${item._id}`, { completed: !item.completed }, item.completed ? "Follow-up reopened." : "Follow-up completed.")}>{item.completed ? "Reopen" : "Complete"}</button></div></div>;
}

function MeetingApprovalRow({ item, assignee, onAction }) {
  const [preferredAt, setPreferredAt] = useState(asDateTimeLocal(item.preferredAt));
  return <div className="webcrm-action-row webcrm-meeting-editor"><span><strong>{item.meetingType}</strong><br />{dateTime(item.preferredAt)} · {item.status}</span><input aria-label="Meeting date and time" type="datetime-local" value={preferredAt} onChange={(e) => setPreferredAt(e.target.value)} /><div className="actions"><button className="button small secondary" onClick={() => onAction(`/meetings/${item._id}`, { preferredAt, assignedTo: assignee || undefined }, "Meeting details updated.")}>Save time</button><button className="button small" onClick={() => onAction(`/meetings/${item._id}`, { status: "Confirmed", preferredAt, assignedTo: assignee || undefined }, "Meeting confirmed.")}>Confirm</button><button className="button small secondary" onClick={() => onAction(`/meetings/${item._id}`, { status: "Approved", preferredAt, assignedTo: assignee || undefined }, "Meeting approved.")}>Approve</button><button className="button small danger" onClick={() => onAction(`/meetings/${item._id}`, { status: "Rejected" }, "Meeting rejected.")}>Reject</button></div></div>;
}

function EmailHistory({ emails = [], onLoadDraft }) {
  if (!emails.length) return <p className="muted">No emails or drafts recorded yet.</p>;
  return <div className="webcrm-email-history">{[...emails].reverse().map((item) => <article key={item._id}><div><span className={`webcrm-status ${item.status === "Sent" ? "success" : item.status === "Failed" ? "danger" : "gold"}`}>{item.status}</span><strong>{item.subject || "Untitled email"}</strong><small>{item.sender || "No sender"} to {item.recipient || "No recipient"} · {dateTime(item.sentAt || item.createdAt)}</small></div>{item.status === "Draft" && <button className="button small secondary" onClick={() => onLoadDraft(item)}>Resume draft</button>}</article>)}</div>;
}

function ProspectDetail({ prospect, meta, user, onRefresh }) {
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [editingDetails, setEditingDetails] = useState(false);
  const [workspaceTab, setWorkspaceTab] = useState("activity");
  const [interaction, setInteraction] = useState({ interactionAt: asDateTimeLocal(new Date()), contactMethod: "Telephone", personSpokenTo: "", prospectResponse: "", servicesDiscussed: [], interestLevel: "Medium", followUpRequired: false, followUpAt: "", notes: "" });
  const [followUp, setFollowUp] = useState({ dueAt: "", contactMethod: "Telephone", priority: "Normal", notes: "" });
  const [email, setEmail] = useState({ fromEmail: meta.senders?.[0]?.address || "", recipient: prospect.email || "", cc: "", templateId: "", subject: "", message: "", signature: "", saveAsDraft: false });
  const [meeting, setMeeting] = useState({ preferredAt: "", meetingType: "Google Meet", prospectEmail: prospect.email || "", prospectPhone: prospect.telephone || "", notes: "" });
  const [qualification, setQualification] = useState(qualificationFromProspect(prospect));
  const [managerNote, setManagerNote] = useState("");
  const [assignee, setAssignee] = useState(prospect.assignedTo || "");
  const [pipelineStatus, setPipelineStatus] = useState(prospect.status);
  const [duplicates, setDuplicates] = useState([]);

  useEffect(() => {
    if (!meta.manager) return;
    api(`/web-leads/prospects/${prospect._id}/duplicates`).then(setDuplicates).catch(() => setDuplicates([]));
  }, [meta.manager, prospect._id]);

  useEffect(() => {
    setQualification(qualificationFromProspect(prospect));
    setPipelineStatus(prospect.status);
  }, [prospect._id, prospect.status, prospect.qualification?.submittedAt, prospect.qualification?.locked]);

  async function action(path, body, success, requestedMethod = "") {
    if (busy) return;
    setBusy(true);
    try { await api(`/web-leads/prospects/${prospect._id}${path}`, { method: requestedMethod || (path.includes("follow-ups/") || path.includes("meetings/") ? "PATCH" : "POST"), body }); setStatus({ message: success }); await onRefresh(); }
    catch (error) { setStatus({ type: "error", message: error.message }); }
    finally { setBusy(false); }
  }

  function chooseTemplate(id) {
    const template = meta.templates?.find((item) => item._id === id);
    setEmail({ ...email, templateId: id, subject: template?.subject || "", message: String(template?.body || "").replace(/{{businessName}}/g, prospect.businessName).replace(/{{contactName}}/g, prospect.contactPerson || "there") });
  }

  function submitEmail(saveAsDraft) {
    const signature = email.signature.trim();
    const message = signature ? `${email.message.trim()}\n\n${signature}` : email.message;
    return action("/emails", { ...email, message, cc: email.cc.split(/[;,]/).map((item) => item.trim()).filter(Boolean), saveAsDraft }, saveAsDraft ? "Draft saved." : "Email sent.");
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

  return <section className={`webcrm-detail${busy ? " is-busy" : ""}`} data-workspace={workspaceTab} aria-busy={busy}>
    <div className="webcrm-detail-head"><div><span className="eyebrow">Prospect workspace</span><h2>{prospect.businessName}</h2><p>{prospect.contactPerson} · {prospect.telephone} · {prospect.email || "No email"}</p></div><div className="webcrm-detail-controls"><span className={`webcrm-status ${statusTone(prospect.status)}`}>{prospect.status}</span>{(meta.manager || !prospect.qualification?.locked) && <button className="button small secondary" onClick={() => setEditingDetails((current) => !current)}>{editingDetails ? "Close editor" : "Edit details"}</button>}</div></div>
    <StatusMessage status={status} />
    {busy && <div className="webcrm-saving">Updating prospect record...</div>}
    {editingDetails && <ProspectForm compact meta={meta} initial={prospect} onSaved={async () => { setEditingDetails(false); setStatus({ message: "Prospect details updated." }); await onRefresh(); }} />}
    <nav className="webcrm-workspace-tabs" aria-label="Prospect workspace sections">
      {[["activity", "Activity & follow-up"], ["communication", "Email & meetings"], ["qualification", "Qualification"], ...(meta.manager ? [["manager", "Manager review"]] : [])].map(([key, label]) => <button type="button" className={workspaceTab === key ? "active" : ""} key={key} onClick={() => setWorkspaceTab(key)}>{label}</button>)}
      <HelpHint text="Choose one workspace at a time. Activity records contact outcomes, Email & meetings handles communication, Qualification prepares a sales-ready handover, and Manager review controls acceptance and ownership." />
    </nav>
    <div className="webcrm-detail-grid">
      <article className="card webcrm-panel-activity"><h3>Interaction note</h3><div className="form-grid"><input type="datetime-local" value={interaction.interactionAt} onChange={(e) => setInteraction({ ...interaction, interactionAt: e.target.value })} /><select value={interaction.contactMethod} onChange={(e) => setInteraction({ ...interaction, contactMethod: e.target.value })}>{["Telephone", "Email", "WhatsApp", "Other"].map((item) => <option key={item}>{item}</option>)}</select><input placeholder="Person spoken to" value={interaction.personSpokenTo} onChange={(e) => setInteraction({ ...interaction, personSpokenTo: e.target.value })} /><select value={interaction.interestLevel} onChange={(e) => setInteraction({ ...interaction, interestLevel: e.target.value })}>{["Low", "Medium", "High", "Qualified"].map((item) => <option key={item}>{item}</option>)}</select></div><div className="webcrm-service-picker"><strong>Services discussed</strong><div>{(meta.services || []).map((service) => <label className={interaction.servicesDiscussed.includes(service) ? "selected" : ""} key={service}><input type="checkbox" checked={interaction.servicesDiscussed.includes(service)} onChange={() => setInteraction((current) => ({ ...current, servicesDiscussed: current.servicesDiscussed.includes(service) ? current.servicesDiscussed.filter((item) => item !== service) : [...current.servicesDiscussed, service] }))} />{service}</label>)}</div></div><textarea placeholder="Prospect response" value={interaction.prospectResponse} onChange={(e) => setInteraction({ ...interaction, prospectResponse: e.target.value })} /><label className="webcrm-inline-check"><input type="checkbox" checked={interaction.followUpRequired} onChange={(e) => setInteraction({ ...interaction, followUpRequired: e.target.checked })} /> Follow-up required</label>{interaction.followUpRequired && <input type="datetime-local" value={interaction.followUpAt} onChange={(e) => setInteraction({ ...interaction, followUpAt: e.target.value })} />}<textarea placeholder="Notes" value={interaction.notes} onChange={(e) => setInteraction({ ...interaction, notes: e.target.value })} /><button className="button" onClick={() => action("/interactions", interaction, "Interaction saved.")}>Save interaction</button></article>
      <article className="card webcrm-panel-activity"><h3>Follow-up</h3><input type="datetime-local" value={followUp.dueAt} onChange={(e) => setFollowUp({ ...followUp, dueAt: e.target.value })} /><div className="form-grid"><select value={followUp.contactMethod} onChange={(e) => setFollowUp({ ...followUp, contactMethod: e.target.value })}>{["Telephone", "Email", "WhatsApp", "Other"].map((item) => <option key={item}>{item}</option>)}</select><select value={followUp.priority} onChange={(e) => setFollowUp({ ...followUp, priority: e.target.value })}>{["Low", "Normal", "High", "Urgent"].map((item) => <option key={item}>{item}</option>)}</select></div><textarea placeholder="Follow-up notes" value={followUp.notes} onChange={(e) => setFollowUp({ ...followUp, notes: e.target.value })} /><button className="button" onClick={() => action("/follow-ups", followUp, "Follow-up scheduled.")}>Schedule follow-up</button>{(prospect.followUps || []).map((item) => <FollowUpRow item={item} key={item._id} onAction={action} />)}</article>
      <article className="card webcrm-email-card webcrm-panel-communication"><h3>Approved email</h3><div className="form-grid"><select value={email.fromEmail} onChange={(e) => setEmail({ ...email, fromEmail: e.target.value })}><option value="">Send from</option>{(meta.senders || []).map((item) => <option key={item.address} value={item.address}>{item.label} · {item.address}</option>)}</select><select value={email.templateId} onChange={(e) => chooseTemplate(e.target.value)}><option value="">Select approved template</option>{(meta.templates || []).filter((item) => item.isActive).map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select><input type="email" placeholder="Recipient" value={email.recipient} onChange={(e) => setEmail({ ...email, recipient: e.target.value })} /><input placeholder="CC" value={email.cc} onChange={(e) => setEmail({ ...email, cc: e.target.value })} /></div><input placeholder="Subject" value={email.subject} onChange={(e) => setEmail({ ...email, subject: e.target.value })} /><textarea aria-label="Email message" value={email.message} onChange={(e) => setEmail({ ...email, message: e.target.value })} /><textarea aria-label="Agent signature" placeholder={`Optional agent signature\n${user?.name || "Your name"}\nInnovex Resource Group Limited`} value={email.signature} onChange={(e) => setEmail({ ...email, signature: e.target.value })} /><small className="muted">Leave signature blank when the approved template already contains the Innovex sign-off.</small><div className="actions"><button className="button" onClick={() => submitEmail(false)}><Send size={15} /> Send</button><button className="button secondary" onClick={() => submitEmail(true)}>Save draft</button></div><h4>Email history</h4><EmailHistory emails={prospect.emails} onLoadDraft={(draft) => setEmail({ fromEmail: draft.sender || meta.senders?.[0]?.address || "", recipient: draft.recipient || prospect.email || "", cc: (draft.cc || []).join(", "), templateId: String(draft.template || ""), subject: draft.subject || "", message: draft.content || "", signature: "", saveAsDraft: true })} /></article>
      <article className="card webcrm-panel-communication"><h3>Meeting request</h3><input type="datetime-local" value={meeting.preferredAt} onChange={(e) => setMeeting({ ...meeting, preferredAt: e.target.value })} /><select value={meeting.meetingType} onChange={(e) => setMeeting({ ...meeting, meetingType: e.target.value })}>{["Telephone", "Google Meet", "Microsoft Teams", "In person"].map((item) => <option key={item}>{item}</option>)}</select><div className="form-grid"><input type="email" value={meeting.prospectEmail} onChange={(e) => setMeeting({ ...meeting, prospectEmail: e.target.value })} /><input value={meeting.prospectPhone} onChange={(e) => setMeeting({ ...meeting, prospectPhone: e.target.value })} /></div><textarea placeholder="Meeting notes" value={meeting.notes} onChange={(e) => setMeeting({ ...meeting, notes: e.target.value })} /><button className="button" onClick={() => action("/meetings", meeting, "Meeting request submitted.")}>Request meeting</button></article>
    </div>
    {!prospect.qualification?.locked && <article className="card webcrm-qualification webcrm-panel-qualification"><div className="webcrm-section-title"><FileCheck2 size={20} /><div><h3>Submit qualified lead</h3><p>Complete every field before handing this opportunity to Innovex.</p></div></div><div className="form-grid">{[["Decision maker", "decisionMakerName"], ["Decision-maker role", "decisionMakerRole"], ["Direct phone", "directPhone"], ["Email", "email"], ["Website URL", "websiteUrl"], ["Website condition", "websiteCondition"], ["Budget indication", "budgetIndication"], ["Expected timeline", "expectedTimeline"]].map(([placeholder, key]) => <input key={key} placeholder={placeholder} value={qualification[key]} onChange={(e) => setQualification({ ...qualification, [key]: e.target.value })} />)}<input type="datetime-local" value={qualification.preferredMeetingAt} onChange={(e) => setQualification({ ...qualification, preferredMeetingAt: e.target.value })} /><input placeholder="Preferred contact method" value={qualification.preferredContactMethod} onChange={(e) => setQualification({ ...qualification, preferredContactMethod: e.target.value })} /></div><div className="webcrm-service-picker"><strong>Required services *</strong><div>{(meta.services || []).map((service) => <label className={qualification.requiredServices.includes(service) ? "selected" : ""} key={service}><input type="checkbox" checked={qualification.requiredServices.includes(service)} onChange={() => setQualification((current) => ({ ...current, requiredServices: current.requiredServices.includes(service) ? current.requiredServices.filter((item) => item !== service) : [...current.requiredServices, service] }))} />{service}</label>)}</div></div><textarea placeholder="Main business problem" value={qualification.mainBusinessProblem} onChange={(e) => setQualification({ ...qualification, mainBusinessProblem: e.target.value })} /><textarea placeholder="Detailed qualification notes" value={qualification.detailedNotes} onChange={(e) => setQualification({ ...qualification, detailedNotes: e.target.value })} /><button className="button" onClick={() => action("/qualify", qualification, "Qualified lead submitted for review.")}>Submit for review</button></article>}
    {prospect.qualification?.locked && <article className="card webcrm-qualification webcrm-panel-qualification webcrm-submitted"><FileCheck2 size={24} /><div><h3>Qualification submitted</h3><p>This lead is locked while an Innovex manager reviews it. Any request for more information will reopen the form with your saved answers.</p><span className={`webcrm-status ${statusTone(prospect.status)}`}>{prospect.status}</span></div></article>}
    {meta.manager && duplicates.length > 0 && <article className="card webcrm-manager-review webcrm-panel-manager"><h3>Possible duplicate records</h3><p className="muted">Review carefully before combining records. All prospect history will be retained.</p>{duplicates.map((item) => <div className="webcrm-action-row" key={item._id}><span><strong>{item.businessName}</strong><br />{item.contactPerson || "No contact"} · {item.postcode || "No postcode"} · {item.createdByName}</span><button className="button small secondary" onClick={() => mergeDuplicate(item)}>Merge record</button></div>)}</article>}
    {meta.manager && <article className="card webcrm-manager-review webcrm-panel-manager"><h3>Manager review</h3><div className="form-grid"><select value={assignee} onChange={(e) => setAssignee(e.target.value)}><option value="">Assign internal representative</option>{(meta.internalStaff || []).map((item) => <option key={item._id} value={item._id}>{item.name} · {item.role}</option>)}</select><select value={pipelineStatus} onChange={(e) => setPipelineStatus(e.target.value)}>{(meta.statuses || []).map((item) => <option key={item}>{item}</option>)}</select></div><button className="button secondary" onClick={() => action("", { status: pipelineStatus, assignedTo: assignee || undefined }, "Pipeline stage updated.", "PUT")}>Update pipeline stage</button><textarea placeholder="Manager note or information request" value={managerNote} onChange={(e) => setManagerNote(e.target.value)} /><div className="actions"><button className="button" onClick={() => action("/review", { action: "accept", note: managerNote, assignedTo: assignee || undefined }, "Lead accepted.")}>Accept</button><button className="button secondary" onClick={() => action("/review", { action: "more_info", note: managerNote, assignedTo: assignee || undefined }, "More information requested.")}>Request information</button><button className="button secondary" onClick={() => action("/review", { action: "reopen", note: managerNote, assignedTo: assignee || undefined }, "Lead reopened.")}>Reopen</button><button className="button danger" onClick={() => window.confirm("Reject this qualified lead?") && action("/review", { action: "reject", note: managerNote }, "Lead rejected.")}>Reject</button><button className="button secondary" onClick={() => action("/internal-notes", { note: managerNote }, "Private note added.")}>Add private note</button></div></article>}
    {meta.manager && (prospect.internalNotes || []).length > 0 && <article className="card webcrm-manager-review webcrm-panel-manager"><h3>Private internal notes</h3><p className="muted">Only Innovex managers can read these notes.</p>{[...prospect.internalNotes].reverse().map((item) => <div className="webcrm-internal-note" key={item._id}><p>{item.note}</p><small>{item.actor?.name || "Manager"} · {dateTime(item.createdAt)}</small></div>)}</article>}
    {meta.manager && (prospect.meetingRequests || []).length > 0 && <article className="card webcrm-manager-review webcrm-panel-communication"><h3>Meeting approvals</h3><p className="muted">Select an internal representative in Manager review before approving or confirming a meeting.</p>{prospect.meetingRequests.map((item) => <MeetingApprovalRow item={item} assignee={assignee} key={item._id} onAction={action} />)}</article>}
    <article className="card webcrm-timeline webcrm-panel-activity"><h3>Activity timeline</h3>{[...(prospect.timeline || [])].reverse().map((item) => <div key={item._id}><span className="webcrm-timeline-dot" /><section><strong>{item.type}</strong><p>{item.details}</p><small>{item.actor?.name || "System"} · {item.actor?.role || ""} · {dateTime(item.createdAt)}</small></section></div>)}{!prospect.timeline?.length && <p>No activity yet.</p>}</article>
  </section>;
}

function TemplatesView({ meta, reload }) {
  const [form, setForm] = useState({ name: "", type: "Initial company introduction", subject: "", body: "Hi {{contactName}},\n\n", isActive: true });
  const [editing, setEditing] = useState(null);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  async function save(e) { e.preventDefault(); setSaving(true); try { await api(editing ? `/web-leads/templates/${editing}` : "/web-leads/templates", { method: editing ? "PUT" : "POST", body: form }); setForm({ name: "", type: "Initial company introduction", subject: "", body: "Hi {{contactName}},\n\n", isActive: true }); setEditing(null); setStatus({ message: "Email template saved." }); await reload(); } catch (error) { setStatus({ type: "error", message: error.message }); } finally { setSaving(false); } }
  return <><StatusMessage status={status} /><div className="webcrm-template-layout">{meta.manager && <form className="card form" onSubmit={save}><div className="webcrm-section-title"><MessageSquareText size={20} /><div><h2>{editing ? "Edit template" : "Create approved template"}</h2><p>Approved wording available to the outreach team.</p></div><HelpHint text="Create reusable wording only. Agents can personalise the recipient and context before sending." /></div><label><span>Template name</span><input placeholder="Example: Website introduction" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label><label><span>Purpose</span><input placeholder="Initial company introduction" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} required /></label><label><span>Email subject</span><input placeholder="Clear approved subject line" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required /></label><label><span>Approved message</span><textarea value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} required /></label><label className="webcrm-inline-check"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active and approved</label><SubmitButton loading={saving} loadingText="Saving template...">Save template</SubmitButton></form>}<section><div className="webcrm-section-title"><ClipboardList size={20} /><div><h2>Approved library</h2><p>Select a template card to review its purpose and status.</p></div><HelpHint text="Inactive templates remain visible for history but cannot be selected for a new email." /></div><div className="webcrm-template-grid">{(meta.templates || []).map((item) => <article className="card" key={item._id}><span className={`webcrm-status ${item.isActive ? "success" : "danger"}`}>{item.isActive ? "Approved" : "Inactive"}</span><h3>{item.name}</h3><p>{item.subject}</p><small>{item.type}</small>{meta.manager && <button className="button small" onClick={() => { setEditing(item._id); setForm(item); }}>Edit</button>}</article>)}</div></section></div></>;
}

function ReportsView({ rows, meta, onFilter }) {
  const [filters, setFilters] = useState({ from: "", to: "", agent: "", category: "", service: "", status: "" });
  return <section className="card"><div className="webcrm-section-title"><Target size={20} /><div><h2>Agent performance</h2><p>Conversion is calculated from accepted leads against submitted prospects.</p></div><HelpHint text="Use a meaningful date range. Compare conversion with prospect volume, follow-up completion and overdue work before drawing conclusions." /></div><form className="webcrm-report-filters" onSubmit={(e) => { e.preventDefault(); onFilter(filters); }}><input aria-label="Report from date" type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /><input aria-label="Report to date" type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} />{meta.manager && <select value={filters.agent} onChange={(e) => setFilters({ ...filters, agent: e.target.value })}><option value="">All agents</option>{meta.agents.map((item) => <option value={item._id} key={item._id}>{item.name}</option>)}</select>}<select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option>{meta.categories.map((item) => <option key={item._id || item.name}>{item.name}</option>)}</select><select value={filters.service} onChange={(e) => setFilters({ ...filters, service: e.target.value })}><option value="">All services</option>{meta.services.map((item) => <option key={item}>{item}</option>)}</select><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option>{meta.statuses.map((item) => <option key={item}>{item}</option>)}</select><button className="button">Run report</button></form><div className="table-wrap webcrm-table"><table><thead><tr><th>Agent</th><th>Prospects</th><th>Emails</th><th>Follow-ups</th><th>Completed</th><th>Overdue</th><th>Interested</th><th>Qualified</th><th>Accepted</th><th>Rejected</th><th>Meetings</th><th>Booked</th><th>Won</th><th>Conversion</th></tr></thead><tbody>{rows.map((row) => <tr key={row._id?.user}><td><strong>{row._id?.name}</strong></td><td>{row.prospects}</td><td>{row.emailsSent}</td><td>{row.followUps}</td><td>{row.followUpsCompleted}</td><td>{row.followUpsOverdue}</td><td>{row.interested}</td><td>{row.qualified}</td><td>{row.accepted}</td><td>{row.rejected}</td><td>{row.meetings}</td><td>{row.meetingsBooked}</td><td>{row.won}</td><td>{row.conversionRate}%</td></tr>)}</tbody></table></div></section>;
}

function SettingsView({ categories, reload }) {
  const [name, setName] = useState("");
  const [status, setStatus] = useState(null);
  async function update(id, body, message) { try { await api(`/web-leads/categories/${id}`, { method: "PATCH", body }); setStatus({ message }); await reload(); } catch (error) { setStatus({ type: "error", message: error.message }); } }
  async function add(e) { e.preventDefault(); try { await api("/web-leads/categories", { method: "POST", body: { name, isActive: true } }); setName(""); setStatus({ message: "Business category added." }); await reload(); } catch (error) { setStatus({ type: "error", message: error.message }); } }
  async function rename(item) { const nextName = window.prompt("Update business category", item.name)?.trim(); if (!nextName || nextName === item.name) return; await update(item._id, { name: nextName }, "Business category updated."); }
  return <><StatusMessage status={status} /><section className="card webcrm-settings"><div className="webcrm-section-title"><Settings size={20} /><div><h2>Business categories</h2><p>Keep category names consistent across every prospect record.</p></div><HelpHint text="Add a category only when it represents a genuinely different type of business. Deactivate old categories rather than creating spelling variations." /></div><form onSubmit={add}><input placeholder="New business category" value={name} onChange={(e) => setName(e.target.value)} required /><button className="button">Add category</button></form><div>{categories.map((item) => <article key={item._id || item.name}><strong>{item.name}</strong><span className={`webcrm-status ${item.isActive !== false ? "success" : "danger"}`}>{item.isActive !== false ? "Active" : "Inactive"}</span>{item._id && <div className="actions"><button className="button small secondary" onClick={() => rename(item)}>Edit</button><button className="button small secondary" onClick={() => update(item._id, { isActive: item.isActive === false }, item.isActive === false ? "Business category activated." : "Business category deactivated.")}>{item.isActive === false ? "Activate" : "Deactivate"}</button></div>}</article>)}</div></section></>;
}

export default function AdminWebLeads({ mode = "dashboard" }) {
  const { user } = useAuth();
  const [meta, setMeta] = useState({ categories: [], services: [], statuses: [], templates: [], agents: [], senders: [] });
  const [data, setData] = useState({ stats: {}, recent: [] });
  const [prospects, setProspects] = useState([]);
  const [followUps, setFollowUps] = useState([]);
  const [reports, setReports] = useState([]);
  const [selected, setSelected] = useState(null);
  const [filters, setFilters] = useState(emptyFilters);
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
  async function loadFollowUps(page = 1, view = followUpView, activeFilters = filters) {
    const viewMap = { "Due today": "due", Upcoming: "upcoming", Overdue: "overdue", Completed: "completed" };
    const query = new URLSearchParams({ page, limit: 30, view: viewMap[view] || "due", ...Object.fromEntries(Object.entries(activeFilters).filter(([, value]) => value)) });
    const result = await api(`/web-leads/follow-ups?${query}`);
    setFollowUps(result.items || []); setPagination(result);
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
      if (mode === "followups") await loadFollowUps(1);
      else if (listMode) await loadList(1);
      if (mode === "reports") await loadReports();
      if (mode === "templates") setMeta(currentMeta);
      if (mode === "settings") setMeta(currentMeta);
    } catch (error) { setStatus({ type: "error", message: error.message }); }
    finally { setLoading(false); }
  }
  useEffect(() => { setSelected(null); reload(); }, [mode]);

  async function openProspect(id) { try { setSelected(await api(`/web-leads/prospects/${id}`)); } catch (error) { setStatus({ type: "error", message: error.message }); } }
  async function refreshSelected() { if (selected?._id) await openProspect(selected._id); if (mode === "followups") await loadFollowUps(pagination.page); else await loadList(pagination.page); }
  function loadPage(page) { return mode === "followups" ? loadFollowUps(page) : loadList(page); }
  function clearListFilters() {
    setFilters(emptyFilters);
    return mode === "followups" ? loadFollowUps(1, followUpView, emptyFilters) : loadList(1, emptyFilters);
  }

  return <>
    <PageHero mode={mode} notifications={notifications.filter((item) => !item.read).length} />
    <StatusMessage status={status} />
    {!loading && notifications.some((item) => !item.read) && <section className="webcrm-notifications">{notifications.filter((item) => !item.read).slice(0, 4).map((item) => <article key={item._id}><Bell size={17} /><div><strong>{item.title}</strong><p>{item.message}</p></div><button onClick={async () => { await api(`/web-leads/notifications/${item._id}/read`, { method: "PATCH" }); setNotifications((current) => current.map((notice) => notice._id === item._id ? { ...notice, read: true } : notice)); }}>Mark read</button></article>)}</section>}
    {!loading && mode === "dashboard" && meta.manager && <details className="card webcrm-dashboard-filter-disclosure"><summary><span><strong>Dashboard filters</strong><small>Current view: {dashboardFilters.period}</small></span><ChevronDown size={18} /></summary><form className="webcrm-dashboard-filters" onSubmit={(e) => { e.preventDefault(); loadDashboard(dashboardFilters); }}><select value={dashboardFilters.period} onChange={(e) => setDashboardFilters({ ...dashboardFilters, period: e.target.value })}>{["Today", "This week", "This month", "Custom"].map((item) => <option key={item}>{item}</option>)}</select>{dashboardFilters.period === "Custom" && <><input aria-label="Dashboard from date" type="date" value={dashboardFilters.from} onChange={(e) => setDashboardFilters({ ...dashboardFilters, from: e.target.value })} /><input aria-label="Dashboard to date" type="date" value={dashboardFilters.to} onChange={(e) => setDashboardFilters({ ...dashboardFilters, to: e.target.value })} /></>}<select value={dashboardFilters.agent} onChange={(e) => setDashboardFilters({ ...dashboardFilters, agent: e.target.value })}><option value="">All agents</option>{meta.agents.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select><select value={dashboardFilters.category} onChange={(e) => setDashboardFilters({ ...dashboardFilters, category: e.target.value })}><option value="">All categories</option>{meta.categories.map((item) => <option key={item._id || item.name}>{item.name}</option>)}</select><select value={dashboardFilters.status} onChange={(e) => setDashboardFilters({ ...dashboardFilters, status: e.target.value })}><option value="">All statuses</option>{meta.statuses.map((item) => <option key={item}>{item}</option>)}</select><select value={dashboardFilters.service} onChange={(e) => setDashboardFilters({ ...dashboardFilters, service: e.target.value })}><option value="">All services</option>{meta.services.map((item) => <option key={item}>{item}</option>)}</select><button className="button">Apply filters</button></form></details>}
    {loading && <section className="card webcrm-loading">Loading secure Web Leads CRM...</section>}
    {!loading && mode === "dashboard" && <DashboardView data={data} manager={meta.manager} />}
    {!loading && mode === "add" && <ProspectForm meta={meta} onSaved={(item) => setStatus({ message: `${item.businessName} was added successfully.` })} />}
    {!loading && listMode && <>
      <section className="card webcrm-filter-bar"><div className="webcrm-section-title"><Filter size={19} /><div><h2>Find the right records</h2><p>{meta.manager ? "Search the full team pipeline, then add advanced filters only when needed." : "Search your prospects, then add advanced filters only when needed."}</p></div><HelpHint text="Start with a keyword or status. Open More filters only for category, service, agent or date-specific searches." /></div><form onSubmit={(e) => { e.preventDefault(); mode === "followups" ? loadFollowUps(1) : loadList(1); }}><div className="webcrm-filter-primary"><div className="input-with-icon"><Search size={17} /><input placeholder="Business, contact, phone, email, website or postcode" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></div><select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option>{meta.statuses.map((item) => <option key={item}>{item}</option>)}</select><button className="button">Search</button><button type="button" className="button secondary" onClick={clearListFilters}>Clear</button></div><details className="webcrm-filter-more"><summary><span>More filters</span><ChevronDown size={17} /></summary><div><select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}><option value="">All categories</option>{meta.categories.filter((item) => item.isActive !== false).map((item) => <option key={item._id || item.name}>{item.name}</option>)}</select><select value={filters.service} onChange={(e) => setFilters({ ...filters, service: e.target.value })}><option value="">All services</option>{meta.services.map((item) => <option key={item}>{item}</option>)}</select>{meta.manager && <select value={filters.agent} onChange={(e) => setFilters({ ...filters, agent: e.target.value })}><option value="">All agents</option>{meta.agents.map((item) => <option key={item._id} value={item._id}>{item.name}</option>)}</select>}<label><span>Created from</span><input type="date" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></label><label><span>Created to</span><input type="date" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></label></div></details></form></section>
      {mode === "followups" ? <section className="card"><div className="webcrm-followup-head"><h2>Follow-up schedule</h2><div>{["Due today", "Upcoming", "Overdue", "Completed"].map((item) => <button className={followUpView === item ? "active" : ""} key={item} onClick={() => { setFollowUpView(item); loadFollowUps(1, item); }}>{item}</button>)}</div></div><div className="webcrm-followup-list">{followUps.map((item) => <button key={item._id} onClick={() => openProspect(item.prospect._id)}><span className={`webcrm-priority ${item.priority.toLowerCase()}`}>{item.priority}</span><strong>{item.prospect.businessName}</strong><span>{dateTime(item.dueAt)}</span><small>{item.completed ? "Completed" : followUpView}</small></button>)}{!followUps.length && <p>No follow-ups found.</p>}</div></section> : <ProspectTable items={prospects} onSelect={openProspect} />}
      <div className="talent-pagination"><button className="button secondary" disabled={pagination.page <= 1} onClick={() => loadPage(pagination.page - 1)}>Previous</button><span>Page {pagination.page} of {pagination.pages} · {Number(pagination.total || 0).toLocaleString()} {mode === "followups" ? "follow-ups" : "prospects"}</span><button className="button secondary" disabled={pagination.page >= pagination.pages} onClick={() => loadPage(pagination.page + 1)}>Next</button></div>
      {selected && <ProspectDetail prospect={selected} meta={meta} user={user} onRefresh={refreshSelected} />}
    </>}
    {!loading && mode === "templates" && <TemplatesView meta={meta} reload={loadMeta} />}
    {!loading && mode === "reports" && <ReportsView rows={reports} meta={meta} onFilter={loadReports} />}
    {!loading && mode === "settings" && <SettingsView categories={meta.categories} reload={loadMeta} />}
  </>;
}
