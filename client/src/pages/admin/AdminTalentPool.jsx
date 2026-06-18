import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Database,
  FileUp,
  Filter,
  Mail,
  MapPin,
  MessageSquareText,
  Search,
  Send,
  Sparkles,
  Target,
  UploadCloud,
  UserCheck,
  UserPlus,
  UsersRound
} from "lucide-react";
import { api } from "../../api/client.js";
import StatusMessage from "../../components/StatusMessage.jsx";
import SubmitButton from "../../components/SubmitButton.jsx";

const emptyCandidate = {
  name: "",
  email: "",
  phone: "",
  postcode: "",
  city: "",
  desiredRole: "",
  experience: "",
  visaStatus: "",
  availability: "",
  shiftPreference: "",
  payExpectation: "",
  status: "Available",
  source: "Talent Pool",
  tags: "",
  notes: ""
};

const emptyFilters = { search: "", role: "", postcode: "", status: "", visaStatus: "", availability: "" };

const emailTemplate = {
  subject: "New {{jobTitle}} opportunity in {{location}}",
  message: [
    "Hi {{name}},",
    "",
    "I hope you are well. Innovex Resource Group has a {{jobTitle}} opportunity in {{location}} that may match your profile.",
    "",
    "If you are interested, please reply to this email with your availability and updated CV.",
    "",
    "Kind regards,",
    "Innovex Resource Group Limited"
  ].join("\n")
};

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-GB") : "-";
}

function toCandidatePayload(form) {
  return {
    ...form,
    tags: String(form.tags || "").split(/[;,]/).map((tag) => tag.trim()).filter(Boolean)
  };
}

function fromCandidate(candidate) {
  return {
    ...emptyCandidate,
    ...candidate,
    tags: Array.isArray(candidate.tags) ? candidate.tags.join(", ") : ""
  };
}

export default function AdminTalentPool() {
  const [candidates, setCandidates] = useState([]);
  const [stats, setStats] = useState({});
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [form, setForm] = useState(emptyCandidate);
  const [editing, setEditing] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [matching, setMatching] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [matchRole, setMatchRole] = useState("");
  const [matchPostcode, setMatchPostcode] = useState("");
  const [matches, setMatches] = useState([]);
  const [outreach, setOutreach] = useState(emailTemplate);
  const [sending, setSending] = useState(false);

  const selectedCount = selectedIds.length;
  const selectedJob = useMemo(() => jobs.find((job) => job._id === selectedJobId), [jobs, selectedJobId]);

  function queryString(page = pagination.page, nextFilters = filters) {
    const query = new URLSearchParams({
      page,
      limit: pagination.limit,
      ...Object.fromEntries(Object.entries(nextFilters).filter(([, value]) => value))
    });
    return query.toString();
  }

  async function load(page = 1, nextFilters = filters) {
    setLoading(true);
    try {
      const data = await api(`/candidates?${queryString(page, nextFilters)}`);
      setCandidates(data.items || []);
      setPagination({ page: data.page, pages: data.pages || 1, total: data.total || 0, limit: data.limit || 25 });
      setSelectedIds([]);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }

  async function loadStats() {
    api("/candidates/stats/summary").then(setStats).catch(() => {});
  }

  useEffect(() => {
    load();
    loadStats();
    api("/jobs?admin=true").then(setJobs).catch(() => {});
  }, []);

  async function saveCandidate(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api(editing ? `/candidates/${editing}` : "/candidates", {
        method: editing ? "PUT" : "POST",
        body: toCandidatePayload(form)
      });
      setStatus({ message: editing ? "Candidate updated." : "Candidate added to talent pool." });
      setForm(emptyCandidate);
      setEditing(null);
      await load(1);
      loadStats();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function importCsv(event) {
    event.preventDefault();
    const file = event.currentTarget.elements.file.files?.[0];
    if (!file) {
      setStatus({ type: "error", message: "Choose a CSV file first." });
      return;
    }
    const body = new FormData();
    body.append("file", file);
    setImporting(true);
    try {
      const result = await api("/candidates/import", { method: "POST", body });
      const parts = [
        `${result.message}.`,
        `${Number(result.rowsRead || 0).toLocaleString()} CSV rows read.`,
        `${Number(result.uniqueCandidates || result.imported || 0).toLocaleString()} unique candidates processed.`,
        `${Number(result.created || 0).toLocaleString()} created.`,
        `${Number(result.updated || 0).toLocaleString()} updated.`
      ];
      if (result.duplicatesMerged) parts.push(`${Number(result.duplicatesMerged).toLocaleString()} duplicate rows merged.`);
      if (result.skipped) parts.push(`${Number(result.skipped).toLocaleString()} empty rows skipped.`);
      setStatus({ message: parts.join(" ") });
      event.currentTarget.reset();
      await load(1);
      loadStats();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setImporting(false);
    }
  }

  async function removeCandidate(id) {
    if (!confirm("Delete this candidate from the talent pool?")) return;
    try {
      await api(`/candidates/${id}`, { method: "DELETE" });
      setStatus({ message: "Candidate deleted." });
      await load(pagination.page);
      loadStats();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  async function runMatch(event) {
    event.preventDefault();
    setMatching(true);
    try {
      const query = new URLSearchParams({
        ...(selectedJobId ? { jobId: selectedJobId } : {}),
        ...(matchRole ? { role: matchRole } : {}),
        ...(matchPostcode ? { postcode: matchPostcode } : {}),
        limit: 75
      });
      const data = await api(`/candidates/match?${query.toString()}`);
      setMatches(data.items || []);
      setStatus({ message: `Found ${data.count || 0} matching candidates.` });
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setMatching(false);
    }
  }

  async function sendOutreach(event) {
    event.preventDefault();
    setSending(true);
    try {
      const result = await api("/candidates/outreach", {
        method: "POST",
        body: {
          candidateIds: selectedIds,
          jobId: selectedJobId || undefined,
          jobTitle: selectedJob?.title || matchRole,
          location: selectedJob?.location || matchPostcode,
          subject: outreach.subject,
          message: outreach.message
        }
      });
      setStatus({ message: `${result.message}${result.failed?.length ? ` Failed: ${result.failed.length}.` : ""}` });
      setSelectedIds([]);
      await load(pagination.page);
      loadStats();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSending(false);
    }
  }

  function toggleSelected(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function selectMatch(candidate) {
    if (!selectedIds.includes(candidate._id)) setSelectedIds((current) => [...current, candidate._id]);
  }

  function applyFilters(event) {
    event.preventDefault();
    load(1, filters);
  }

  function resetFilters() {
    setFilters(emptyFilters);
    load(1, emptyFilters);
  }

  const summaryCards = [
    { label: "Total candidates", value: stats.total || 0, Icon: Database, tone: "primary" },
    { label: "Available", value: stats.available || 0, Icon: CheckCircle2, tone: "success" },
    { label: "Contacted", value: stats.contacted || 0, Icon: Send, tone: "blue" },
    { label: "Interested", value: stats.interested || 0, Icon: MessageSquareText, tone: "gold" },
    { label: "Shortlisted", value: stats.shortlisted || 0, Icon: Target, tone: "purple" },
    { label: "Placed", value: stats.placed || 0, Icon: UserCheck, tone: "success" }
  ];

  return (
    <>
      <section className="talent-hero talent-crm-hero">
        <div className="talent-hero-copy">
          <span className="eyebrow">Recruitment CRM</span>
          <h1><UsersRound size={30} /> Talent Pool</h1>
          <p>Manage high-volume healthcare candidates from one clean workspace: import records, match people to vacancies, and send personalised outreach without jumping back into spreadsheets.</p>
          <div className="talent-workflow-strip" aria-label="Talent pool workflow">
            <span><FileUp size={16} /> Import</span>
            <span><Search size={16} /> Search</span>
            <span><Target size={16} /> Match</span>
            <span><Mail size={16} /> Outreach</span>
          </div>
        </div>
        <div className="talent-command-card">
          <div className="talent-command-icon"><Sparkles size={22} /></div>
          <span>CRM workspace</span>
          <strong>Built for 40k+ candidate records</strong>
          <p>Fast paginated search, smart matching and controlled bulk email workflows.</p>
          <div className="talent-command-mini">
            <span>{Number(stats.available || 0).toLocaleString()} available</span>
            <span>{Number(selectedCount || 0).toLocaleString()} selected</span>
          </div>
        </div>
      </section>

      <StatusMessage status={status} />

      <div className="talent-summary-grid">
        {summaryCards.map(({ label, value, Icon, tone }) => (
          <article className={`talent-kpi-card ${tone}`} key={label}>
            <div>
              <Icon size={20} />
              <span>{label}</span>
            </div>
            <strong>{Number(value || 0).toLocaleString()}</strong>
          </article>
        ))}
      </div>

      <div className="talent-admin-grid">
        <form className="card form talent-form-card" onSubmit={saveCandidate}>
          <div className="admin-form-title">
            <span><UserPlus size={18} /> Candidate profile</span>
            <h2>{editing ? "Edit candidate" : "Add candidate"}</h2>
            <p>Add a single candidate manually when they come through WhatsApp, LinkedIn, email or a direct referral.</p>
          </div>
          <div className="form-grid">
            <input placeholder="Candidate name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input placeholder="Postcode" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
            <input placeholder="City / location" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <input placeholder="Desired role" value={form.desiredRole} onChange={(e) => setForm({ ...form, desiredRole: e.target.value })} />
            <input placeholder="Experience" value={form.experience} onChange={(e) => setForm({ ...form, experience: e.target.value })} />
            <input placeholder="Visa status" value={form.visaStatus} onChange={(e) => setForm({ ...form, visaStatus: e.target.value })} />
            <input placeholder="Availability" value={form.availability} onChange={(e) => setForm({ ...form, availability: e.target.value })} />
            <input placeholder="Shift preference" value={form.shiftPreference} onChange={(e) => setForm({ ...form, shiftPreference: e.target.value })} />
            <input placeholder="Pay expectation" value={form.payExpectation} onChange={(e) => setForm({ ...form, payExpectation: e.target.value })} />
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              <option>Available</option>
              <option>Contacted</option>
              <option>Interested</option>
              <option>Not Interested</option>
              <option>Shortlisted</option>
              <option>Submitted</option>
              <option>Placed</option>
              <option>Do Not Contact</option>
            </select>
            <input placeholder="Tags, comma separated" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
            <input placeholder="Source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          </div>
          <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="actions">
            <SubmitButton loading={saving} loadingText="Saving candidate...">{editing ? "Update Candidate" : "Add Candidate"}</SubmitButton>
            {editing && <button className="button secondary" type="button" onClick={() => { setEditing(null); setForm(emptyCandidate); }}>Cancel</button>}
          </div>
        </form>

        <aside className="talent-side-stack">
          <form className="card talent-import-card" onSubmit={importCsv}>
            <div className="talent-panel-heading">
              <span><UploadCloud size={22} /></span>
              <div>
                <h2>Import candidate CSV</h2>
                <p>Upload spreadsheet exports into your CRM library.</p>
              </div>
            </div>
            <p>Accepted headers include name, email, phone/number, postcode, role, visa status, availability, shift, pay and notes. Email spacing is cleaned automatically; if a row needs attention, the exact row number will show.</p>
            <input name="file" type="file" accept=".csv,text/csv" />
            <SubmitButton loading={importing} loadingText="Importing candidates...">Import CSV</SubmitButton>
          </form>

          <form className="card talent-outreach-card" onSubmit={sendOutreach}>
            <div className="talent-panel-heading">
              <span><Mail size={22} /></span>
              <div>
                <h2>Personalised outreach</h2>
                <p>{selectedCount} candidate{selectedCount === 1 ? "" : "s"} selected for this campaign.</p>
              </div>
            </div>
            <p>Use <strong>{"{{name}}"}</strong>, <strong>{"{{jobTitle}}"}</strong> and <strong>{"{{location}}"}</strong> to keep emails personal at scale.</p>
            <input placeholder="Email subject" value={outreach.subject} onChange={(e) => setOutreach({ ...outreach, subject: e.target.value })} required />
            <textarea rows="8" value={outreach.message} onChange={(e) => setOutreach({ ...outreach, message: e.target.value })} required />
            <button className={`button${sending ? " is-loading" : ""}`} type="submit" disabled={sending || !selectedCount}>
              {sending && <span className="button-spinner" aria-hidden="true" />}
              <span>{sending ? "Sending emails..." : "Send Personalised Emails"}</span>
            </button>
          </form>
        </aside>
      </div>

      <section className="card talent-match-card">
        <div className="admin-form-title">
          <span><Sparkles size={18} /> Smart matching</span>
          <h2>Find candidates for a vacancy</h2>
          <p>Choose a vacancy or enter a role/location manually to surface suitable people quickly.</p>
        </div>
        <form className="form-grid talent-match-form" onSubmit={runMatch}>
          <select value={selectedJobId} onChange={(e) => {
            const job = jobs.find((item) => item._id === e.target.value);
            setSelectedJobId(e.target.value);
            if (job) {
              setMatchRole(job.title);
              setMatchPostcode(job.location);
              setOutreach({
                subject: `New ${job.title} opportunity in ${job.location}`,
                message: emailTemplate.message
              });
            }
          }}>
            <option value="">Choose existing job</option>
            {jobs.map((job) => <option key={job._id} value={job._id}>{job.title} - {job.location}</option>)}
          </select>
          <input placeholder="Role / keyword" value={matchRole} onChange={(e) => setMatchRole(e.target.value)} />
          <input placeholder="Postcode / location prefix" value={matchPostcode} onChange={(e) => setMatchPostcode(e.target.value)} />
          <SubmitButton loading={matching} loadingText="Finding matches...">Find Matches</SubmitButton>
        </form>
        {matches.length > 0 && (
          <div className="talent-match-grid">
            {matches.map((candidate) => (
              <article className="talent-match-item" key={candidate._id}>
                <div>
                  <strong>{candidate.name}</strong>
                  <span>{candidate.desiredRole || "Role not set"} &middot; {candidate.postcode || candidate.city || "Location not set"}</span>
                </div>
                <div className="talent-score">{candidate.matchScore}%</div>
                <button className="button small secondary" type="button" onClick={() => selectMatch(candidate)}>Select</button>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="card filters talent-filter-card">
        <div className="talent-section-heading">
          <div>
            <span className="eyebrow"><Filter size={15} /> Candidate search</span>
            <h2>Search and segment the pool</h2>
          </div>
          <strong>{Number(pagination.total || 0).toLocaleString()} records</strong>
        </div>
        <form className="form-grid" onSubmit={applyFilters}>
          <label className="filter-field">
            <span>Search</span>
            <div className="input-with-icon"><Search size={18} /><input placeholder="Name, email, phone, keywords" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></div>
          </label>
          <label className="filter-field">
            <span>Role</span>
            <input placeholder="e.g. Nurse, Team Leader" value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })} />
          </label>
          <label className="filter-field">
            <span>Postcode</span>
            <div className="input-with-icon"><MapPin size={18} /><input placeholder="e.g. SO40, PE2" value={filters.postcode} onChange={(e) => setFilters({ ...filters, postcode: e.target.value })} /></div>
          </label>
          <label className="filter-field">
            <span>Status</span>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All statuses</option>
              <option>Available</option>
              <option>Contacted</option>
              <option>Interested</option>
              <option>Not Interested</option>
              <option>Shortlisted</option>
              <option>Submitted</option>
              <option>Placed</option>
              <option>Do Not Contact</option>
            </select>
          </label>
          <button className="button">Apply Filters</button>
          <button className="button secondary" type="button" onClick={resetFilters}>Reset</button>
        </form>
      </section>

      <div className="table-wrap talent-table">
        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Candidate</th>
              <th>Role / Location</th>
              <th>Visa / Availability</th>
              <th>Status</th>
              <th>Last contact</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7">Loading candidates...</td></tr>
            ) : candidates.length ? candidates.map((candidate) => (
              <tr key={candidate._id}>
                <td><input type="checkbox" checked={selectedIds.includes(candidate._id)} onChange={() => toggleSelected(candidate._id)} /></td>
                <td>
                  <div className="candidate-cell">
                    <span className="candidate-avatar">{String(candidate.name || "?").slice(0, 1).toUpperCase()}</span>
                    <div>
                      <strong>{candidate.name}</strong>
                      <span className="muted">{candidate.email || "No email"} &middot; {candidate.phone || "No phone"}</span>
                    </div>
                  </div>
                </td>
                <td>{candidate.desiredRole || "-"}<br /><span className="muted">{candidate.postcode || candidate.city || "-"}</span></td>
                <td>{candidate.visaStatus || "-"}<br /><span className="muted">{candidate.availability || candidate.shiftPreference || "-"}</span></td>
                <td><span className="status-chip table-chip">{candidate.status}</span></td>
                <td>{formatDate(candidate.lastContactedAt)}</td>
                <td className="actions compact-actions">
                  <button className="button small" onClick={() => { setEditing(candidate._id); setForm(fromCandidate(candidate)); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
                  <button className="button secondary small" onClick={() => removeCandidate(candidate._id)}>Delete</button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="7">No candidates found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="talent-pagination">
        <button className="button secondary" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>Previous</button>
        <span>Page {pagination.page} of {pagination.pages} &middot; {Number(pagination.total || 0).toLocaleString()} candidates</span>
        <button className="button secondary" disabled={pagination.page >= pagination.pages} onClick={() => load(pagination.page + 1)}>Next</button>
      </div>
    </>
  );
}
