import { useEffect, useMemo, useState } from "react";
import {
  Building2,
  CheckCircle2,
  Database,
  Factory,
  Filter,
  Globe2,
  GraduationCap,
  Mail,
  MapPin,
  MessageSquareText,
  PhoneCall,
  Search,
  Send,
  UploadCloud
} from "lucide-react";
import { api } from "../../api/client.js";
import StatusMessage from "../../components/StatusMessage.jsx";
import SubmitButton from "../../components/SubmitButton.jsx";

const categories = [
  "Care Home",
  "Children Home",
  "Supported Living",
  "Healthcare Company",
  "Website Lead",
  "SEO Lead",
  "Training Lead",
  "Compliance Lead",
  "Other"
];

const statuses = ["New", "Contacted", "Interested", "Follow-up", "Converted", "Not Interested", "Do Not Contact"];

const emptyLead = {
  companyName: "",
  category: "Care Home",
  contactName: "",
  email1: "",
  email2: "",
  email3: "",
  phone: "",
  postcode: "",
  city: "",
  website: "",
  serviceInterests: "",
  status: "New",
  source: "Business Leads",
  notes: ""
};

const emptyFilters = { search: "", category: "", service: "", postcode: "", status: "" };

const emailTemplate = {
  subject: "Support for {{companyName}} from Innovex Resource Group",
  message: [
    "Hi {{contactName}},",
    "",
    "I hope you are well. I am contacting you from Innovex Resource Group Limited.",
    "",
    "We support organisations like {{companyName}} with recruitment, healthcare training, compliance support, website development and SEO growth.",
    "",
    "Would you be open to a quick conversation this week?",
    "",
    "Kind regards,",
    "Innovex Resource Group Limited"
  ].join("\n")
};

const businessTemplatePresets = [
  {
    label: "General introduction",
    subject: emailTemplate.subject,
    message: emailTemplate.message
  },
  {
    label: "Recruitment support",
    subject: "Healthcare staffing support for {{companyName}}",
    message: [
      "Hi {{contactName}},",
      "",
      "I hope you are well. Innovex Resource Group supports care providers with compliant healthcare recruitment, temporary staffing and permanent placements.",
      "",
      "If {{companyName}} needs support with care staff, nurses, managers or screening, I would be happy to arrange a quick conversation.",
      "",
      "Kind regards,",
      "Innovex Resource Group Limited"
    ].join("\n")
  },
  {
    label: "Training courses",
    subject: "Healthcare training courses for {{companyName}}",
    message: [
      "Hi {{contactName}},",
      "",
      "I hope you are well. We provide healthcare training courses for care homes and healthcare organisations, including delegate coordination, trainer details and booking support.",
      "",
      "Would you like us to send course options and pricing for {{companyName}}?",
      "",
      "Kind regards,",
      "Innovex Resource Group Limited"
    ].join("\n")
  },
  {
    label: "Website and SEO",
    subject: "Website and SEO support for {{companyName}}",
    message: [
      "Hi {{contactName}},",
      "",
      "I hope you are well. Innovex also helps care providers and local businesses improve online visibility with professional websites, local SEO and lead generation support.",
      "",
      "If {{companyName}} would like to attract more enquiries online, I would be happy to share a few practical ideas.",
      "",
      "Kind regards,",
      "Innovex Resource Group Limited"
    ].join("\n")
  },
  {
    label: "Compliance support",
    subject: "Compliance and staffing support for {{companyName}}",
    message: [
      "Hi {{contactName}},",
      "",
      "I hope you are well. We support care-sector organisations with recruitment, screening, training and compliance-aware operational support.",
      "",
      "Would a short call be useful to discuss where {{companyName}} may need support?",
      "",
      "Kind regards,",
      "Innovex Resource Group Limited"
    ].join("\n")
  }
];

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("en-GB") : "-";
}

function leadToForm(lead) {
  const emails = lead.emails || [];
  return {
    ...emptyLead,
    ...lead,
    email1: emails[0]?.email || "",
    email2: emails[1]?.email || "",
    email3: emails[2]?.email || "",
    serviceInterests: Array.isArray(lead.serviceInterests) ? lead.serviceInterests.join(", ") : ""
  };
}

function formToPayload(form) {
  return {
    companyName: form.companyName,
    category: form.category,
    contactName: form.contactName,
    emails: [form.email1, form.email2, form.email3].filter(Boolean),
    phone: form.phone,
    postcode: form.postcode,
    city: form.city,
    website: form.website,
    serviceInterests: form.serviceInterests,
    status: form.status,
    source: form.source,
    notes: form.notes
  };
}

function primaryEmail(lead) {
  return lead.emails?.find((item) => item.primary)?.email || lead.emails?.[0]?.email || "No email";
}

export default function AdminBusinessLeads() {
  const [leads, setLeads] = useState([]);
  const [stats, setStats] = useState({});
  const [filters, setFilters] = useState(emptyFilters);
  const [form, setForm] = useState(emptyLead);
  const [editing, setEditing] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0, limit: 25 });
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [sending, setSending] = useState(false);
  const [importCategory, setImportCategory] = useState("Care Home");
  const [outreach, setOutreach] = useState(emailTemplate);
  const [campaignPreset, setCampaignPreset] = useState(businessTemplatePresets[0].label);
  const [bulkStatus, setBulkStatus] = useState("Contacted");
  const [callConfig, setCallConfig] = useState({ allowedCallerIds: [] });
  const [selectedOutboundCallerId, setSelectedOutboundCallerId] = useState("");

  const selectedCount = selectedIds.length;
  const selectedService = useMemo(() => filters.service || importCategory || "Recruitment", [filters.service, importCategory]);

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
      const data = await api(`/business-leads?${queryString(page, nextFilters)}`);
      setLeads(data.items || []);
      setPagination({ page: data.page, pages: data.pages || 1, total: data.total || 0, limit: data.limit || 25 });
      setSelectedIds([]);
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setLoading(false);
    }
  }

  function loadStats() {
    api("/business-leads/stats/summary").then(setStats).catch(() => {});
  }

  useEffect(() => {
    load();
    loadStats();
    api("/calls/config/status")
      .then((data) => {
        setCallConfig(data);
        setSelectedOutboundCallerId(data.allowedCallerIds?.[0] || "");
      })
      .catch(() => {});
  }, []);

  async function saveLead(event) {
    event.preventDefault();
    setSaving(true);
    try {
      await api(editing ? `/business-leads/${editing}` : "/business-leads", {
        method: editing ? "PUT" : "POST",
        body: formToPayload(form)
      });
      setStatus({ message: editing ? "Business lead updated." : "Business lead added." });
      setForm(emptyLead);
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
    body.append("category", importCategory);
    setImporting(true);
    try {
      const result = await api("/business-leads/import", { method: "POST", body });
      const parts = [
        `${result.message}.`,
        `${Number(result.rowsRead || 0).toLocaleString()} CSV rows read.`,
        `${Number(result.uniqueLeads || 0).toLocaleString()} unique companies processed.`,
        `${Number(result.created || 0).toLocaleString()} created.`,
        `${Number(result.updated || 0).toLocaleString()} updated.`
      ];
      if (result.duplicatesMerged) parts.push(`${Number(result.duplicatesMerged).toLocaleString()} duplicate company rows merged.`);
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

  async function sendOutreach(event) {
    event.preventDefault();
    setSending(true);
    try {
      const result = await api("/business-leads/outreach", {
        method: "POST",
        body: {
          leadIds: selectedIds,
          service: selectedService,
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

  async function removeLead(id) {
    if (!confirm("Delete this business lead?")) return;
    try {
      await api(`/business-leads/${id}`, { method: "DELETE" });
      setStatus({ message: "Business lead deleted." });
      await load(pagination.page);
      loadStats();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  function applyFilters(event) {
    event.preventDefault();
    load(1, filters);
  }

  function resetFilters() {
    setFilters(emptyFilters);
    load(1, emptyFilters);
  }

  function toggleSelected(id) {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  function selectVisible() {
    setSelectedIds(leads.map((lead) => lead._id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  function applyQuickSegment(nextFilters) {
    const merged = { ...emptyFilters, ...nextFilters };
    setFilters(merged);
    if (nextFilters.category) setImportCategory(nextFilters.category);
    load(1, merged);
  }

  function applyCampaignPreset(label) {
    const preset = businessTemplatePresets.find((item) => item.label === label);
    setCampaignPreset(label);
    if (preset) setOutreach({ subject: preset.subject, message: preset.message });
  }

  async function updateSelectedStatus() {
    if (!selectedCount) return;
    try {
      const result = await api("/business-leads/bulk-status", {
        method: "PATCH",
        body: { leadIds: selectedIds, status: bulkStatus }
      });
      setStatus({ message: result.message });
      clearSelection();
      await load(pagination.page);
      loadStats();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  async function startLeadCall(lead) {
    if (!lead.phone) {
      setStatus({ type: "error", message: "This business lead does not have a phone number." });
      return;
    }
    try {
      const result = await api("/calls/start", {
        method: "POST",
        body: {
          targetType: "BusinessLead",
          targetId: lead._id,
          outboundCallerId: selectedOutboundCallerId,
          notes: `Call started from Business Leads for ${lead.category || "lead follow-up"}.`
        }
      });
      setStatus({
        type: result.yay?.ok || result.yay?.skipped ? "success" : "error",
        message: result.yay?.message || "Business call logged."
      });
      await load(pagination.page);
      loadStats();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  const summaryCards = [
    { label: "Total companies", value: stats.total || 0, Icon: Database, tone: "primary" },
    { label: "Care homes", value: stats.careHomes || 0, Icon: Building2, tone: "success" },
    { label: "Children homes", value: stats.childrenHomes || 0, Icon: Factory, tone: "blue" },
    { label: "Website leads", value: stats.websiteLeads || 0, Icon: Globe2, tone: "gold" },
    { label: "SEO leads", value: stats.seoLeads || 0, Icon: Search, tone: "purple" },
    { label: "Converted", value: stats.converted || 0, Icon: CheckCircle2, tone: "success" }
  ];

  return (
    <>
      <section className="business-hero talent-hero talent-crm-hero">
        <div className="talent-hero-copy">
          <span className="eyebrow">Business CRM</span>
          <h1><Building2 size={30} /> Business Leads</h1>
          <p>Keep care homes, children homes, healthcare companies and digital service prospects separated by niche while still managing every lead from one professional sales workspace.</p>
          <div className="talent-workflow-strip">
            <span><UploadCloud size={16} /> Import</span>
            <span><Filter size={16} /> Segment</span>
            <span><Mail size={16} /> Outreach</span>
            <span><MessageSquareText size={16} /> Follow-up</span>
          </div>
        </div>
        <div className="talent-command-card">
          <div className="talent-command-icon"><Building2 size={22} /></div>
          <span>Lead segmentation</span>
          <strong>One company, multiple contacts</strong>
          <p>Each organisation stays as one record with primary and secondary emails attached.</p>
          <div className="talent-command-mini">
            <span>{Number(stats.careHomes || 0).toLocaleString()} care</span>
            <span>{Number(stats.websiteLeads || 0).toLocaleString()} digital</span>
          </div>
        </div>
      </section>

      <StatusMessage status={status} />

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
            <div><Icon size={20} /><span>{label}</span></div>
            <strong>{Number(value || 0).toLocaleString()}</strong>
          </article>
        ))}
      </div>

      <section className="crm-segment-grid" aria-label="Business lead quick segments">
        <button type="button" className="crm-segment-card" onClick={() => applyQuickSegment({ category: "Care Home", service: "Recruitment" })}>
          <span>Care-sector sales</span>
          <strong>Care homes</strong>
          <small>Recruitment, training and compliance prospects.</small>
        </button>
        <button type="button" className="crm-segment-card" onClick={() => applyQuickSegment({ category: "Children Home" })}>
          <span>Children services</span>
          <strong>Children homes</strong>
          <small>Leadership hiring, staffing and training.</small>
        </button>
        <button type="button" className="crm-segment-card" onClick={() => applyQuickSegment({ service: "Courses" })}>
          <span>Training pipeline</span>
          <strong>Course buyers</strong>
          <small>Find organisations interested in training.</small>
        </button>
        <button type="button" className="crm-segment-card" onClick={() => applyQuickSegment({ service: "Website" })}>
          <span>Digital growth</span>
          <strong>Website / SEO</strong>
          <small>Sales list for web and visibility campaigns.</small>
        </button>
      </section>

      <div className="business-admin-grid talent-admin-grid">
        <form className="card form talent-form-card business-form-card" onSubmit={saveLead}>
          <div className="admin-form-title">
            <span><Building2 size={18} /> Company profile</span>
            <h2>{editing ? "Edit business lead" : "Add business lead"}</h2>
            <p>Add care homes, children homes, web/SEO prospects, training leads or compliance opportunities.</p>
          </div>
          <div className="form-grid">
            <input placeholder="Company / care home name" value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })} required />
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select>
            <input placeholder="Contact person" value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })} />
            <input placeholder="Primary email" type="email" value={form.email1} onChange={(e) => setForm({ ...form, email1: e.target.value })} />
            <input placeholder="Second email" type="email" value={form.email2} onChange={(e) => setForm({ ...form, email2: e.target.value })} />
            <input placeholder="Third email" type="email" value={form.email3} onChange={(e) => setForm({ ...form, email3: e.target.value })} />
            <input placeholder="Phone number" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input placeholder="Postcode" value={form.postcode} onChange={(e) => setForm({ ...form, postcode: e.target.value })} />
            <input placeholder="City / location" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            <input placeholder="Website" value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} />
            <input placeholder="Service interests e.g. Recruitment, Courses, SEO" value={form.serviceInterests} onChange={(e) => setForm({ ...form, serviceInterests: e.target.value })} />
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>{statuses.map((item) => <option key={item}>{item}</option>)}</select>
            <input placeholder="Source" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} />
          </div>
          <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          <div className="actions">
            <SubmitButton loading={saving} loadingText="Saving lead...">{editing ? "Update Lead" : "Add Lead"}</SubmitButton>
            {editing && <button className="button secondary" type="button" onClick={() => { setEditing(null); setForm(emptyLead); }}>Cancel</button>}
          </div>
        </form>

        <aside className="talent-side-stack">
          <form className="card talent-import-card" onSubmit={importCsv}>
            <div className="talent-panel-heading">
              <span><UploadCloud size={22} /></span>
              <div>
                <h2>Import business CSV</h2>
                <p>Select the niche first, then upload your sheet.</p>
              </div>
            </div>
            <select value={importCategory} onChange={(e) => setImportCategory(e.target.value)}>
              {categories.map((category) => <option key={category}>{category}</option>)}
            </select>
            <p>Use columns like Company Name, Postcode, Phone, Email 1, Email 2, Website, Service Interest and Notes. Multiple emails stay under one company record.</p>
            <input name="file" type="file" accept=".csv,text/csv" />
            <SubmitButton loading={importing} loadingText="Importing leads...">Import CSV</SubmitButton>
          </form>

          <form className="card talent-outreach-card" onSubmit={sendOutreach}>
            <div className="talent-panel-heading">
              <span><Mail size={22} /></span>
              <div>
                <h2>Business outreach</h2>
                <p>{selectedCount} compan{selectedCount === 1 ? "y" : "ies"} selected.</p>
              </div>
            </div>
            <p>Personalise with <strong>{"{{companyName}}"}</strong>, <strong>{"{{contactName}}"}</strong>, <strong>{"{{category}}"}</strong>, <strong>{"{{city}}"}</strong> and <strong>{"{{postcode}}"}</strong>.</p>
            <select className="crm-preset-select" value={campaignPreset} onChange={(e) => applyCampaignPreset(e.target.value)}>
              {businessTemplatePresets.map((preset) => <option key={preset.label}>{preset.label}</option>)}
            </select>
            <input placeholder="Email subject" value={outreach.subject} onChange={(e) => setOutreach({ ...outreach, subject: e.target.value })} required />
            <textarea rows="8" value={outreach.message} onChange={(e) => setOutreach({ ...outreach, message: e.target.value })} required />
            <button className={`button${sending ? " is-loading" : ""}`} type="submit" disabled={sending || !selectedCount}>
              {sending && <span className="button-spinner" aria-hidden="true" />}
              <span>{sending ? "Sending emails..." : "Send Business Emails"}</span>
            </button>
          </form>
        </aside>
      </div>

      <section className="card filters talent-filter-card">
        <div className="talent-section-heading">
          <div>
            <span className="eyebrow"><Filter size={15} /> Lead segmentation</span>
            <h2>Search companies by niche and service</h2>
          </div>
          <strong>{Number(pagination.total || 0).toLocaleString()} records</strong>
        </div>
        <form className="form-grid" onSubmit={applyFilters}>
          <label className="filter-field">
            <span>Search</span>
            <div className="input-with-icon"><Search size={18} /><input placeholder="Company, email, phone, website" value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} /></div>
          </label>
          <label className="filter-field">
            <span>Category</span>
            <select value={filters.category} onChange={(e) => setFilters({ ...filters, category: e.target.value })}>
              <option value="">All categories</option>
              {categories.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <label className="filter-field">
            <span>Service</span>
            <input placeholder="Recruitment, Courses, SEO" value={filters.service} onChange={(e) => setFilters({ ...filters, service: e.target.value })} />
          </label>
          <label className="filter-field">
            <span>Postcode</span>
            <div className="input-with-icon"><MapPin size={18} /><input placeholder="e.g. CF23, SO40" value={filters.postcode} onChange={(e) => setFilters({ ...filters, postcode: e.target.value })} /></div>
          </label>
          <label className="filter-field">
            <span>Status</span>
            <select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
              <option value="">All statuses</option>
              {statuses.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <button className="button">Apply Filters</button>
          <button className="button secondary" type="button" onClick={resetFilters}>Reset</button>
        </form>
      </section>

      <section className={`crm-selection-bar${selectedCount ? " active" : ""}`}>
        <div>
          <strong>{selectedCount ? `${selectedCount} selected` : "Sales action bar"}</strong>
          <span>{selectedCount ? "Move selected companies through the pipeline or send a targeted campaign." : "Select companies from the table to start an outreach or update their pipeline stage."}</span>
        </div>
        <div className="crm-selection-actions">
          <button className="button secondary small" type="button" onClick={selectVisible} disabled={!leads.length}>Select visible</button>
          <button className="button secondary small" type="button" onClick={clearSelection} disabled={!selectedCount}>Clear</button>
          <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} disabled={!selectedCount}>
            {statuses.map((item) => <option key={item}>{item}</option>)}
          </select>
          <button className="button small" type="button" onClick={updateSelectedStatus} disabled={!selectedCount}>Update stage</button>
        </div>
      </section>

      <div className="table-wrap talent-table business-table">
        <table>
          <thead>
            <tr>
              <th>Select</th>
              <th>Company</th>
              <th>Category / Services</th>
              <th>Contact</th>
              <th>Location</th>
              <th>Status</th>
              <th>Last contact</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="8">Loading business leads...</td></tr>
            ) : leads.length ? leads.map((lead) => (
              <tr key={lead._id}>
                <td><input type="checkbox" checked={selectedIds.includes(lead._id)} onChange={() => toggleSelected(lead._id)} /></td>
                <td>
                  <div className="candidate-cell">
                    <span className="candidate-avatar">{String(lead.companyName || "?").slice(0, 1).toUpperCase()}</span>
                    <div>
                      <strong>{lead.companyName}</strong>
                      <span className="muted">{lead.website || "No website"}</span>
                    </div>
                  </div>
                </td>
                <td>{lead.category}<br /><span className="muted">{lead.serviceInterests?.join(", ") || "-"}</span></td>
                <td>{lead.contactName || "-"}<br /><span className="muted">{primaryEmail(lead)} &middot; {lead.phone || "No phone"}</span></td>
                <td>{lead.postcode || "-"}<br /><span className="muted">{lead.city || "-"}</span></td>
                <td><span className="status-chip table-chip">{lead.status}</span></td>
                <td>{formatDate(lead.lastContactedAt)}</td>
                <td className="actions compact-actions">
                  <button className="button small call-action-button" onClick={() => startLeadCall(lead)} disabled={!lead.phone}><PhoneCall size={14} /> Call</button>
                  <button className="button small" onClick={() => { setEditing(lead._id); setForm(leadToForm(lead)); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
                  <button className="button secondary small" onClick={() => removeLead(lead._id)}>Delete</button>
                </td>
              </tr>
            )) : (
              <tr><td colSpan="8">No business leads found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="talent-pagination">
        <button className="button secondary" disabled={pagination.page <= 1} onClick={() => load(pagination.page - 1)}>Previous</button>
        <span>Page {pagination.page} of {pagination.pages} &middot; {Number(pagination.total || 0).toLocaleString()} companies</span>
        <button className="button secondary" disabled={pagination.page >= pagination.pages} onClick={() => load(pagination.page + 1)}>Next</button>
      </div>
    </>
  );
}
