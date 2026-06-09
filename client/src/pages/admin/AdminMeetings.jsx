import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Mail, Phone, Users } from "lucide-react";
import { api } from "../../api/client.js";
import StatusMessage from "../../components/StatusMessage.jsx";
import SubmitButton from "../../components/SubmitButton.jsx";

const emptyMeeting = {
  attendeeName: "",
  attendeeEmail: "",
  attendeePhone: "",
  companyName: "",
  meetingTitle: "",
  meetingPurpose: "",
  meetingDate: "",
  meetingTime: "",
  meetingType: "Phone",
  meetingStatus: "Upcoming",
  notes: "",
  reminderEmailEnabled: true
};

function dateOnly(value) {
  return value ? new Date(value).toLocaleDateString() : "-";
}

function toMeetingForm(meeting = {}) {
  return {
    ...emptyMeeting,
    ...meeting,
    meetingDate: meeting.meetingDate ? meeting.meetingDate.slice(0, 10) : ""
  };
}

function reminderText(form) {
  return `Reminder: ${form.attendeeName || "[Attendee Name]"} has a ${form.meetingPurpose || "[Meeting Purpose]"} meeting today at ${form.meetingTime || "[Meeting Time]"} with ${form.companyName || "[Company Name]"}.`;
}

export default function AdminMeetings() {
  const [meetings, setMeetings] = useState([]);
  const [form, setForm] = useState(emptyMeeting);
  const [filters, setFilters] = useState({ search: "", status: "", date: "", companyName: "" });
  const [editing, setEditing] = useState(null);
  const [selected, setSelected] = useState(null);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);

  const summary = useMemo(() => ({
    total: meetings.length,
    upcoming: meetings.filter((item) => item.meetingStatus === "Upcoming").length,
    completed: meetings.filter((item) => item.meetingStatus === "Completed").length,
    reminders: meetings.filter((item) => item.reminderEmailEnabled).length
  }), [meetings]);

  function load() {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value)).toString();
    api(`/meetings${query ? `?${query}` : ""}`)
      .then(setMeetings)
      .catch((error) => setStatus({ type: "error", message: error.message }));
  }

  useEffect(() => {
    load();
  }, []);

  async function persist(payload, allowConflict = false) {
    return api(editing ? `/meetings/${editing}` : "/meetings", {
      method: editing ? "PUT" : "POST",
      body: { ...payload, allowConflict }
    });
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      let saved;
      try {
        saved = await persist(form);
      } catch (error) {
        if (error.status !== 409) throw error;
        const conflict = error.data?.conflict;
        const message = conflict
          ? `${error.message}\n\nExisting meeting: ${conflict.meetingTitle} with ${conflict.companyName} on ${dateOnly(conflict.meetingDate)} at ${conflict.meetingTime}.\n\nDo you still want to schedule this meeting?`
          : `${error.message}\n\nDo you still want to schedule this meeting?`;
        if (!confirm(message)) throw new Error("Meeting was not saved because the time is already booked.");
        saved = await persist(form, true);
      }
      setStatus({ message: "Meeting saved." });
      setForm(emptyMeeting);
      setEditing(null);
      setSelected(saved);
      load();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function remove(id) {
    if (!confirm("Delete this meeting?")) return;
    try {
      await api(`/meetings/${id}`, { method: "DELETE" });
      setStatus({ message: "Meeting deleted." });
      if (selected?._id === id) setSelected(null);
      load();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  function edit(meeting) {
    setEditing(meeting._id);
    setForm(toMeetingForm(meeting));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <>
      <div className="admin-top"><h1>Meetings</h1></div>
      <StatusMessage status={status} />
      <div className="interview-summary-grid">
        <div className="interview-summary-card"><span>Total meetings</span><strong>{summary.total}</strong></div>
        <div className="interview-summary-card"><span>Upcoming</span><strong>{summary.upcoming}</strong></div>
        <div className="interview-summary-card"><span>Completed</span><strong>{summary.completed}</strong></div>
        <div className="interview-summary-card highlight"><span>Reminders on</span><strong>{summary.reminders}</strong></div>
      </div>

      <div className="meeting-admin-grid">
        <form className="card form interview-form meeting-form" onSubmit={save}>
          <div className="admin-form-title">
            <div>
              <span className="eyebrow">Meeting tracker</span>
              <h2>{editing ? "Edit meeting booking" : "Book meeting"}</h2>
            </div>
            {editing && <button type="button" className="button secondary small" onClick={() => { setEditing(null); setForm(emptyMeeting); }}>Cancel edit</button>}
          </div>

          <div className="interview-form-section">
            <h3>Attendee details</h3>
            <div className="form-grid">
              <input placeholder="Attendee name" value={form.attendeeName} onChange={(e) => setForm({ ...form, attendeeName: e.target.value })} required />
              <input type="email" placeholder="Attendee email" value={form.attendeeEmail} onChange={(e) => setForm({ ...form, attendeeEmail: e.target.value })} />
              <input placeholder="Attendee phone" value={form.attendeePhone} onChange={(e) => setForm({ ...form, attendeePhone: e.target.value })} />
              <input placeholder="Company name" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required />
            </div>
          </div>

          <div className="interview-form-section">
            <h3>Meeting details</h3>
            <div className="form-grid">
              <input placeholder="Meeting title" value={form.meetingTitle} onChange={(e) => setForm({ ...form, meetingTitle: e.target.value })} required />
              <input placeholder="Meeting purpose" value={form.meetingPurpose} onChange={(e) => setForm({ ...form, meetingPurpose: e.target.value })} required />
              <input type="date" value={form.meetingDate} onChange={(e) => setForm({ ...form, meetingDate: e.target.value })} required />
              <input type="time" value={form.meetingTime} onChange={(e) => setForm({ ...form, meetingTime: e.target.value })} required />
              <select value={form.meetingType} onChange={(e) => setForm({ ...form, meetingType: e.target.value })}><option>Phone</option><option>Teams</option><option>Zoom</option><option>Face-to-face</option><option>Other</option></select>
              <select value={form.meetingStatus} onChange={(e) => setForm({ ...form, meetingStatus: e.target.value })}><option>Upcoming</option><option>Completed</option><option>Cancelled</option></select>
            </div>
          </div>

          <textarea placeholder="Meeting notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="reminder-preview">
            <label className="checkbox-line"><input type="checkbox" checked={form.reminderEmailEnabled} onChange={(e) => setForm({ ...form, reminderEmailEnabled: e.target.checked })} /> Auto email reminder enabled</label>
            <p>{reminderText(form)}</p>
            <small>Subject: Meeting reminder</small>
          </div>
          <SubmitButton loading={saving} loadingText="Saving meeting...">{editing ? "Update Meeting" : "Create Meeting"}</SubmitButton>
        </form>

        <aside className="card interview-detail meeting-detail">
          {selected ? (
            <>
              <div className="interview-profile">
                <span className="profile-avatar">{selected.attendeeName?.slice(0, 2).toUpperCase() || "MT"}</span>
                <div>
                  <h2>{selected.attendeeName}</h2>
                  <p className="muted">{selected.meetingTitle} with {selected.companyName}</p>
                </div>
              </div>
              <div className="interview-chip-row">
                <span className="status-chip">{selected.meetingStatus}</span>
                <span className="status-chip gold">{selected.meetingType}</span>
                {selected.reminderEmailEnabled && <span className="status-chip soft">Reminder on</span>}
              </div>
              <div className="interview-mini-grid">
                <div><span>Date</span><strong>{dateOnly(selected.meetingDate)}</strong></div>
                <div><span>Time</span><strong>{selected.meetingTime}</strong></div>
                <div><span>Purpose</span><strong>{selected.meetingPurpose}</strong></div>
                <div><span>Company</span><strong>{selected.companyName}</strong></div>
              </div>
              <div className="contact-strip">
                {selected.attendeeEmail && <a href={`mailto:${selected.attendeeEmail}`}><Mail size={15} /> {selected.attendeeEmail}</a>}
                {selected.attendeePhone && <a href={`tel:${selected.attendeePhone}`}><Phone size={15} /> {selected.attendeePhone}</a>}
                {selected.notes && <span>{selected.notes}</span>}
              </div>
            </>
          ) : (
            <div className="interview-detail-empty">
              <CalendarClock size={34} />
              <h3>Select a meeting</h3>
              <p className="muted">Choose a meeting from the table to view attendee, company, time, and reminder details.</p>
            </div>
          )}
        </aside>
      </div>

      <div className="card filters interview-filters" style={{ marginTop: 24 }}>
        <div className="filter-heading">
          <div>
            <span className="eyebrow">Search records</span>
            <h3>Find a meeting</h3>
          </div>
        </div>
        <div className="form-grid">
          <input placeholder="Search attendee, company, title, or purpose" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} />
          <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option value="">All statuses</option><option>Upcoming</option><option>Completed</option><option>Cancelled</option></select>
          <input type="date" value={filters.date} onChange={(e) => setFilters({ ...filters, date: e.target.value })} />
          <input placeholder="Filter by company" value={filters.companyName} onChange={(e) => setFilters({ ...filters, companyName: e.target.value })} />
          <button className="button" onClick={load}>Apply Filters</button>
        </div>
      </div>

      <div className="table-wrap interview-table meeting-table" style={{ marginTop: 24 }}>
        <table>
          <thead><tr><th>Attendee</th><th>Company</th><th>Meeting</th><th>Date / Time</th><th>Status</th><th>Reminder</th><th>Actions</th></tr></thead>
          <tbody>
            {meetings.map((item) => (
              <tr key={item._id} className={selected?._id === item._id ? "selected-row" : ""}>
                <td><strong>{item.attendeeName}</strong><br /><span className="muted">{item.attendeeEmail || item.attendeePhone || "No contact added"}</span></td>
                <td><strong>{item.companyName}</strong></td>
                <td><strong>{item.meetingTitle}</strong><br /><span className="muted">{item.meetingPurpose} - {item.meetingType}</span></td>
                <td>{dateOnly(item.meetingDate)}<br /><span className="muted">{item.meetingTime}</span></td>
                <td><span className="status-chip table-chip">{item.meetingStatus}</span></td>
                <td>{item.reminderEmailEnabled ? "On" : "Off"}</td>
                <td className="action-cell"><div className="compact-actions"><button className="button secondary small" onClick={() => setSelected(item)}>View</button><button className="button small" onClick={() => edit(item)}>Edit</button><button className="button small" onClick={() => remove(item._id)}>Delete</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
        {!meetings.length && (
          <div className="meeting-empty">
            <Users size={32} />
            <strong>No meetings found</strong>
            <span>Book a meeting above or adjust your filters.</span>
          </div>
        )}
      </div>
    </>
  );
}
