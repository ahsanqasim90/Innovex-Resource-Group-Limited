import { useEffect, useMemo, useState } from "react";
import { BriefcaseBusiness, Building2, Copy, ExternalLink, Handshake, KeyRound, Send, ShieldCheck, Trash2, UserRoundCheck, UsersRound } from "lucide-react";
import { api } from "../../api/client.js";
import AdminSectionHero from "../../components/AdminSectionHero.jsx";
import StatusMessage from "../../components/StatusMessage.jsx";

const emptyData = { accounts: [], candidates: [], clients: [], partners: [], jobs: [] };

function subjectEmail(type, subject) {
  if (!subject) return "";
  if (type === "Candidate") return subject.email || "";
  if (type === "Partner") return subject.contactEmail || "";
  return subject.primaryContact?.email || subject.contacts?.find((item) => item.email)?.email || "";
}

export default function AdminPortals() {
  const [data, setData] = useState(emptyData);
  const [type, setType] = useState("Candidate");
  const [subjectId, setSubjectId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [sharedJobIds, setSharedJobIds] = useState([]);
  const [status, setStatus] = useState(null);
  const [latestLink, setLatestLink] = useState("");
  const [savingShares, setSavingShares] = useState(false);

  const options = useMemo(() => {
    if (type === "Candidate") return data.candidates;
    if (type === "Client") return data.clients;
    return data.partners;
  }, [data, type]);

  async function load() {
    try { setData(await api("/portal-admin")); }
    catch (error) { setStatus({ type: "error", message: error.message }); }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (!partnerId) return setSharedJobIds([]);
    setSharedJobIds(data.jobs
      .filter((job) => (job.partnerShares || []).some((share) => String(share.partner?._id || share.partner) === partnerId))
      .map((job) => job._id));
  }, [data.jobs, partnerId]);

  function chooseType(nextType) {
    setType(nextType);
    setSubjectId("");
    setInviteEmail("");
  }

  function chooseSubject(nextSubjectId) {
    setSubjectId(nextSubjectId);
    setInviteEmail(subjectEmail(type, options.find((item) => item._id === nextSubjectId)));
  }

  async function invite(event) {
    event.preventDefault();
    const subject = options.find((item) => item._id === subjectId);
    const email = inviteEmail.trim();
    if (!subject || !email) return setStatus({ type: "error", message: `Select a ${type.toLowerCase()} record with a valid email address.` });
    try {
      const result = await api("/portal-admin/invite", { method: "POST", body: { type, subjectId, name: subject.name, email } });
      setLatestLink(result.invitationUrl);
      setStatus({ message: result.message });
      setSubjectId("");
      setInviteEmail("");
      load();
    } catch (error) { setStatus({ type: "error", message: error.message }); }
  }

  async function saveVacancyAccess() {
    if (!partnerId) return setStatus({ type: "error", message: "Select a recruitment partner first." });
    setSavingShares(true);
    try {
      const result = await api(`/portal-admin/partners/${partnerId}/vacancies`, { method: "PATCH", body: { jobIds: sharedJobIds } });
      setStatus({ message: result.message });
      await load();
    } catch (error) { setStatus({ type: "error", message: error.message }); }
    finally { setSavingShares(false); }
  }

  async function changeStatus(account, next) {
    try {
      const result = await api(`/portal-admin/${account._id}/status`, { method: "PATCH", body: { status: next } });
      setStatus({ message: result.message });
      load();
    } catch (error) { setStatus({ type: "error", message: error.message }); }
  }

  async function deleteAccount(account) {
    const confirmed = window.confirm(`Delete ${account.type.toLowerCase()} portal access for ${account.name}?\n\nThey will be signed out immediately. Their linked CRM record and recruitment history will not be deleted.`);
    if (!confirmed) return;
    try {
      const result = await api(`/portal-admin/${account._id}`, { method: "DELETE" });
      setStatus({ message: result.message });
      await load();
    } catch (error) { setStatus({ type: "error", message: error.message }); }
  }

  return <div className="portal-admin-page">
    <AdminSectionHero icon={KeyRound} eyebrow="Secure collaboration" title="Candidate, Client & Partner Portals" description="Control external access, partner vacancy visibility and recruitment collaboration without exposing the internal CRM." aside={<div className="workspace-hero-count"><UsersRound size={18} /><span><small>ACTIVE PORTALS</small><strong>{data.accounts.filter((account) => account.status === "Active").length}</strong></span></div>} />
    <StatusMessage status={status} />

    <section className="portal-invite-card">
      <header><div><small>NEW SECURE ACCESS</small><h2>Invite to a portal</h2><p>Activation links expire after seven days. Existing sessions are revoked when access changes.</p></div><ShieldCheck /></header>
      <form onSubmit={invite}>
        <label><span>Portal type</span><div className="portal-type-toggle">
          <button type="button" className={type === "Candidate" ? "active" : ""} onClick={() => chooseType("Candidate")}><UserRoundCheck />Candidate</button>
          <button type="button" className={type === "Client" ? "active" : ""} onClick={() => chooseType("Client")}><Building2 />Client</button>
          <button type="button" className={type === "Partner" ? "active" : ""} onClick={() => chooseType("Partner")}><Handshake />Partner</button>
        </div></label>
        <label><span>{type} record</span><select value={subjectId} onChange={(event) => chooseSubject(event.target.value)} required><option value="">Select {type.toLowerCase()}</option>{options.map((item) => <option value={item._id} key={item._id}>{item.name} · {subjectEmail(type, item) || "Email to be entered"}</option>)}</select></label>
        <label><span>Invitation email</span><input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder={`Enter ${type.toLowerCase()} contact email`} required /></label>
        <button className="button"><Send />Send secure invitation</button>
      </form>
      {latestLink && <div className="portal-link-result"><div><strong>Latest activation link</strong><span>Email delivery may depend on SMTP configuration. Copy it securely if needed.</span></div><button onClick={() => navigator.clipboard.writeText(latestLink)}><Copy />Copy link</button><a href={latestLink} target="_blank" rel="noreferrer"><ExternalLink />Open</a></div>}
    </section>

    <section className="partner-vacancy-access">
      <header><div><small>PARTNER VACANCY ACCESS</small><h2>Choose exactly which vacancies a partner can see</h2><p>Unselected vacancies remain completely hidden from that partner’s portal.</p></div><Handshake /></header>
      <div className="partner-access-controls"><label><span>Recruitment partner</span><select value={partnerId} onChange={(event) => setPartnerId(event.target.value)}><option value="">Select partner</option>{data.partners.map((partner) => <option key={partner._id} value={partner._id}>{partner.name}</option>)}</select></label><div><strong>{sharedJobIds.length}</strong><span>vacancies selected</span></div></div>
      {partnerId && <div className="partner-job-share-grid">{data.jobs.map((job) => <label className={sharedJobIds.includes(job._id) ? "selected" : ""} key={job._id}><input type="checkbox" checked={sharedJobIds.includes(job._id)} onChange={(event) => setSharedJobIds((current) => event.target.checked ? [...current, job._id] : current.filter((id) => id !== job._id))} /><span><BriefcaseBusiness /><span><strong>{job.title}</strong><small>{[job.reference, job.location, `${job.openings || 1} opening(s)`].filter(Boolean).join(" · ")}</small></span></span></label>)}</div>}
      {partnerId && !data.jobs.length && <div className="portal-empty">No approved, open vacancies are currently available to share.</div>}
      <footer><span>Changes apply immediately to the selected partner portal.</span><button className="button" type="button" disabled={!partnerId || savingShares} onClick={saveVacancyAccess}>{savingShares ? "Saving access…" : "Save vacancy access"}</button></footer>
    </section>

    <section className="portal-account-register">
      <header><div><small>ACCESS REGISTER</small><h2>External portal accounts</h2></div><strong>{data.accounts.length}</strong></header>
      <div><div className="portal-account-head"><span>Person</span><span>Portal</span><span>Linked record</span><span>Status</span><span>Last sign-in</span><span>Actions</span></div>{data.accounts.map((account) => <article key={account._id}><span><strong>{account.name}</strong><small>{account.email}</small></span><span><b className={`portal-kind ${account.type.toLowerCase()}`}>{account.type}</b></span><span>{account.candidate?.name || account.clientAccount?.name || account.partner?.name || "Record unavailable"}</span><span><b className={`portal-access-status ${account.status.toLowerCase()}`}>{account.status}</b></span><span>{account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleDateString("en-GB") : "Never"}</span><span className="portal-account-actions">{account.status === "Active" ? <button onClick={() => changeStatus(account, "Suspended")}>Suspend</button> : account.status === "Suspended" ? <button onClick={() => changeStatus(account, "Active")}>Reactivate</button> : <small>Invitation pending</small>}<button className="danger" onClick={() => deleteAccount(account)} title={`Delete ${account.name} portal access`}><Trash2 />Delete</button></span></article>)}</div>
      {!data.accounts.length && <div className="automation-empty"><KeyRound /><strong>No portal accounts</strong><span>Invite a candidate, client or partner to start secure collaboration.</span></div>}
    </section>
  </div>;
}
