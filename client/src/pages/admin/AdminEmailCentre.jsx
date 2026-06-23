import { useEffect, useMemo, useState } from "react";
import { Inbox, MailCheck, MailPlus, Search, Send, ShieldCheck } from "lucide-react";
import { api } from "../../api/client.js";
import StatusMessage from "../../components/StatusMessage.jsx";
import SubmitButton from "../../components/SubmitButton.jsx";

const emptyForm = {
  fromEmail: "",
  to: "",
  cc: "",
  bcc: "",
  subject: "",
  message: ""
};

function dateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

function joinEmails(items = []) {
  return items?.length ? items.join(", ") : "-";
}

export default function AdminEmailCentre() {
  const [senders, setSenders] = useState([]);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [status, setStatus] = useState(null);
  const [sending, setSending] = useState(false);

  const selectedSender = useMemo(
    () => senders.find((sender) => sender.address === form.fromEmail),
    [senders, form.fromEmail]
  );

  async function loadLogs(nextSearch = search) {
    const query = new URLSearchParams({ limit: "15" });
    if (nextSearch) query.set("search", nextSearch);
    const data = await api(`/emails/logs?${query}`);
    setLogs(data.items || []);
    setTotal(data.total || 0);
  }

  useEffect(() => {
    api("/emails/senders")
      .then((data) => {
        const options = data.senders || [];
        setSenders(options);
        setForm((current) => ({ ...current, fromEmail: current.fromEmail || options[0]?.address || "" }));
      })
      .catch((error) => setStatus({ type: "error", message: error.message }));
    loadLogs().catch((error) => setStatus({ type: "error", message: error.message }));
  }, []);

  async function sendEmail(event) {
    event.preventDefault();
    setSending(true);
    try {
      const result = await api("/emails/send", { method: "POST", body: form });
      setStatus({ message: result.message || "Email sent successfully." });
      setForm({ ...emptyForm, fromEmail: form.fromEmail });
      await loadLogs();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSending(false);
    }
  }

  async function searchLogs(event) {
    event.preventDefault();
    try {
      await loadLogs(search);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  return (
    <>
      <section className="email-centre-hero talent-hero">
        <div className="talent-hero-copy">
          <span className="eyebrow">Mailbox workspace</span>
          <h1><MailPlus size={30} /> Email Centre</h1>
          <p>Compose one-to-one CRM emails, choose the correct Innovex mailbox, and keep a clean record of outreach activity.</p>
          <div className="talent-workflow-strip">
            <span><ShieldCheck size={16} /> Role based senders</span>
            <span><MailCheck size={16} /> CRM history</span>
            <span><Inbox size={16} /> Info and staff mailboxes</span>
          </div>
        </div>
        <div className="talent-command-card">
          <div className="talent-command-icon"><Send size={22} /></div>
          <span>Available senders</span>
          <strong>{senders.length || 0} mailbox{senders.length === 1 ? "" : "es"}</strong>
          <p>{senders.length ? "Only assigned sender emails appear here for each employee." : "Ask the owner to assign a sender mailbox."}</p>
        </div>
      </section>

      <StatusMessage status={status} />

      <div className="email-centre-grid">
        <form className="card email-compose-card" onSubmit={sendEmail}>
          <div className="admin-form-title">
            <span><MailPlus size={18} /> Compose email</span>
            <h2>Send from Innovex CRM</h2>
            <p>Select the mailbox first, then write the email exactly like a normal business compose window.</p>
          </div>
          <label>
            From
            <select value={form.fromEmail} onChange={(e) => setForm({ ...form, fromEmail: e.target.value })} required>
              {senders.map((sender) => <option key={sender.address} value={sender.address}>{sender.label} - {sender.address}</option>)}
            </select>
          </label>
          {selectedSender && <p className="sender-preview">Replies will go to <strong>{selectedSender.address}</strong>.</p>}
          <label>
            To
            <input placeholder="recipient@example.com, second@example.com" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} required />
          </label>
          <div className="form-grid">
            <label>
              CC
              <input placeholder="Optional" value={form.cc} onChange={(e) => setForm({ ...form, cc: e.target.value })} />
            </label>
            <label>
              BCC
              <input placeholder="Optional" value={form.bcc} onChange={(e) => setForm({ ...form, bcc: e.target.value })} />
            </label>
          </div>
          <label>
            Subject
            <input placeholder="Email subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
          </label>
          <label>
            Message
            <textarea rows="12" placeholder="Write your email..." value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required />
          </label>
          <div className="email-compose-actions">
            <SubmitButton loading={sending} loadingText="Sending email..." disabled={!senders.length}>
              <Send size={17} /> Send Email
            </SubmitButton>
          </div>
        </form>

        <aside className="card email-guidance-card">
          <MailCheck size={30} />
          <h2>Professional sending rules</h2>
          <p>Each employee can only send from the mailboxes assigned by the owner in Team Members.</p>
          <ul>
            <li>Use <strong>info@</strong> for general enquiries and campaigns.</li>
            <li>Use <strong>mark.harrison@</strong> when the reply should go directly to Mark.</li>
            <li>Sent emails are logged for CRM accountability.</li>
          </ul>
        </aside>
      </div>

      <section className="card email-history-card">
        <div className="calls-history-heading">
          <div>
            <span className="eyebrow"><Search size={15} /> Sent history</span>
            <h2>Recent CRM emails</h2>
          </div>
          <span className="status-chip soft">{total} record{total === 1 ? "" : "s"}</span>
        </div>
        <form className="email-history-filter" onSubmit={searchLogs}>
          <div className="input-with-icon">
            <Search size={18} />
            <input placeholder="Search sender, recipient, subject or message" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button className="button secondary" type="submit">Search</button>
        </form>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>From</th>
                <th>To</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Sent by</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log._id}>
                  <td>{log.fromName || "Innovex"}<br /><span className="muted">{log.fromEmail}</span></td>
                  <td>{joinEmails(log.to)}{log.cc?.length ? <><br /><span className="muted">CC: {joinEmails(log.cc)}</span></> : null}</td>
                  <td><strong>{log.subject}</strong><br /><span className="muted">{String(log.message || "").slice(0, 90)}{String(log.message || "").length > 90 ? "..." : ""}</span></td>
                  <td><span className={`status-chip ${log.status === "Sent" ? "success" : "danger"}`}>{log.status}</span></td>
                  <td>{log.sentBy?.name || "System"}<br /><span className="muted">{log.sentBy?.role || ""}</span></td>
                  <td>{dateTime(log.createdAt)}</td>
                </tr>
              ))}
              {!logs.length && <tr><td colSpan="6">No emails found.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
