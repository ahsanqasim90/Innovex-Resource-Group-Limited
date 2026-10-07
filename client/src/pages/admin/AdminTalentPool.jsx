import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CheckCircle2,
  Database,
  FileUp,
  Filter,
  Mail,
  MapPin,
  MessageSquareText,
  Pencil,
  PhoneCall,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  UploadCloud,
  UserCheck,
  UserPlus,
  UsersRound
} from "lucide-react";
import { api } from "../../api/client.js";
import { outreachHadProblems, sendOutreachInBatches, summariseOutreach } from "../../utils/bulkOutreach.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { hasPermission } from "../../auth/permissions.js";
import { CircleAlert, LoaderCircle, X } from "lucide-react";
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
  notes: "",
  lawfulBasis: "Not recorded",
  privacyNoticeSentAt: "",
  retentionReviewDate: ""
};

const emptyFilters = { search: "", role: "", postcode: "", radiusMiles: "", status: "", visaStatus: "", availability: "" };

function validPostcodePrefixes(value = "") {
  return [...new Set(String(value).split(/[,;\n]+/).map((item) => item.toUpperCase().replace(/\s+/g, "").slice(0, 4)).filter((item) => item.length >= 2))];
}

// Imported role names sometimes end with stray separators (for example "Senior Care Assistant |").
// Only the displayed label is tidied; the stored value is untouched so filtering still matches.
function cleanRole(label = "") {
  const tidy = String(label).replace(/[\s|,;:/\\-]+$/g, "").trim();
  return tidy || String(label);
}

function TalentToast({ status, onClose }) {
  useEffect(() => {
    if (!status || status.progress || status.sticky || status.type === "error") return undefined;
    const timer = window.setTimeout(onClose, 12000);
    return () => window.clearTimeout(timer);
  }, [status]);
  if (!status?.message) return null;
  const tone = status.type === "error" ? "error" : status.progress ? "progress" : "info";
  const percent = status.progress?.total ? Math.round((status.progress.done / status.progress.total) * 100) : 0;
  return (
    <div className={`talent-toast ${tone}`} role="status" aria-live="polite">
      <div className="talent-toast-body">
        {tone === "progress" ? <LoaderCircle size={18} className="talent-toast-spin" /> : tone === "error" ? <CircleAlert size={18} /> : <CheckCircle2 size={18} />}
        <p>{status.message}</p>
        {!status.progress && <button type="button" aria-label="Dismiss message" onClick={onClose}><X size={16} /></button>}
      </div>
      {status.progress && <div className="talent-toast-bar"><i style={{ width: `${percent}%` }} /></div>}
    </div>
  );
}

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

const candidateStatuses = [
  "Available",
  "Contacted",
  "Interested",
  "Not Interested",
  "Shortlisted",
  "Submitted",
  "Placed",
  "Do Not Contact"
];

const candidateTemplatePresets = [
  {
    label: "Vacancy outreach",
    subject: "New {{jobTitle}} opportunity in {{location}}",
    message: emailTemplate.message
  },
  {
    label: "Availability check",
    subject: "Quick availability check from Innovex",
    message: [
      "Hi {{name}},",
      "",
      "I hope you are well. We are updating availability for upcoming healthcare roles across your area.",
      "",
      "Are you currently available for new opportunities? If yes, please reply with your preferred role, location, shift pattern and start date.",
      "",
      "Kind regards,",
      "Innovex Resource Group Limited"
    ].join("\n")
  },
  {
    label: "CV update request",
    subject: "Updated CV request from Innovex",
    message: [
      "Hi {{name}},",
      "",
      "I hope you are well. We are reviewing candidates for upcoming healthcare opportunities and would like to keep your profile updated.",
      "",
      "Please reply with your latest CV, current postcode, preferred role and availability.",
      "",
      "Kind regards,",
      "Innovex Resource Group Limited"
    ].join("\n")
  }
];

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
  const { user: currentUser } = useAuth();
  const canSend = hasPermission(currentUser, "talentPool.send");
  const canViewCvUploads = hasPermission(currentUser, "cvs.view");
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState([]);
  const [stats, setStats] = useState({});
  const [jobs, setJobs] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [form, setForm] = useState(emptyCandidate);
  const [candidateCv, setCandidateCv] = useState(null);
  const [editing, setEditing] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 25, radiusMeta: null });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const loadSeq = useRef(0);
  const [roleQuery, setRoleQuery] = useState("");
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importReport, setImportReport] = useState(null);
  const [matching, setMatching] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [matchRole, setMatchRole] = useState("");
  const [matchPostcode, setMatchPostcode] = useState("");
  const [matches, setMatches] = useState([]);
  const [outreach, setOutreach] = useState(emailTemplate);
  const [campaignPreset, setCampaignPreset] = useState(candidateTemplatePresets[0].label);
  const [bulkStatus, setBulkStatus] = useState("Contacted");
  const [sending, setSending] = useState(false);
  const [sendReport, setSendReport] = useState(null);
  const [callConfig, setCallConfig] = useState({ allowedCallerIds: [] });
  const [selectedOutboundCallerId, setSelectedOutboundCallerId] = useState("");
  const [senderAccounts, setSenderAccounts] = useState([]);
  const [selectedSenderEmail, setSelectedSenderEmail] = useState("");
  const [postcodeRoles, setPostcodeRoles] = useState([]);
  const [selectedPostcodeRoles, setSelectedPostcodeRoles] = useState([]);
  const [postcodeRoleMeta, setPostcodeRoleMeta] = useState(null);
  const [loadingPostcodeRoles, setLoadingPostcodeRoles] = useState(false);
  const [rolesExpanded, setRolesExpanded] = useState(false);

  const selectedCount = selectedIds.length;
  // The add / import / outreach tools sit above the table, so they start collapsed to keep the
  // list in view. They open by themselves when a record is being edited or rows are selected.
  const [toolsOpen, setToolsOpen] = useState(false);
  useEffect(() => { if (editing) setToolsOpen(true); }, [editing]);
  useEffect(() => { if (selectedCount > 0) setToolsOpen(true); }, [selectedCount > 0]);
  const selectedJob = useMemo(() => jobs.find((job) => job._id === selectedJobId), [jobs, selectedJobId]);
  const selectedSender = useMemo(() => senderAccounts.find((sender) => sender.address === selectedSenderEmail), [senderAccounts, selectedSenderEmail]);

  function queryString(page = pagination.page, nextFilters = filters, roles = selectedPostcodeRoles) {
    const effectiveFilters = {
      ...nextFilters,
      ...(roles.length
        ? { role: "", roles: JSON.stringify(roles) }
        : {})
    };
    const query = new URLSearchParams({
      page,
      limit: pagination.limit,
      ...Object.fromEntries(Object.entries(effectiveFilters).filter(([, value]) => value))
    });
    return query.toString();
  }

  async function load(page = 1, nextFilters = filters, roles = selectedPostcodeRoles) {
    // Ticking several roles quickly starts several searches; only the newest one may update the page.
    const seq = ++loadSeq.current;
    setLoading(true);
    try {
      const data = await api(`/candidates?${queryString(page, nextFilters, roles)}`);
      if (seq !== loadSeq.current) return;
      setCandidates(data.items || []);
      setPagination({ page: data.page, pages: data.pages || 1, total: data.total || 0, limit: data.limit || 25, radiusMeta: data.radiusMeta || null });
      setSelectedIds([]);
    } catch (error) {
      if (seq === loadSeq.current) setStatus({ type: "error", message: error.message });
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }

  async function loadStats() {
    api("/candidates/stats/summary").then(setStats).catch(() => {});
  }

  useEffect(() => {
    load();
    loadStats();
    api("/jobs?admin=true").then(setJobs).catch(() => {});
    api("/calls/config/status")
      .then((data) => {
        setCallConfig(data);
        setSelectedOutboundCallerId(data.allowedCallerIds?.[0] || "");
      })
      .catch(() => {});
    api("/emails/senders")
      .then((data) => {
        const senders = data.senders || [];
        setSenderAccounts(senders);
        setSelectedSenderEmail(senders[0]?.address || "");
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const postcode = filters.postcode.trim();
    setSelectedPostcodeRoles([]);
    setRolesExpanded(false);
    if (!validPostcodePrefixes(postcode).length) {
      setPostcodeRoles([]);
      setPostcodeRoleMeta(null);
      setLoadingPostcodeRoles(false);
      return undefined;
    }

    const timer = window.setTimeout(async () => {
      setLoadingPostcodeRoles(true);
      try {
        const query = new URLSearchParams({
          postcode,
          ...(filters.radiusMiles ? { radiusMiles: filters.radiusMiles } : {}),
          ...(filters.status ? { status: filters.status } : {}),
          ...(filters.visaStatus ? { visaStatus: filters.visaStatus } : {}),
          ...(filters.availability ? { availability: filters.availability } : {})
        });
        const data = await api(`/candidates/role-options?${query.toString()}`);
        setPostcodeRoles(data.roles || []);
        setPostcodeRoleMeta(data.radiusMeta || null);
        // The role picker already reacts to these filters. Keep the table on
        // the exact same filter state so old role results cannot remain visible
        // after a postcode/status change.
        await load(1, filters, []);
      } catch (error) {
        setPostcodeRoles([]);
        setPostcodeRoleMeta(null);
        setStatus({ type: "error", message: error.message });
      } finally {
        setLoadingPostcodeRoles(false);
      }
    }, 400);

    return () => window.clearTimeout(timer);
  }, [filters.postcode, filters.radiusMiles, filters.status, filters.visaStatus, filters.availability]);

  async function saveCandidate(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const body = new FormData();
      const payload = toCandidatePayload(form);
      Object.entries(payload).forEach(([key, value]) => {
        if (Array.isArray(value)) body.append(key, value.join(", "));
        else if (value !== undefined && value !== null) body.append(key, value);
      });
      if (candidateCv) body.append("cv", candidateCv);
      await api(editing ? `/candidates/${editing}` : "/candidates", {
        method: editing ? "PUT" : "POST",
        body
      });
      setStatus({ message: `${editing ? "Candidate updated" : "Candidate added to talent pool"}${candidateCv ? " with CV" : ""}.` });
      setForm(emptyCandidate);
      setCandidateCv(null);
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
    const formElement = event.currentTarget;
    const file = formElement.elements.file.files?.[0];
    if (!file) {
      setStatus({ type: "error", message: "Choose a CSV file first." });
      return;
    }
    const body = new FormData();
    body.append("file", file);
    setImporting(true);
    setImportReport(null);
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
      setImportReport({
        type: "success",
        rowsRead: result.rowsRead || 0,
        created: result.created || 0,
        updated: result.updated || 0,
        uniqueCandidates: result.uniqueCandidates || result.imported || 0,
        duplicatesMerged: result.duplicatesMerged || 0,
        skipped: result.skipped || 0,
        warnings: result.importReport?.warnings || []
      });
      formElement.reset();
      await load(1);
      loadStats();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
      if (error.data?.importReport) {
        setImportReport({ type: "error", ...error.data.importReport });
      }
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
    if (sending) return;
    setSending(true);
    const startedAt = new Date();
    setSendReport({ running: true, done: 0, total: selectedIds.length, sent: 0, startedAt });
    try {
      // Sent in small batches so a slow mail server cannot exceed the serverless time limit,
      // and already-emailed candidates are skipped if a batch has to be repeated.
      const result = await sendOutreachInBatches({
        path: "/candidates/outreach",
        idsKey: "candidateIds",
        ids: selectedIds,
        body: {
          jobId: selectedJobId || undefined,
          jobTitle: selectedJob?.title || matchRole,
          location: selectedJob?.location || matchPostcode,
          subject: outreach.subject,
          message: outreach.message,
          fromEmail: selectedSenderEmail
        },
        onProgress: ({ done, total, sent }) => {
          setStatus({ message: `Sending emails: ${done} of ${total} processed (${sent} sent). Please keep this page open.`, progress: { done, total } });
          setSendReport({ running: true, done, total, sent, startedAt });
        }
      });
      setStatus({ type: outreachHadProblems(result) ? "error" : undefined, message: summariseOutreach(result), sticky: true });
      setSendReport({ running: false, startedAt, finishedAt: new Date(), total: result.total, sent: result.sent, archived: result.archived, skipped: result.skipped.length, failed: result.failed.length, unsent: result.unsent.length, problems: outreachHadProblems(result), summary: summariseOutreach(result) });
      await load(pagination.page);
      // Keep failed/unprocessed recipients selected after the table refresh so
      // the administrator can retry them without rebuilding the selection.
      setSelectedIds(result.unsent);
      loadStats();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
      setSendReport((current) => current ? {
        ...current,
        running: false,
        problems: true,
        summary: error.message,
        finishedAt: new Date()
      } : null);
    } finally {
      setSending(false);
    }
  }

  function toggleSelected(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function selectVisible() {
    setSelectedIds(candidates.map((candidate) => candidate._id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  function selectMatch(candidate) {
    if (!selectedIds.includes(candidate._id)) setSelectedIds((current) => [...current, candidate._id]);
  }

  function applyQuickSegment(nextFilters) {
    const merged = { ...emptyFilters, ...nextFilters };
    setFilters(merged);
    load(1, merged);
  }

  function applyCampaignPreset(label) {
    const preset = candidateTemplatePresets.find((item) => item.label === label);
    setCampaignPreset(label);
    if (preset) setOutreach({ subject: preset.subject, message: preset.message });
  }

  async function updateSelectedStatus() {
    if (!selectedCount) return;
    try {
      const result = await api("/candidates/bulk-status", {
        method: "PATCH",
        body: { candidateIds: selectedIds, status: bulkStatus }
      });
      setStatus({ message: result.message });
      clearSelection();
      await load(pagination.page);
      loadStats();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  async function startCandidateCall(candidate) {
    if (!candidate.phone) {
      setStatus({ type: "error", message: "This candidate does not have a phone number." });
      return;
    }
    try {
      const result = await api("/calls/start", {
        method: "POST",
        body: {
          targetType: "Candidate",
          targetId: candidate._id,
          outboundCallerId: selectedOutboundCallerId,
          notes: `Call started from Talent Pool for ${candidate.desiredRole || "candidate profile"}.`
        }
      });
      setStatus({
        type: result.yay?.ok || result.yay?.skipped ? "success" : "error",
        message: result.yay?.message || "Candidate call logged."
      });
      await load(pagination.page);
      loadStats();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  function applyFilters(event) {
    event.preventDefault();
    const nextFilters = {
      ...filters,
      role: selectedPostcodeRoles.length ? "" : filters.role,
      ...(selectedPostcodeRoles.length ? { roles: JSON.stringify(selectedPostcodeRoles) } : {})
    };
    load(1, nextFilters);
  }

  function resetFilters() {
    setFilters(emptyFilters);
    setPostcodeRoles([]);
    setSelectedPostcodeRoles([]);
    setRoleQuery("");
    load(1, emptyFilters, []);
  }

  function applyRoles(next) {
    setSelectedPostcodeRoles(next);
    load(1, filters, next);
  }

  function togglePostcodeRole(role) {
    applyRoles(selectedPostcodeRoles.includes(role)
      ? selectedPostcodeRoles.filter((item) => item !== role)
      : [...selectedPostcodeRoles, role]);
  }

  const roleSearch = roleQuery.trim().toLowerCase();
  const visibleRoles = postcodeRoles.filter((item) => {
    const matchesSearch = !roleSearch || cleanRole(item.label).toLowerCase().includes(roleSearch);
    if (!matchesSearch) return false;
    // Keep the default panel useful: local roles plus established high-volume
    // role groups. One-off imported job titles remain available through search
    // or the explicit Show all action instead of overwhelming the screen.
    return Boolean(roleSearch || rolesExpanded || item.count > 0 || item.totalCount >= 10);
  }).sort((left, right) => {
    const priority = (item) => item.key === "support worker" ? 2 : item.key === "healthcare assistant" ? 1 : 0;
    return priority(right) - priority(left) || right.count - left.count || right.totalCount - left.totalCount || left.label.localeCompare(right.label);
  });
  const selectedCvUploadRole = selectedPostcodeRoles.length === 1
    ? postcodeRoles.find((item) => item.label === selectedPostcodeRoles[0] && item.cvUploadTotal > 0)
    : null;

  const summaryCards = [
    { label: "Total candidates", value: stats.total || 0, Icon: Database, tone: "primary" },
    { label: "Available", value: stats.available || 0, Icon: CheckCircle2, tone: "success" },
    { label: "Contacted", value: stats.contacted || 0, Icon: Send, tone: "blue" },
    { label: "Interested", value: stats.interested || 0, Icon: MessageSquareText, tone: "gold" },
    { label: "Shortlisted", value: stats.shortlisted || 0, Icon: Target, tone: "purple" },
    { label: "Placed", value: stats.placed || 0, Icon: UserCheck, tone: "success" }
  ];

  return (
    <div className="talent-pool-page">
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

      <TalentToast status={status} onClose={() => setStatus(null)} />

      {callConfig.allowedCallerIds?.length > 0 && (
        <section className="call-number-toolbar">
          <div>
            <span className="eyebrow"><PhoneCall size={14} /> Outbound calling</span>
            <strong>Calling from</strong>
          </div>
          <select value={selectedOutboundCallerId} onChange={(event) => setSelectedOutboundCallerId(event.target.value)}>
            {callConfig.allowedCallerIds.map((callerId) => <option key={callerId} value={callerId}>{callerId}</option>)}
          </select>
        </section>
      )}

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

      <section className="crm-segment-grid" aria-label="Candidate quick segments">
        <button type="button" className="crm-segment-card" onClick={() => applyQuickSegment({ status: "Available" })}>
          <span>Ready to contact</span>
          <strong>Available candidates</strong>
          <small>Start outreach from candidates open to roles.</small>
        </button>
        <button type="button" className="crm-segment-card" onClick={() => applyQuickSegment({ role: "HCA", status: "Available" })}>
          <span>Healthcare assistants</span>
          <strong>HCA shortlist</strong>
          <small>Useful for urgent care home shifts.</small>
        </button>
        <button type="button" className="crm-segment-card" onClick={() => applyQuickSegment({ role: "Nurse" })}>
          <span>Nursing desk</span>
          <strong>Nurse / RGN pool</strong>
          <small>Find clinical candidates quickly.</small>
        </button>
        <button type="button" className="crm-segment-card" onClick={() => applyQuickSegment({ role: "Manager" })}>
          <span>Leadership roles</span>
          <strong>Managers</strong>
          <small>Registered and deputy manager searches.</small>
        </button>
      </section>

      <button type="button" className="page-tools-toggle" aria-expanded={toolsOpen} onClick={() => setToolsOpen((value) => !value)}><strong>Add candidate · Import CSV · Personalised email outreach</strong><span aria-hidden="true">{toolsOpen ? "Hide ▲" : "Show ▼"}</span></button>
      <div className="talent-admin-grid" hidden={!toolsOpen}>
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
            <select value={form.lawfulBasis} onChange={(e) => setForm({ ...form, lawfulBasis: e.target.value })} aria-label="Candidate data lawful basis">
              <option>Not recorded</option><option>Consent</option><option>Legitimate interests</option><option>Contract</option><option>Legal obligation</option>
            </select>
            <label className="talent-compliance-date"><span>Privacy notice sent</span><input type="date" value={form.privacyNoticeSentAt ? String(form.privacyNoticeSentAt).slice(0, 10) : ""} onChange={(e) => setForm({ ...form, privacyNoticeSentAt: e.target.value })} /></label>
            <label className="talent-compliance-date"><span>Retention review</span><input type="date" value={form.retentionReviewDate ? String(form.retentionReviewDate).slice(0, 10) : ""} onChange={(e) => setForm({ ...form, retentionReviewDate: e.target.value })} /></label>
          </div>
          <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <label className={`talent-cv-upload${candidateCv ? " has-file" : ""}`}>
            <input key={`${editing || "new"}-${candidateCv ? candidateCv.name : "empty"}`} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={(event) => setCandidateCv(event.target.files?.[0] || null)} />
            <span className="talent-cv-upload-icon"><FileUp size={21} /></span>
            <span className="talent-cv-upload-copy">
              <strong>{candidateCv ? candidateCv.name : "Attach candidate CV"}</strong>
              <small>{candidateCv ? "File selected and ready to upload" : editing && candidates.find((candidate) => candidate._id === editing)?.cv?.originalName ? `Current: ${candidates.find((candidate) => candidate._id === editing).cv.originalName}` : "Optional · secure PDF or DOCX · maximum 5 MB"}</small>
            </span>
            <span className="talent-cv-upload-action">{candidateCv || editing && candidates.find((candidate) => candidate._id === editing)?.cv?.originalName ? "Replace file" : "Choose file"}</span>
          </label>
          <div className="actions">
            <SubmitButton loading={saving} loadingText="Saving candidate...">{editing ? "Update Candidate" : "Add Candidate"}</SubmitButton>
            {editing && <button className="button secondary" type="button" onClick={() => { setEditing(null); setForm(emptyCandidate); setCandidateCv(null); }}>Cancel</button>}
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
            {importReport && (
              <div className={`csv-import-report ${importReport.type === "success" ? "success" : "error"}`}>
                <div className="csv-import-report-head">
                  <span>{importReport.type === "success" ? <CheckCircle2 size={18} /> : <FileUp size={18} />}</span>
                  <div>
                    <strong>{importReport.type === "success" ? "Import completed successfully" : "CSV scan report"}</strong>
                    <small>
                      {importReport.type === "success"
                        ? `${Number(importReport.uniqueCandidates || 0).toLocaleString()} candidates processed from ${Number(importReport.rowsRead || 0).toLocaleString()} rows.`
                        : `${Number(importReport.issueCount || 0).toLocaleString()} issue${Number(importReport.issueCount || 0) === 1 ? "" : "s"} found across ${Number(importReport.rowsRead || 0).toLocaleString()} rows.`}
                    </small>
                  </div>
                </div>

                {importReport.type === "success" ? (
                  <div className="csv-import-summary-grid">
                    <span><strong>{Number(importReport.created || 0).toLocaleString()}</strong> Created</span>
                    <span><strong>{Number(importReport.updated || 0).toLocaleString()}</strong> Updated</span>
                    <span><strong>{Number(importReport.duplicatesMerged || 0).toLocaleString()}</strong> Duplicates merged</span>
                    <span><strong>{Number(importReport.skipped || 0).toLocaleString()}</strong> Empty rows skipped</span>
                  </div>
                ) : (
                  <>
                    <p className="csv-import-report-note">Nothing has been imported yet. Fix these rows in your CSV, save it again, and re-upload.</p>
                    <div className="csv-import-issues">
                      {(importReport.issues || []).map((issue, index) => (
                        <article key={`${issue.row}-${issue.field}-${index}`}>
                          <strong>Row {issue.row}</strong>
                          <span>{issue.field}: {issue.message}</span>
                          <small>Value: {issue.value}</small>
                        </article>
                      ))}
                    </div>
                    {importReport.truncated && <p className="csv-import-report-note">Only the first 250 issues are shown. Fix these first, then upload again for the next scan.</p>}
                  </>
                )}

                {!!importReport.warnings?.length && (
                  <div className="csv-import-warnings">
                    <strong>Warnings</strong>
                    {importReport.warnings.slice(0, 8).map((warning, index) => (
                      <small key={`${warning.row}-${index}`}>Row {warning.row}: {warning.message}</small>
                    ))}
                  </div>
                )}
              </div>
            )}
          </form>

          <form className="card talent-outreach-card outreach-compose-card" onSubmit={sendOutreach}>
            <div className="outreach-compose-header">
              <div className="talent-panel-heading">
                <span><Mail size={22} /></span>
                <div><span className="eyebrow">Candidate campaign</span><h2>Personalised outreach</h2><p>Targeted recruitment emails at scale.</p></div>
              </div>
              <strong className="outreach-selection-count">{selectedCount} selected</strong>
            </div>
            <div className="outreach-token-strip">Personalise with <strong>{"{{name}}"}</strong>, <strong>{"{{jobTitle}}"}</strong> and <strong>{"{{location}}"}</strong>.</div>
            <div className="outreach-mailbox-panel">
              <label className="outreach-sender-field">
                <span><ShieldCheck size={15} /> Sender mailbox</span>
                <select value={selectedSenderEmail} onChange={(e) => setSelectedSenderEmail(e.target.value)} required>
                  {senderAccounts.map((sender) => <option key={sender.address} value={sender.address}>{sender.label} — {sender.address}</option>)}
                </select>
              </label>
              {selectedSender && <small>Sending as <strong>{selectedSender.name || selectedSender.label}</strong> · Replies return to this mailbox.</small>}
              <div className="outreach-sent-assurance"><CheckCircle2 size={17} /><span>Every successful email is automatically archived in this mailbox’s Sent folder.</span></div>
              {!senderAccounts.length && <p className="muted">No configured sender mailbox is assigned to this account.</p>}
            </div>
            <div className="outreach-compose-fields">
              <label><span>Campaign template</span><select className="crm-preset-select" value={campaignPreset} onChange={(e) => applyCampaignPreset(e.target.value)}>{candidateTemplatePresets.map((preset) => <option key={preset.label}>{preset.label}</option>)}</select></label>
              <label><span>Email subject</span><input placeholder="A clear, professional subject" value={outreach.subject} onChange={(e) => setOutreach({ ...outreach, subject: e.target.value })} required /></label>
              <label><span>Email message</span><textarea rows="8" value={outreach.message} onChange={(e) => setOutreach({ ...outreach, message: e.target.value })} required /><small>{outreach.message.length.toLocaleString()} characters</small></label>
            </div>
            {sendReport && (
              <div className={`outreach-send-report${sendReport.running ? " running" : sendReport.problems ? " problems" : " done"}`} aria-live="polite">
                <div className="outreach-send-report-head">
                  <strong>{sendReport.running ? "Sending in progress" : "Last send report"}</strong>
                  <span>{sendReport.running ? `${sendReport.done} of ${sendReport.total} processed` : `${new Date(sendReport.finishedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`}</span>
                  {!sendReport.running && <button type="button" aria-label="Hide send report" onClick={() => setSendReport(null)}><X size={14} /></button>}
                </div>
                {sendReport.running && <div className="outreach-send-report-bar"><i style={{ width: `${sendReport.total ? Math.round((sendReport.done / sendReport.total) * 100) : 0}%` }} /></div>}
                <div className="outreach-send-report-grid">
                  <div><span>Selected</span><strong>{sendReport.total}</strong></div>
                  <div className="ok"><span>Sent</span><strong>{sendReport.sent}</strong></div>
                  {sendReport.running && <div className={sendReport.total - sendReport.done ? "pending" : ""}><span>Remaining</span><strong>{Math.max(sendReport.total - sendReport.done, 0)}</strong></div>}
                  {!sendReport.running && <div><span>Saved to Sent folder</span><strong>{sendReport.archived}</strong></div>}
                  {!sendReport.running && <div><span>Skipped</span><strong>{sendReport.skipped}</strong></div>}
                  {!sendReport.running && <div className={sendReport.failed ? "bad" : ""}><span>Failed</span><strong>{sendReport.failed}</strong></div>}
                  {!sendReport.running && <div className={sendReport.unsent ? "bad" : ""}><span>Still selected</span><strong>{sendReport.unsent}</strong></div>}
                </div>
                {!sendReport.running && <p>{sendReport.summary}</p>}
              </div>
            )}
            <div className="outreach-compose-footer">
              <span>{selectedCount ? `Ready to email ${selectedCount} candidate${selectedCount === 1 ? "" : "s"}.` : "Select candidates from the table to enable sending."}</span>
              <button className={`button${sending ? " is-loading" : ""}`} type="submit" disabled={sending || !canSend || !selectedCount || !selectedSenderEmail} title={canSend ? undefined : "Your account does not have permission to send bulk emails"}>{sending && <span className="button-spinner" aria-hidden="true" />}<Send size={17} /><span>{sending ? "Sending emails..." : "Send Personalised Emails"}</span></button>
            </div>
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
          <strong className={loading ? "talent-count is-loading" : "talent-count"}>{Number(pagination.total || 0).toLocaleString()} matching records</strong>
        </div>
        <form className="form-grid talent-filter-form" onSubmit={applyFilters}>
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
            <span>Distance radius</span>
            <select value={filters.radiusMiles} onChange={(e) => setFilters({ ...filters, radiusMiles: e.target.value })}>
              <option value="">Prefix / exact postcode match</option>
              <option value="20">Within 20 miles</option>
              <option value="30">Within 30 miles</option>
              <option value="50">Within 50 miles</option>
            </select>
          </label>
          <label className="filter-field">
            <span>Status</span>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All statuses</option>
              {candidateStatuses.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="filter-field">
            <span>Visa status</span>
            <input placeholder="e.g. British, ILR, Student" value={filters.visaStatus} onChange={(e) => setFilters({ ...filters, visaStatus: e.target.value })} />
          </label>
          <label className="filter-field">
            <span>Availability</span>
            <input placeholder="e.g. Immediate, 2 weeks, weekends" value={filters.availability} onChange={(e) => setFilters({ ...filters, availability: e.target.value })} />
          </label>
          {(validPostcodePrefixes(filters.postcode).length > 0 || loadingPostcodeRoles) && (
            <div className="postcode-role-picker">
              <div className="postcode-role-picker-heading">
                <div>
                  <strong>
                    {postcodeRoleMeta?.enabled
                      ? `Roles within ${postcodeRoleMeta.radiusMiles} miles of ${postcodeRoleMeta.postcode}`
                      : `Roles in ${validPostcodePrefixes(filters.postcode).join(", ")}`}
                  </strong>
                  <span>
                    {loadingPostcodeRoles
                      ? "Checking candidate roles..."
                      : `${postcodeRoles.filter((item) => item.count > 0).length} local roles; ${postcodeRoles.length} overall across Talent Pool and CV Uploads. ${selectedPostcodeRoles.length ? `${selectedPostcodeRoles.length} selected, the Talent Pool list below is filtered.` : "Local and established high-volume roles are shown first; search finds every imported title."}`}
                  </span>
                </div>
                {!!postcodeRoles.length && (
                  <div className="postcode-role-picker-actions">
                    {postcodeRoles.length > 8 && (
                      <label className="postcode-role-find">
                        <Search size={14} />
                        <input placeholder="Find a role" value={roleQuery} onChange={(event) => setRoleQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") event.preventDefault(); }} />
                      </label>
                    )}
                    <button type="button" onClick={() => applyRoles(visibleRoles.map((item) => item.label))}>{roleQuery.trim() ? "Select shown" : "Select all"}</button>
                    <button type="button" disabled={!selectedPostcodeRoles.length} onClick={() => applyRoles([])}>Clear</button>
                    {!roleSearch && (postcodeRoles.length > visibleRoles.length || rolesExpanded) ? (
                      <button type="button" aria-expanded={rolesExpanded} onClick={() => setRolesExpanded((value) => !value)}>
                        {rolesExpanded ? "Show focused roles" : `Show all ${postcodeRoles.length}`}
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
              {!loadingPostcodeRoles && visibleRoles.length > 0 && (
                <div className="postcode-role-options">
                  {visibleRoles.map((item) => (
                    <label className={selectedPostcodeRoles.includes(item.label) ? "selected" : ""} key={item.key} title={item.label}>
                      <input
                        type="checkbox"
                        checked={selectedPostcodeRoles.includes(item.label)}
                        onChange={() => togglePostcodeRole(item.label)}
                      />
                      <span>{cleanRole(item.label)}</span>
                      <small title={`${Number(item.count).toLocaleString()} local profiles; ${Number(item.totalCount || item.count).toLocaleString()} overall across Talent Pool and CV Uploads`}>
                        {item.count > 0 ? `${Number(item.count).toLocaleString()} local` : `${Number(item.totalCount || 0).toLocaleString()} total`}
                      </small>
                    </label>
                  ))}
                </div>
              )}
              {canViewCvUploads && selectedCvUploadRole && (
                <div className="postcode-role-source-note">
                  <span><strong>{Number(selectedCvUploadRole.cvUploadTotal).toLocaleString()}</strong> matching direct CV upload{selectedCvUploadRole.cvUploadTotal === 1 ? "" : "s"} are stored in Candidate Intake.</span>
                  <button type="button" onClick={() => navigate(`/admin/cv-uploads?role=${encodeURIComponent(selectedCvUploadRole.label)}`)}>Review CV uploads</button>
                </div>
              )}
              {!loadingPostcodeRoles && postcodeRoles.length > 0 && !visibleRoles.length && (
                <p className="postcode-role-empty">No role matches "{roleQuery}".</p>
              )}
              {!loadingPostcodeRoles && !postcodeRoles.length && (
                <p className="postcode-role-empty">
                  {postcodeRoleMeta?.enabled
                    ? "No candidate roles were found inside this radius."
                    : "No candidate roles were found for these postcode prefixes."}
                </p>
              )}
            </div>
          )}
          {pagination.radiusMeta && (
            <div className={`postcode-radius-banner${pagination.radiusMeta.warning ? " warning" : ""}`}>
              <MapPin size={18} />
              <div>
                <strong>{pagination.radiusMeta.enabled ? `Showing candidates within ${pagination.radiusMeta.radiusMiles} miles of ${pagination.radiusMeta.postcode}` : "Postcode prefix mode active"}</strong>
                <span>
                  {pagination.radiusMeta.warning ||
                    `${Number(pagination.radiusMeta.matchedCandidates || 0).toLocaleString()} candidates matched across ${Number(pagination.radiusMeta.outcodeMatches || 0).toLocaleString()} nearby postcode areas${pagination.radiusMeta.areaFallback ? `, with ${pagination.radiusMeta.areaFallback} area fallback applied` : ""}.`}
                </span>
              </div>
            </div>
          )}
          <div className="talent-filter-actions">
            <button className="button">
              Apply filters
            </button>
            <button className="button secondary" type="button" onClick={resetFilters}>Reset filters</button>
          </div>
        </form>
      </section>

      <section className={`crm-selection-bar${selectedCount ? " active" : ""}`}>
        <div>
          <strong>{selectedCount ? `${selectedCount} selected` : "Campaign control"}</strong>
          <span>{selectedCount ? "Update status or send a personalised campaign to selected candidates." : "Select visible records or individual candidates from the table to start an action."}</span>
        </div>
        <div className="crm-selection-actions">
          <button className="button secondary small" type="button" onClick={selectVisible} disabled={!candidates.length}>Select visible</button>
          <button className="button secondary small" type="button" onClick={clearSelection} disabled={!selectedCount}>Clear</button>
          <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} disabled={!selectedCount}>
            {candidateStatuses.map((item) => <option key={item}>{item}</option>)}
          </select>
          <button className="button small" type="button" onClick={updateSelectedStatus} disabled={!selectedCount}>Update status</button>
        </div>
      </section>

      <div className="table-wrap talent-table">
        <table>
          <colgroup>
            <col className="talent-col-select" />
            <col className="talent-col-candidate" />
            <col className="talent-col-role" />
            <col className="talent-col-availability" />
            <col className="talent-col-status" />
            <col className="talent-col-contact" />
            <col className="talent-col-actions" />
          </colgroup>
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
                <td><input type="checkbox" aria-label={`Select ${candidate.name}`} checked={selectedIds.includes(candidate._id)} onChange={() => toggleSelected(candidate._id)} /></td>
                <td>
                  <div className="candidate-cell">
                    <span className="candidate-avatar">{String(candidate.name || "?").slice(0, 1).toUpperCase()}</span>
                    <div>
                      <strong>{candidate.name}</strong>
                      <span className="candidate-record-id">IRG-{String(candidate._id).slice(-8).toUpperCase()} {candidate.cv?.originalName ? "· CV attached" : "· No CV"}</span>
                      <span className="muted">{candidate.email || "No email"} &middot; {candidate.phone || "No phone"}</span>
                    </div>
                  </div>
                </td>
                <td>{candidate.desiredRole || "-"}<br /><span className="muted">{candidate.postcode || candidate.city || "-"}{candidate.distanceMiles !== undefined && candidate.distanceMiles !== null ? ` · ${candidate.distanceMiles} miles` : ""}</span></td>
                <td>{candidate.visaStatus || "-"}<br /><span className="muted">{candidate.availability || candidate.shiftPreference || "-"}</span></td>
                <td><span className="status-chip table-chip">{candidate.status}</span></td>
                <td>{formatDate(candidate.lastContactedAt)}</td>
                <td className="talent-actions-cell">
                  <div className="talent-action-dock" aria-label={`Actions for ${candidate.name}`}>
                    <button className="talent-row-action history" type="button" title={`Open communication history for ${candidate.name}`} onClick={() => navigate(`/admin/candidate-communications?candidate=${candidate._id}`)}><MessageSquareText size={15} /><span>History</span></button>
                    <button className="talent-row-action call" type="button" title={`Call ${candidate.name}`} onClick={() => startCandidateCall(candidate)} disabled={!candidate.phone}><PhoneCall size={15} /><span>Call</span></button>
                    <button className="talent-row-action edit" type="button" title={`Edit ${candidate.name}`} onClick={() => { setEditing(candidate._id); setForm(fromCandidate(candidate)); setCandidateCv(null); window.scrollTo({ top: 0, behavior: "smooth" }); }}><Pencil size={15} /><span>Edit</span></button>
                    <button className="talent-row-action delete" type="button" title={`Delete ${candidate.name}`} onClick={() => removeCandidate(candidate._id)}><Trash2 size={15} /><span>Delete</span></button>
                  </div>
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
    </div>
  );
}
