import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Inbox,
  Link2,
  Mail,
  MailOpen,
  MessageSquareText,
  PhoneCall,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  UserRoundCheck,
  UsersRound
} from "lucide-react";
import { api } from "../../api/client.js";
import StatusMessage from "../../components/StatusMessage.jsx";
import SubmitButton from "../../components/SubmitButton.jsx";

function dateTime(value) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function dateTimeInput(hoursAhead = 24) {
  const date = new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function initials(name = "") {
  return String(name || "?").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

const timelineIcon = {
  "email-in": ArrowDownLeft,
  "email-out": ArrowUpRight,
  call: PhoneCall,
  "follow-up": CalendarClock,
  activity: MessageSquareText
};

export default function AdminCandidateCommunications() {
  const [params, setParams] = useSearchParams();
  const [tab, setTab] = useState(params.get("candidate") ? "timeline" : "inbox");
  const [summary, setSummary] = useState({ mailboxes: [] });
  const [messages, setMessages] = useState([]);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [inboxFilters, setInboxFilters] = useState({ search: "", mailbox: "", view: "all" });
  const [inboxLoading, setInboxLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [followUps, setFollowUps] = useState([]);
  const [followUpView, setFollowUpView] = useState("open");
  const [mineOnly, setMineOnly] = useState(false);
  const [candidateSearch, setCandidateSearch] = useState("");
  const [candidateResults, setCandidateResults] = useState([]);
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [timelineCounts, setTimelineCounts] = useState({});
  const [timelineLoading, setTimelineLoading] = useState(false);
  const [activeAction, setActiveAction] = useState("followup");
  const [noteForm, setNoteForm] = useState({ type: "Note", channel: "CRM", summary: "", details: "" });
  const [followUpForm, setFollowUpForm] = useState({ dueAt: dateTimeInput(), channel: "Phone", priority: "Normal", purpose: "Candidate follow-up", notes: "" });
  const [emailForm, setEmailForm] = useState({ fromEmail: "", subject: "", message: "" });
  const [status, setStatus] = useState(null);
  const [working, setWorking] = useState(false);
  const [completion, setCompletion] = useState({ id: "", outcome: "" });

  const selectedMailbox = useMemo(
    () => summary.mailboxes?.find((mailbox) => mailbox.address === emailForm.fromEmail),
    [summary.mailboxes, emailForm.fromEmail]
  );

  async function loadSummary() {
    const data = await api("/candidate-communications/summary");
    setSummary(data);
    setEmailForm((current) => ({ ...current, fromEmail: current.fromEmail || data.mailboxes?.[0]?.address || "" }));
  }

  async function loadInbox(nextFilters = inboxFilters) {
    setInboxLoading(true);
    try {
      const query = new URLSearchParams({ limit: "50" });
      Object.entries(nextFilters).forEach(([key, value]) => {
        if (value && value !== "all") query.set(key, value);
      });
      const data = await api(`/candidate-communications/inbox?${query}`);
      setMessages(data.items || []);
      setSelectedMessage((current) => data.items?.find((item) => item._id === current?._id) || data.items?.[0] || null);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setInboxLoading(false);
    }
  }

  async function loadFollowUps(view = followUpView, mine = mineOnly) {
    try {
      const query = new URLSearchParams({ view, mine: String(mine) });
      const data = await api(`/candidate-communications/follow-ups?${query}`);
      setFollowUps(data.items || []);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  async function openCandidate(candidateId) {
    if (!candidateId) return;
    setTimelineLoading(true);
    setTab("timeline");
    setParams({ candidate: candidateId });
    try {
      const data = await api(`/candidate-communications/${candidateId}/timeline`);
      setSelectedCandidate(data.candidate);
      setTimeline(data.timeline || []);
      setTimelineCounts(data.counts || {});
      setCandidateSearch("");
      setCandidateResults([]);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setTimelineLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([loadSummary(), loadInbox(), loadFollowUps()]).catch((error) => setStatus({ type: "error", message: error.message }));
    const candidateId = params.get("candidate");
    if (candidateId) openCandidate(candidateId);
  }, []);

  async function syncInbox() {
    setSyncing(true);
    try {
      const result = await api("/candidate-communications/sync", { method: "POST", body: { mailbox: inboxFilters.mailbox, limit: 30 } });
      setStatus({ message: result.message });
      await Promise.all([loadInbox(), loadSummary()]);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSyncing(false);
    }
  }

  async function selectInboxMessage(message) {
    setSelectedMessage({ ...message, isRead: true });
    if (!message.isRead) {
      api(`/candidate-communications/inbox/${message._id}/read`, { method: "PATCH", body: { isRead: true } }).then(loadSummary).catch(() => {});
      setMessages((current) => current.map((item) => item._id === message._id ? { ...item, isRead: true } : item));
    }
  }

  async function searchCandidates(event) {
    event?.preventDefault();
    if (!candidateSearch.trim()) return setCandidateResults([]);
    try {
      const query = new URLSearchParams({ search: candidateSearch.trim(), limit: "12", page: "1" });
      const data = await api(`/candidates?${query}`);
      setCandidateResults(data.items || []);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  async function linkMessage(candidate) {
    if (!selectedMessage) return;
    setWorking(true);
    try {
      const result = await api(`/candidate-communications/inbox/${selectedMessage._id}/link`, { method: "PATCH", body: { candidateId: candidate._id } });
      setSelectedMessage(result.message);
      setMessages((current) => current.map((item) => item._id === result.message._id ? result.message : item));
      setCandidateResults([]);
      setCandidateSearch("");
      setStatus({ message: result.notice });
      await loadSummary();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setWorking(false);
    }
  }

  async function addNote(event) {
    event.preventDefault();
    if (!selectedCandidate) return;
    setWorking(true);
    try {
      const result = await api(`/candidate-communications/${selectedCandidate._id}/notes`, { method: "POST", body: noteForm });
      setStatus({ message: result.message });
      setNoteForm({ type: "Note", channel: "CRM", summary: "", details: "" });
      await openCandidate(selectedCandidate._id);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setWorking(false);
    }
  }

  async function scheduleFollowUp(event) {
    event.preventDefault();
    if (!selectedCandidate) return;
    setWorking(true);
    try {
      const result = await api("/candidate-communications/follow-ups", { method: "POST", body: { ...followUpForm, candidateId: selectedCandidate._id } });
      setStatus({ message: result.message });
      setFollowUpForm({ dueAt: dateTimeInput(), channel: "Phone", priority: "Normal", purpose: "Candidate follow-up", notes: "" });
      await Promise.all([openCandidate(selectedCandidate._id), loadFollowUps(), loadSummary()]);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setWorking(false);
    }
  }

  async function sendCandidateEmail(event) {
    event.preventDefault();
    if (!selectedCandidate) return;
    setWorking(true);
    try {
      const result = await api(`/candidate-communications/${selectedCandidate._id}/email`, { method: "POST", body: emailForm });
      setStatus({ message: result.message });
      setEmailForm((current) => ({ ...current, subject: "", message: "" }));
      await Promise.all([openCandidate(selectedCandidate._id), loadSummary()]);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setWorking(false);
    }
  }

  async function completeFollowUp(event, item) {
    event.preventDefault();
    if (!completion.outcome.trim()) return;
    setWorking(true);
    try {
      const result = await api(`/candidate-communications/follow-ups/${item._id}`, { method: "PATCH", body: { status: "Completed", outcome: completion.outcome } });
      setStatus({ message: result.message });
      setCompletion({ id: "", outcome: "" });
      await Promise.all([loadFollowUps(), loadSummary(), selectedCandidate?._id ? openCandidate(selectedCandidate._id) : Promise.resolve()]);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setWorking(false);
    }
  }

  const kpis = [
    ["Unread emails", summary.unread, Inbox, "teal"],
    ["Due today", summary.dueToday, Clock3, "gold"],
    ["Overdue", summary.overdue, AlertTriangle, "rose"],
    ["Open follow-ups", summary.open, CalendarClock, "blue"]
  ];

  return (
    <div className="candidate-comms-page">
      <section className="candidate-comms-hero">
        <div>
          <span className="eyebrow"><ShieldCheck size={15} /> Secure recruitment communications</span>
          <h1>Candidate Communication Hub</h1>
          <p>Inbox, candidate history and recruiter follow-ups in one accountable workspace.</p>
        </div>
        <button className={`button candidate-sync-button${syncing ? " is-loading" : ""}`} onClick={syncInbox} disabled={syncing || !summary.mailboxes?.length}>
          <RefreshCw size={17} className={syncing ? "spin" : ""} /> {syncing ? "Synchronising..." : "Sync assigned inboxes"}
        </button>
      </section>

      <StatusMessage status={status} />

      <section className="candidate-comms-kpis">
        {kpis.map(([label, value, Icon, tone]) => <article className={tone} key={label}><span><Icon size={18} /> {label}</span><strong>{Number(value || 0).toLocaleString()}</strong></article>)}
      </section>

      <nav className="candidate-comms-tabs" aria-label="Communication Hub sections">
        {[["inbox", Inbox, "Integrated Inbox"], ["timeline", UsersRound, "Candidate 360"], ["followups", CalendarClock, "Follow-ups"]].map(([key, Icon, label]) => (
          <button key={key} className={tab === key ? "active" : ""} onClick={() => { setTab(key); if (key !== "timeline") setParams({}); }}><Icon size={17} /> {label}</button>
        ))}
      </nav>

      {tab === "inbox" && (
        <section className="candidate-inbox-shell">
          <div className="candidate-inbox-list">
            <form className="candidate-inbox-toolbar" onSubmit={(event) => { event.preventDefault(); loadInbox(); }}>
              <div className="input-with-icon"><Search size={17} /><input placeholder="Search sender, candidate or subject" value={inboxFilters.search} onChange={(event) => setInboxFilters({ ...inboxFilters, search: event.target.value })} /></div>
              <select aria-label="Mailbox" value={inboxFilters.mailbox} onChange={(event) => { const next = { ...inboxFilters, mailbox: event.target.value }; setInboxFilters(next); loadInbox(next); }}>
                <option value="">All assigned mailboxes</option>
                {(summary.mailboxes || []).map((mailbox) => <option key={mailbox.address} value={mailbox.address}>{mailbox.label}</option>)}
              </select>
              <select aria-label="Inbox view" value={inboxFilters.view} onChange={(event) => { const next = { ...inboxFilters, view: event.target.value }; setInboxFilters(next); loadInbox(next); }}>
                <option value="all">Received & sent</option><option value="unread">Unread</option><option value="sent">Sent emails</option><option value="linked">Linked candidates</option><option value="unlinked">Needs linking</option>
              </select>
              <button className="button secondary small">Search</button>
            </form>
            <div className="candidate-inbox-scroll">
              {inboxLoading ? <p className="candidate-comms-empty">Loading secure inbox...</p> : messages.map((message) => (
                <button className={`candidate-email-row${selectedMessage?._id === message._id ? " active" : ""}${message.isRead ? "" : " unread"}`} key={message._id} onClick={() => selectInboxMessage(message)}>
                  <span className={`candidate-email-avatar${message.direction === "Outbound" ? " outbound" : ""}`}>{message.direction === "Outbound" ? <ArrowUpRight size={17} /> : initials(message.from?.name || message.from?.address)}</span>
                  <span className="candidate-email-copy"><strong>{message.direction === "Outbound" ? `To ${message.candidateName || message.to?.[0]?.address || "candidate"}` : message.from?.name || message.from?.address || "Unknown sender"}</strong><b>{message.subject}</b><small>{message.snippet || "No message preview"}</small></span>
                  <span className="candidate-email-meta"><time>{dateTime(message.receivedAt)}</time>{message.candidateName ? <em><UserRoundCheck size={12} /> {message.candidateName}</em> : <em className="unlinked"><Link2 size={12} /> Link candidate</em>}</span>
                </button>
              ))}
              {!inboxLoading && !messages.length && <div className="candidate-comms-empty"><MailOpen size={34} /><strong>No synchronised emails found</strong><span>Use “Sync assigned inboxes” to securely fetch recent messages.</span></div>}
            </div>
          </div>

          <article className="candidate-email-reader">
            {selectedMessage ? (
              <>
                <header>
                  <div><span className="eyebrow">{selectedMessage.direction === "Outbound" ? "Sent from" : "Received in"} {selectedMessage.mailbox}</span><h2>{selectedMessage.subject}</h2><p>{selectedMessage.direction === "Outbound" ? <>To <strong>{selectedMessage.candidateName || selectedMessage.to?.[0]?.address}</strong> · {selectedMessage.to?.[0]?.address}</> : <>From <strong>{selectedMessage.from?.name || selectedMessage.from?.address}</strong> · {selectedMessage.from?.address}</>}</p></div>
                  <time>{dateTime(selectedMessage.receivedAt)}</time>
                </header>
                <div className="candidate-email-security"><ShieldCheck size={16} /> Access is restricted to assigned mailboxes. Attachments are shown by name and are not downloaded automatically.</div>
                {selectedMessage.attachmentCount > 0 && <div className="candidate-email-attachments"><strong>{selectedMessage.attachmentCount} attachment{selectedMessage.attachmentCount === 1 ? "" : "s"}</strong>{selectedMessage.attachmentNames?.map((name) => <span key={name}>{name}</span>)}</div>}
                <div className="candidate-email-body">{selectedMessage.text || "This email has no plain-text content."}</div>
                <footer>
                  {selectedMessage.candidate ? <button className="button" onClick={() => openCandidate(selectedMessage.candidate)}><UserRoundCheck size={16} /> Open candidate timeline</button> : (
                    <div className="candidate-link-panel">
                      <strong>Link this email to a candidate</strong>
                      <form onSubmit={searchCandidates}><input placeholder="Search candidate by name, email or phone" value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} /><button className="button secondary small">Find</button></form>
                      {!!candidateResults.length && <div>{candidateResults.map((candidate) => <button disabled={working} key={candidate._id} onClick={() => linkMessage(candidate)}><span><strong>{candidate.name}</strong><small>{candidate.email || candidate.phone} · {candidate.desiredRole || "Role not recorded"}</small></span><Link2 size={15} /></button>)}</div>}
                    </div>
                  )}
                </footer>
              </>
            ) : <div className="candidate-comms-empty"><Inbox size={38} /><strong>Select an email</strong><span>The complete message and candidate link will appear here.</span></div>}
          </article>
        </section>
      )}

      {tab === "timeline" && (
        <section className="candidate-360-shell">
          <aside className="candidate-lookup-card card">
            <span className="eyebrow"><Search size={14} /> Candidate lookup</span>
            <h2>Open a complete history</h2>
            <form onSubmit={searchCandidates}><input placeholder="Name, email, phone or Candidate ID" value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} /><button className="button">Search</button></form>
            <div className="candidate-lookup-results">{candidateResults.map((candidate) => <button key={candidate._id} onClick={() => openCandidate(candidate._id)}><span className="candidate-email-avatar">{initials(candidate.name)}</span><span><strong>{candidate.name}</strong><small>{candidate.desiredRole || "Role not recorded"} · {candidate.email || candidate.phone || "No contact details"}</small></span></button>)}</div>
            {selectedCandidate && <article className="candidate-identity-card"><span className="candidate-profile-avatar">{initials(selectedCandidate.name)}</span><h3>{selectedCandidate.name}</h3><p>{selectedCandidate.desiredRole || "Role not recorded"}</p><dl><div><dt>Status</dt><dd>{selectedCandidate.status}</dd></div><div><dt>Last contact</dt><dd>{dateTime(selectedCandidate.lastContactedAt)}</dd></div><div><dt>Next follow-up</dt><dd>{dateTime(selectedCandidate.nextFollowUpAt)}</dd></div><div><dt>Recruiter</dt><dd>{selectedCandidate.assignedRecruiter?.name || "Not assigned"}</dd></div></dl></article>}
          </aside>

          <div className="candidate-360-main">
            {!selectedCandidate ? <div className="card candidate-comms-empty"><UsersRound size={42} /><strong>Select a candidate</strong><span>Search above or open a linked candidate from the inbox.</span></div> : (
              <>
                <section className="card candidate-action-centre">
                  <header><div><span className="eyebrow">Next best action</span><h2>Contact {selectedCandidate.name}</h2></div><span className="status-chip soft">IRG-{String(selectedCandidate._id).slice(-8).toUpperCase()}</span></header>
                  <nav>{[["followup", CalendarClock, "Schedule follow-up"], ["email", Mail, "Send email"], ["note", MessageSquareText, "Add note"]].map(([key, Icon, label]) => <button key={key} className={activeAction === key ? "active" : ""} onClick={() => setActiveAction(key)}><Icon size={15} /> {label}</button>)}</nav>
                  {activeAction === "followup" && <form className="candidate-action-form" onSubmit={scheduleFollowUp}><label><span>Date and time</span><input type="datetime-local" value={followUpForm.dueAt} onChange={(event) => setFollowUpForm({ ...followUpForm, dueAt: event.target.value })} required /></label><label><span>Channel</span><select value={followUpForm.channel} onChange={(event) => setFollowUpForm({ ...followUpForm, channel: event.target.value })}>{["Phone", "Email", "WhatsApp", "SMS", "Other"].map((item) => <option key={item}>{item}</option>)}</select></label><label><span>Priority</span><select value={followUpForm.priority} onChange={(event) => setFollowUpForm({ ...followUpForm, priority: event.target.value })}>{["Low", "Normal", "High", "Urgent"].map((item) => <option key={item}>{item}</option>)}</select></label><label className="wide"><span>Purpose</span><input value={followUpForm.purpose} onChange={(event) => setFollowUpForm({ ...followUpForm, purpose: event.target.value })} required /></label><label className="wide"><span>Internal notes</span><textarea rows="3" value={followUpForm.notes} onChange={(event) => setFollowUpForm({ ...followUpForm, notes: event.target.value })} /></label><SubmitButton loading={working} loadingText="Scheduling...">Schedule follow-up</SubmitButton></form>}
                  {activeAction === "email" && <form className="candidate-action-form" onSubmit={sendCandidateEmail}><label><span>From mailbox</span><select value={emailForm.fromEmail} onChange={(event) => setEmailForm({ ...emailForm, fromEmail: event.target.value })} required>{(summary.mailboxes || []).map((mailbox) => <option key={mailbox.address} value={mailbox.address}>{mailbox.label} — {mailbox.address}</option>)}</select></label><label><span>To</span><input value={selectedCandidate.email || "Email not recorded"} disabled /></label><label className="wide"><span>Subject</span><input value={emailForm.subject} onChange={(event) => setEmailForm({ ...emailForm, subject: event.target.value })} required /></label><label className="wide"><span>Message</span><textarea rows="7" value={emailForm.message} onChange={(event) => setEmailForm({ ...emailForm, message: event.target.value })} required /></label>{selectedMailbox && <small className="candidate-mailbox-note"><ShieldCheck size={14} /> Replies return to {selectedMailbox.address}; successful sending is recorded in this timeline.</small>}<SubmitButton loading={working} loadingText="Sending..." disabled={!selectedCandidate.email || selectedCandidate.status === "Do Not Contact"}><Send size={16} /> Send and record</SubmitButton></form>}
                  {activeAction === "note" && <form className="candidate-action-form" onSubmit={addNote}><label><span>Record type</span><select value={noteForm.type} onChange={(event) => setNoteForm({ ...noteForm, type: event.target.value })}><option>Note</option><option>Message</option><option>Profile update</option></select></label><label><span>Channel</span><select value={noteForm.channel} onChange={(event) => setNoteForm({ ...noteForm, channel: event.target.value })}>{["CRM", "Phone", "WhatsApp", "SMS", "Email", "Other"].map((item) => <option key={item}>{item}</option>)}</select></label><label className="wide"><span>Summary</span><input value={noteForm.summary} onChange={(event) => setNoteForm({ ...noteForm, summary: event.target.value })} required /></label><label className="wide"><span>Details</span><textarea rows="4" value={noteForm.details} onChange={(event) => setNoteForm({ ...noteForm, details: event.target.value })} /></label><SubmitButton loading={working} loadingText="Recording...">Add to timeline</SubmitButton></form>}
                </section>

                <section className="card candidate-timeline-card">
                  <header><div><span className="eyebrow">Complete communication history</span><h2>Candidate timeline</h2></div><div className="candidate-timeline-counts"><span>{timelineCounts.inbound || 0} received</span><span>{timelineCounts.outbound || 0} sent</span><span>{timelineCounts.calls || 0} calls</span><span>{timelineCounts.followUps || 0} follow-ups</span></div></header>
                  {timelineLoading ? <p className="candidate-comms-empty">Loading candidate history...</p> : <div className="candidate-timeline-list">{timeline.map((item) => { const Icon = timelineIcon[item.kind] || MessageSquareText; return <article className={`candidate-timeline-item ${item.kind}`} key={`${item.kind}-${item.id}`}><span className="candidate-timeline-icon"><Icon size={17} /></span><div><header><strong>{item.title}</strong><time>{dateTime(item.at)}</time></header><p>{item.detail || "No additional notes recorded."}</p><footer><span>{item.meta}</span>{item.actor && <span>Recorded by {item.actor}</span>}{item.status && <em>{item.status}</em>}</footer></div></article>; })}{!timeline.length && <div className="candidate-comms-empty"><MessageSquareText size={34} /><strong>No communication recorded yet</strong><span>Send an email, schedule a follow-up or add a note to begin the history.</span></div>}</div>}
                </section>
              </>
            )}
          </div>
        </section>
      )}

      {tab === "followups" && (
        <section className="card candidate-followups-card">
          <header><div><span className="eyebrow"><CalendarClock size={15} /> Recruitment follow-up queue</span><h2>Nothing gets missed</h2><p>Work overdue items first, then today’s planned candidate contacts.</p></div><label className="candidate-mine-toggle"><input type="checkbox" checked={mineOnly} onChange={(event) => { setMineOnly(event.target.checked); loadFollowUps(followUpView, event.target.checked); }} /> Only my follow-ups</label></header>
          <nav>{[["overdue", "Overdue"], ["today", "Due today"], ["upcoming", "Upcoming"], ["open", "All open"], ["completed", "Completed"]].map(([key, label]) => <button key={key} className={followUpView === key ? "active" : ""} onClick={() => { setFollowUpView(key); loadFollowUps(key, mineOnly); }}>{label}</button>)}</nav>
          <div className="candidate-followup-list">{followUps.map((item) => <article className={`candidate-followup-item ${String(item.priority).toLowerCase()}${completion.id === item._id ? " completing" : ""}`} key={item._id}><span className="candidate-followup-channel">{item.channel === "Phone" ? <PhoneCall size={18} /> : <Mail size={18} />}</span><div><header><button onClick={() => openCandidate(item.candidate?._id)}>{item.candidate?.name || "Candidate removed"}</button><span className="status-chip soft">{item.priority}</span></header><strong>{item.purpose}</strong><p>{item.notes || item.outcome || "No additional notes."}</p><footer><span><Clock3 size={14} /> {dateTime(item.dueAt)}</span><span><UserRoundCheck size={14} /> {item.assignedTo?.name || "Unassigned"}</span></footer></div>{item.status === "Open" && completion.id !== item._id && <button className="button small" onClick={() => setCompletion({ id: item._id, outcome: "" })}><CheckCircle2 size={15} /> Complete</button>}{completion.id === item._id && <form className="candidate-followup-completion" onSubmit={(event) => completeFollowUp(event, item)}><label><span>Outcome *</span><textarea rows="2" autoFocus placeholder="What happened and what is the next step?" value={completion.outcome} onChange={(event) => setCompletion({ id: item._id, outcome: event.target.value })} required /></label><div><button type="button" className="button secondary small" onClick={() => setCompletion({ id: "", outcome: "" })}>Cancel</button><SubmitButton loading={working} loadingText="Saving...">Save completion</SubmitButton></div></form>}</article>)}{!followUps.length && <div className="candidate-comms-empty"><CheckCircle2 size={38} /><strong>No follow-ups in this view</strong><span>Candidate actions scheduled from Candidate 360 will appear here.</span></div>}</div>
        </section>
      )}
    </div>
  );
}
