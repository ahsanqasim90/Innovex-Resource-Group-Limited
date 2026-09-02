import { useEffect, useMemo, useState } from "react";
import { Archive, CheckCircle2, Eye, FileCheck2, MailCheck, MailPlus, RefreshCw, Send, ShieldCheck, UsersRound } from "lucide-react";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { hasPermission } from "../../auth/permissions.js";
import StatusMessage from "../../components/StatusMessage.jsx";

const interests = ["Recruitment", "Training", "Website Development", "SEO", "Reg 44", "Business Growth", "General"];
const subscriberTypes = ["Corporate", "Individual", "Sole trader", "Ordinary partnership"];

const blankCampaign = {
  internalName: "",
  subject: "",
  preheader: "",
  headline: "Practical support for stronger care and business services",
  introduction: "Here is this month's concise update from Innovex Resource Group Limited, created to help your organisation recruit, train and grow with confidence.",
  insightTitle: "This month's focus",
  insightBody: "Share one useful insight, service update or client success story here. Keep it specific, helpful and easy to scan.",
  ctaLabel: "Speak to the Innovex team",
  ctaUrl: "https://www.innovexresourcegroup.co.uk/contact",
  serviceFocus: ["Recruitment", "Training"],
  senderEmail: "",
  audience: { subscriberTypes: ["Corporate"], interests: [] },
  archivePublished: true
};

const blankSubscriber = {
  email: "",
  firstName: "",
  lastName: "",
  companyName: "",
  subscriberType: "Corporate",
  interests: ["General"],
  status: "Subscribed",
  lawfulBasis: "Legitimate interests",
  basisEvidence: "",
  liaReference: "",
  consentObtainedAt: "",
  privacyNoticeSentAt: "",
  source: "Admin entry",
  suppressionReason: ""
};

function toggle(list, value) {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function dateTime(value) {
  return value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "—";
}

function campaignPreview(form) {
  return (
    <div className="newsletter-preview-frame">
      <div className="newsletter-preview-topline" />
      <header>
        <small>INNOVEX RESOURCE GROUP LIMITED</small>
        <h2>{form.headline || "Your newsletter headline"}</h2>
      </header>
      <div className="newsletter-preview-body">
        <p>Hello,</p>
        <p>{form.introduction || "Your introduction will appear here."}</p>
        {form.insightTitle && <section><h3>{form.insightTitle}</h3><p>{form.insightBody}</p></section>}
        {!!form.serviceFocus.length && <div className="newsletter-preview-links">{form.serviceFocus.map((item) => <span key={item}>{item} <b>→</b></span>)}</div>}
        <span className="newsletter-preview-cta">{form.ctaLabel || "Call to action"}</span>
      </div>
      <footer>
        <strong>Innovex Resource Group Limited</strong>
        <span>33 Forsythia Drive, Cardiff, CF23 7HP</span>
        <span>Privacy notice · LinkedIn · Instagram · Unsubscribe</span>
      </footer>
    </div>
  );
}

export default function AdminNewsletterCentre() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "newsletters.manage");
  const [tab, setTab] = useState("compose");
  const [summary, setSummary] = useState({ recent: [] });
  const [senders, setSenders] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [campaign, setCampaign] = useState(blankCampaign);
  const [subscriber, setSubscriber] = useState(blankSubscriber);
  const [editingSubscriber, setEditingSubscriber] = useState(null);
  const [audience, setAudience] = useState(null);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");

  const compliance = useMemo(() => [
    [Boolean(campaign.senderEmail), "Authorised sender selected"],
    [Boolean(campaign.subject.trim() && campaign.headline.trim()), "Subject and headline completed"],
    [Boolean(campaign.introduction.trim()), "Useful editorial content included"],
    [campaign.ctaUrl.startsWith("https://"), "Secure HTTPS call-to-action"],
    [Boolean(campaign.audience.subscriberTypes.length || campaign.audience.interests.length), "Audience intentionally segmented"],
    [true, campaign.archivePublished ? "Public archive enabled for indexable website content" : "Private edition selected — no public archive"]
  ], [campaign]);

  async function loadAll(nextSearch = search) {
    const query = new URLSearchParams({ limit: "100" });
    if (nextSearch) query.set("search", nextSearch);
    const [summaryData, senderData, subscriberData, campaignData] = await Promise.all([
      api("/newsletters/summary"),
      api("/newsletters/senders"),
      api(`/newsletters/subscribers?${query}`),
      api("/newsletters/campaigns")
    ]);
    setSummary(summaryData);
    setSenders(senderData.senders || []);
    setSubscribers(subscriberData.items || []);
    setCampaigns(campaignData || []);
    setCampaign((current) => ({ ...current, senderEmail: current.senderEmail || senderData.senders?.[0]?.address || "" }));
  }

  useEffect(() => {
    loadAll().catch((error) => setStatus({ type: "error", message: error.message }));
  }, []);

  async function saveCampaign() {
    setBusy(true);
    try {
      const saved = campaign._id
        ? await api(`/newsletters/campaigns/${campaign._id}`, { method: "PUT", body: campaign })
        : await api("/newsletters/campaigns", { method: "POST", body: campaign });
      setCampaign(saved);
      const estimate = await api(`/newsletters/campaigns/${saved._id}/audience`);
      setAudience(estimate);
      setStatus({ message: `${saved.campaignId} saved as a draft. ${estimate.eligible} eligible recipient${estimate.eligible === 1 ? "" : "s"}.` });
      await loadAll();
      return saved;
    } catch (error) {
      setStatus({ type: "error", message: error.message });
      return null;
    } finally { setBusy(false); }
  }

  async function sendTest() {
    const saved = campaign._id ? campaign : await saveCampaign();
    if (!saved) return;
    const to = window.prompt("Send the protected test to which email address?", user?.email || "");
    if (!to) return;
    setBusy(true);
    try {
      const result = await api(`/newsletters/campaigns/${saved._id}/test`, { method: "POST", body: { to } });
      setStatus({ message: result.message });
    } catch (error) { setStatus({ type: "error", message: error.message }); }
    finally { setBusy(false); }
  }

  async function sendCampaign() {
    const saved = campaign._id ? campaign : await saveCampaign();
    if (!saved) return;
    const estimate = await api(`/newsletters/campaigns/${saved._id}/audience`);
    setAudience(estimate);
    if (!estimate.eligible) return setStatus({ type: "error", message: "No legally eligible recipients match this audience." });
    if (!window.confirm(`Release this newsletter to ${estimate.eligible} eligible recipient(s)? ${estimate.blocked} non-compliant record(s) will be suppressed automatically.`)) return;
    setBusy(true);
    try {
      const result = await api(`/newsletters/campaigns/${saved._id}/send`, { method: "POST" });
      setStatus({ message: result.message });
      setCampaign({ ...blankCampaign, senderEmail: senders[0]?.address || "" });
      setAudience(null);
      await loadAll();
      setTab("history");
    } catch (error) { setStatus({ type: "error", message: error.message }); }
    finally { setBusy(false); }
  }

  function editCampaign(item) {
    setCampaign({ ...blankCampaign, ...item, audience: { subscriberTypes: item.audience?.subscriberTypes || [], interests: item.audience?.interests || [] } });
    setAudience(null);
    setTab("compose");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function editSubscriber(item) {
    setEditingSubscriber(item._id);
    setSubscriber({ ...blankSubscriber, ...item, consentObtainedAt: item.consentObtainedAt?.slice(0, 10) || "", privacyNoticeSentAt: item.privacyNoticeSentAt?.slice(0, 10) || "" });
  }

  async function saveSubscriber(event) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = editingSubscriber
        ? await api(`/newsletters/subscribers/${editingSubscriber}`, { method: "PUT", body: subscriber })
        : await api("/newsletters/subscribers", { method: "POST", body: subscriber });
      setStatus({ message: `${result.email} saved. ${result.compliance?.eligible ? "Eligible for matching campaigns." : `Send blocked: ${result.compliance?.reason}`}` });
      setSubscriber(blankSubscriber);
      setEditingSubscriber(null);
      await loadAll();
    } catch (error) { setStatus({ type: "error", message: error.message }); }
    finally { setBusy(false); }
  }

  return (
    <div className="newsletter-admin-page">
      <section className="newsletter-admin-hero">
        <div>
          <span className="eyebrow"><ShieldCheck size={16} /> UK GDPR & PECR controlled outreach</span>
          <h1>Newsletter Centre</h1>
          <p>Create polished client updates, link readers to Innovex services and social profiles, and release only to legally eligible contacts.</p>
        </div>
        <div className="newsletter-hero-badge"><FileCheck2 size={25} /><span>Compliance gate</span><strong>Active on every send</strong></div>
      </section>

      <StatusMessage status={status} />

      <section className="newsletter-kpis">
        <article><UsersRound /><span>Subscribed</span><strong>{summary.subscribed || 0}</strong><small>{summary.eligible || 0} send-ready</small></article>
        <article><CheckCircle2 /><span>Eligible</span><strong>{summary.eligible || 0}</strong><small>Evidence verified</small></article>
        <article><ShieldCheck /><span>Automatically blocked</span><strong>{(summary.blocked || 0) + (summary.suppressed || 0)}</strong><small>Preferences protected</small></article>
        <article><MailCheck /><span>Campaigns</span><strong>{summary.campaigns || 0}</strong><small>Auditable releases</small></article>
      </section>

      <nav className="newsletter-tabs" aria-label="Newsletter workspace">
        <button className={tab === "compose" ? "active" : ""} onClick={() => setTab("compose")}><MailPlus size={17} /> Compose</button>
        <button className={tab === "subscribers" ? "active" : ""} onClick={() => setTab("subscribers")}><UsersRound size={17} /> Subscribers</button>
        <button className={tab === "history" ? "active" : ""} onClick={() => setTab("history")}><Archive size={17} /> Campaign history</button>
      </nav>

      {tab === "compose" && <div className="newsletter-compose-layout">
        <section className="card newsletter-composer">
          <div className="newsletter-section-title"><div><span className="eyebrow">Campaign editor</span><h2>{campaign._id ? `Edit ${campaign.campaignId}` : "Create a client newsletter"}</h2></div><span className="status-chip soft">{campaign.status || "Draft"}</span></div>
          <div className="form-grid">
            <label>Internal campaign name<input value={campaign.internalName} onChange={(e) => setCampaign({ ...campaign, internalName: e.target.value })} placeholder="September client briefing" /></label>
            <label>Authorised sender<select value={campaign.senderEmail} onChange={(e) => setCampaign({ ...campaign, senderEmail: e.target.value })}><option value="">Select mailbox</option>{senders.map((item) => <option key={item.address} value={item.address}>{item.label} — {item.address}</option>)}</select></label>
          </div>
          <label>Email subject<input value={campaign.subject} onChange={(e) => setCampaign({ ...campaign, subject: e.target.value })} placeholder="A practical update for care and business leaders" /></label>
          <label>Inbox preview text<input value={campaign.preheader} onChange={(e) => setCampaign({ ...campaign, preheader: e.target.value })} placeholder="Recruitment, training and digital growth insights from Innovex" /></label>
          <label>Main headline<input value={campaign.headline} onChange={(e) => setCampaign({ ...campaign, headline: e.target.value })} /></label>
          <label>Opening message<textarea rows="5" value={campaign.introduction} onChange={(e) => setCampaign({ ...campaign, introduction: e.target.value })} /></label>
          <div className="form-grid">
            <label>Insight heading<input value={campaign.insightTitle} onChange={(e) => setCampaign({ ...campaign, insightTitle: e.target.value })} /></label>
            <label>Call-to-action label<input value={campaign.ctaLabel} onChange={(e) => setCampaign({ ...campaign, ctaLabel: e.target.value })} /></label>
          </div>
          <label>Insight / service update<textarea rows="7" value={campaign.insightBody} onChange={(e) => setCampaign({ ...campaign, insightBody: e.target.value })} /></label>
          <label>Call-to-action HTTPS link<input value={campaign.ctaUrl} onChange={(e) => setCampaign({ ...campaign, ctaUrl: e.target.value })} /></label>

          <fieldset className="newsletter-choice-group"><legend>Featured services</legend><div>{interests.filter((item) => item !== "General").map((item) => <label key={item}><input type="checkbox" checked={campaign.serviceFocus.includes(item)} onChange={() => setCampaign({ ...campaign, serviceFocus: toggle(campaign.serviceFocus, item) })} /> {item}</label>)}</div></fieldset>
          <fieldset className="newsletter-choice-group"><legend>Audience type</legend><div>{subscriberTypes.map((item) => <label key={item}><input type="checkbox" checked={campaign.audience.subscriberTypes.includes(item)} onChange={() => setCampaign({ ...campaign, audience: { ...campaign.audience, subscriberTypes: toggle(campaign.audience.subscriberTypes, item) } })} /> {item}</label>)}</div></fieldset>
          <fieldset className="newsletter-choice-group"><legend>Interest segment (leave empty for all interests)</legend><div>{interests.map((item) => <label key={item}><input type="checkbox" checked={campaign.audience.interests.includes(item)} onChange={() => setCampaign({ ...campaign, audience: { ...campaign.audience, interests: toggle(campaign.audience.interests, item) } })} /> {item}</label>)}</div></fieldset>
          <label className="newsletter-public-toggle"><input type="checkbox" checked={campaign.archivePublished} onChange={(e) => setCampaign({ ...campaign, archivePublished: e.target.checked })} /><span><strong>Publish a website archive after sending</strong><small>Creates a crawlable public page; email links themselves are not direct SEO backlinks.</small></span></label>
          {audience && <div className="newsletter-audience-estimate"><strong>{audience.eligible} eligible</strong><span>{audience.blocked} blocked by compliance rules</span><span>{audience.total} matched records</span></div>}
          <div className="newsletter-compose-actions">
            <button className="button secondary" type="button" disabled={busy || !canManage} onClick={saveCampaign}><FileCheck2 size={17} /> Save draft</button>
            <button className="button secondary" type="button" disabled={busy || !canManage || !campaign._id} onClick={sendTest}><Eye size={17} /> Send test</button>
            <button className="button" type="button" disabled={busy || !canManage || compliance.some(([valid]) => !valid)} onClick={sendCampaign}><Send size={17} /> Review & release</button>
          </div>
          {!canManage && <p className="newsletter-permission-note">Your account can review newsletters but cannot create or send campaigns.</p>}
        </section>

        <aside className="newsletter-preview-column">
          <div className="card newsletter-compliance-card"><span className="eyebrow"><ShieldCheck size={15} /> Send readiness</span><h2>UK compliance checks</h2><div>{compliance.map(([valid, label]) => <p className={valid ? "passed" : "pending"} key={label}>{valid ? <CheckCircle2 size={17} /> : <span>!</span>}{label}</p>)}</div><small>Unsubscribed, suppressed and incomplete lawful-basis records are removed again at the exact moment of sending.</small></div>
          <div className="card newsletter-live-preview"><span className="eyebrow"><Eye size={15} /> Responsive preview</span><h2>Client email</h2>{campaignPreview(campaign)}</div>
        </aside>
      </div>}

      {tab === "subscribers" && <div className="newsletter-subscriber-layout">
        <form className="card newsletter-subscriber-form" onSubmit={saveSubscriber}>
          <span className="eyebrow">Consent & lawful basis register</span><h2>{editingSubscriber ? "Update recipient" : "Add a recipient"}</h2>
          <p className="muted">Do not guess the subscriber type. Sole traders and ordinary partnerships are treated like individuals under PECR.</p>
          <label>Email<input type="email" required value={subscriber.email} onChange={(e) => setSubscriber({ ...subscriber, email: e.target.value })} /></label>
          <div className="form-grid"><label>First name<input value={subscriber.firstName} onChange={(e) => setSubscriber({ ...subscriber, firstName: e.target.value })} /></label><label>Last name<input value={subscriber.lastName} onChange={(e) => setSubscriber({ ...subscriber, lastName: e.target.value })} /></label></div>
          <label>Company<input value={subscriber.companyName} onChange={(e) => setSubscriber({ ...subscriber, companyName: e.target.value })} /></label>
          <div className="form-grid"><label>Subscriber type<select value={subscriber.subscriberType} onChange={(e) => setSubscriber({ ...subscriber, subscriberType: e.target.value })}>{subscriberTypes.map((item) => <option key={item}>{item}</option>)}</select></label><label>Status<select value={subscriber.status} onChange={(e) => setSubscriber({ ...subscriber, status: e.target.value })}><option>Subscribed</option><option>Unsubscribed</option><option>Suppressed</option><option>Bounced</option></select></label></div>
          <label>Lawful basis<select value={subscriber.lawfulBasis} onChange={(e) => setSubscriber({ ...subscriber, lawfulBasis: e.target.value })}><option>Not recorded</option><option>Consent</option><option>Soft opt-in</option><option>Legitimate interests</option></select></label>
          <label>Evidence / source detail<textarea rows="4" required value={subscriber.basisEvidence} onChange={(e) => setSubscriber({ ...subscriber, basisEvidence: e.target.value })} placeholder="Record exactly when, where and how consent/soft opt-in arose, or the specific B2B purpose and reasonable expectation." /></label>
          {subscriber.lawfulBasis === "Legitimate interests" && <label>LIA reference<input required value={subscriber.liaReference} onChange={(e) => setSubscriber({ ...subscriber, liaReference: e.target.value })} placeholder="e.g. LIA-B2B-2026-04" /></label>}
          <div className="form-grid"><label>Consent / soft opt-in date<input type="date" value={subscriber.consentObtainedAt} onChange={(e) => setSubscriber({ ...subscriber, consentObtainedAt: e.target.value })} /></label><label>Privacy notice provided<input type="date" required value={subscriber.privacyNoticeSentAt} onChange={(e) => setSubscriber({ ...subscriber, privacyNoticeSentAt: e.target.value })} /></label></div>
          <fieldset className="newsletter-choice-group"><legend>Interests</legend><div>{interests.map((item) => <label key={item}><input type="checkbox" checked={subscriber.interests.includes(item)} onChange={() => setSubscriber({ ...subscriber, interests: toggle(subscriber.interests, item) })} /> {item}</label>)}</div></fieldset>
          {(subscriber.status === "Suppressed" || subscriber.status === "Bounced") && <label>Suppression reason<textarea required value={subscriber.suppressionReason} onChange={(e) => setSubscriber({ ...subscriber, suppressionReason: e.target.value })} /></label>}
          <div className="newsletter-compose-actions"><button className="button" disabled={busy || !canManage}>{editingSubscriber ? "Update record" : "Add recipient"}</button>{editingSubscriber && <button className="button secondary" type="button" onClick={() => { setEditingSubscriber(null); setSubscriber(blankSubscriber); }}>Cancel</button>}</div>
        </form>
        <section className="card newsletter-subscriber-register">
          <div className="newsletter-section-title"><div><span className="eyebrow">Suppression-aware register</span><h2>Newsletter recipients</h2></div><button className="icon-button" type="button" onClick={() => loadAll()} aria-label="Refresh"><RefreshCw size={18} /></button></div>
          <form className="newsletter-search" onSubmit={(e) => { e.preventDefault(); loadAll(search); }}><input placeholder="Search name, company or email" value={search} onChange={(e) => setSearch(e.target.value)} /><button className="button secondary">Search</button></form>
          <div className="newsletter-subscriber-cards">{subscribers.map((item) => <article key={item._id}>
            <div><strong>{[item.firstName, item.lastName].filter(Boolean).join(" ") || item.companyName || item.email}</strong><span>{item.email}</span><small>{item.companyName || item.subscriberType} · {item.lawfulBasis}</small></div>
            <div><span className={`status-chip ${item.compliance?.eligible ? "success" : "danger"}`}>{item.compliance?.eligible ? "Eligible" : "Blocked"}</span><small>{item.compliance?.reason}</small></div>
            <button type="button" className="button small secondary" disabled={!canManage} onClick={() => editSubscriber(item)}>Review</button>
          </article>)}{!subscribers.length && <p className="muted">No subscriber records found.</p>}</div>
        </section>
      </div>}

      {tab === "history" && <section className="card newsletter-history">
        <div className="newsletter-section-title"><div><span className="eyebrow"><Archive size={15} /> Campaign register</span><h2>Drafts and released newsletters</h2></div><span className="status-chip soft">{campaigns.length} records</span></div>
        <div className="table-wrap"><table><thead><tr><th>Campaign</th><th>Status</th><th>Audience result</th><th>Public archive</th><th>Sent</th><th>Action</th></tr></thead><tbody>{campaigns.map((item) => <tr key={item._id}><td><strong>{item.internalName}</strong><br /><span className="muted">{item.campaignId} · {item.subject}</span></td><td><span className={`status-chip ${item.status === "Sent" ? "success" : item.status === "Partially sent" ? "warning" : "soft"}`}>{item.status}</span></td><td>{item.totals?.sent || 0} sent · {item.totals?.failed || 0} failed<br /><span className="muted">{item.totals?.suppressed || 0} suppressed</span></td><td>{item.archivePublished && item.status !== "Draft" ? <a href={`/newsletters/${item.slug}`} target="_blank" rel="noreferrer">View page</a> : "—"}</td><td>{dateTime(item.sentAt)}</td><td>{item.status === "Draft" ? <button className="button small secondary" onClick={() => editCampaign(item)}>Edit</button> : <span className="muted">Locked audit</span>}</td></tr>)}{!campaigns.length && <tr><td colSpan="6">No campaigns yet.</td></tr>}</tbody></table></div>
      </section>}
    </div>
  );
}
