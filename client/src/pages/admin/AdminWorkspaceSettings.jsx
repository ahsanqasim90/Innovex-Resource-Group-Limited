import { useEffect, useState } from "react";
import { Building2, CalendarClock, Check, Copy, CreditCard, Database, HardDrive, KeyRound, Laptop, Link2, MailPlus, Palette, RefreshCw, Save, ShieldCheck, Smartphone, Sparkles, UserPlus, Users, X } from "lucide-react";
import { api } from "../../api/client.js";
import { hasPermission } from "../../auth/permissions.js";
import AdminSectionHero from "../../components/AdminSectionHero.jsx";
import StatusMessage from "../../components/StatusMessage.jsx";
import SubmitButton from "../../components/SubmitButton.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export default function AdminWorkspaceSettings() {
  const { user } = useAuth();
  const canManageOrg = hasPermission(user, "organization.manage");
  const canManageTeam = hasPermission(user, "team.manage");
  const [tab, setTab] = useState("profile");
  const [organization, setOrganization] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [inviteResult, setInviteResult] = useState(null);
  const [mfaSetup, setMfaSetup] = useState(null);
  const [recoveryCodes, setRecoveryCodes] = useState([]);

  async function load() {
    try {
      const requests = [api("/organizations/current"), api("/auth/sessions")];
      if (canManageTeam) requests.push(api("/organizations/invitations"));
      const [org, activeSessions, teamInvites = []] = await Promise.all(requests);
      setOrganization(org); setSessions(activeSessions); setInvitations(teamInvites);
    } catch (error) { setStatus({ type: "error", message: error.message }); }
  }
  useEffect(() => { load(); }, []);

  async function saveProfile(event) {
    event.preventDefault(); setSaving(true); setStatus(null);
    try { const updated = await api("/organizations/current", { method: "PATCH", body: organization }); setOrganization(updated); setStatus({ type: "success", message: "Workspace settings saved" }); }
    catch (error) { setStatus({ type: "error", message: error.message }); }
    finally { setSaving(false); }
  }

  async function invite(event) {
    event.preventDefault(); setSaving(true); setInviteResult(null);
    try { const result = await api("/organizations/invitations", { method: "POST", body: Object.fromEntries(new FormData(event.currentTarget)) }); setInviteResult(result); event.currentTarget.reset(); await load(); }
    catch (error) { setStatus({ type: "error", message: error.message }); }
    finally { setSaving(false); }
  }

  async function beginMfa() {
    try { setMfaSetup(await api("/auth/mfa/setup", { method: "POST" })); setRecoveryCodes([]); }
    catch (error) { setStatus({ type: "error", message: error.message }); }
  }

  async function confirmMfa(event) {
    event.preventDefault();
    try { const result = await api("/auth/mfa/confirm", { method: "POST", body: Object.fromEntries(new FormData(event.currentTarget)) }); setRecoveryCodes(result.recoveryCodes); setMfaSetup(null); setStatus({ type: "success", message: result.message }); }
    catch (error) { setStatus({ type: "error", message: error.message }); }
  }

  async function revokeSession(id) {
    try { await api(`/auth/sessions/${id}`, { method: "DELETE" }); await load(); }
    catch (error) { setStatus({ type: "error", message: error.message }); }
  }

  if (!organization) return <div className="admin-loading-screen">Loading workspace settings…</div>;
  const usage = organization.usage || {};
  const seatPercent = Math.min(100, Math.round(((usage.reservedSeats || 0) / (usage.seatLimit || 1)) * 100));
  return <div className="workspace-settings-page">
    <AdminSectionHero eyebrow="Organisation control centre" title="Workspace Settings" description="Manage company identity, onboarding, team access and account security from one protected area." aside={<div className="workspace-hero-count"><ShieldCheck size={18} /><span><small>PLAN</small><strong>{organization.subscription?.plan}</strong></span></div>} />
    <StatusMessage status={status} />
    <nav className="settings-tabs">{[["profile", Building2, "Organisation"], ["team", UserPlus, "Invitations"], ["billing", CreditCard, "Plan & usage"], ["security", ShieldCheck, "Security"]].map(([value, Icon, label]) => (value !== "team" || canManageTeam) && <button key={value} className={tab === value ? "active" : ""} onClick={() => setTab(value)}><Icon />{label}</button>)}</nav>
    {tab === "profile" && <form className="settings-panel" onSubmit={saveProfile}>
      <header><span><Building2 /></span><div><small>WORKSPACE PROFILE</small><h2>Organisation identity</h2><p>These settings provide the tenant-specific branding, locale and retention defaults.</p></div></header>
      <div className="settings-form-grid"><label><span>Display name</span><input disabled={!canManageOrg} value={organization.name} onChange={(e) => setOrganization({ ...organization, name: e.target.value })} /></label><label><span>Legal name</span><input disabled={!canManageOrg} value={organization.legalName || ""} onChange={(e) => setOrganization({ ...organization, legalName: e.target.value })} /></label><label><span>Company number</span><input disabled={!canManageOrg} value={organization.companyNumber || ""} onChange={(e) => setOrganization({ ...organization, companyNumber: e.target.value })} /></label><label><span>Workspace slug</span><input value={organization.slug} disabled /></label><label><span>Contact email</span><input disabled={!canManageOrg} type="email" value={organization.contact?.email || ""} onChange={(e) => setOrganization({ ...organization, contact: { ...organization.contact, email: e.target.value } })} /></label><label><span>Contact phone</span><input disabled={!canManageOrg} value={organization.contact?.phone || ""} onChange={(e) => setOrganization({ ...organization, contact: { ...organization.contact, phone: e.target.value } })} /></label><label><span>Timezone</span><input disabled={!canManageOrg} value={organization.locale?.timezone || ""} onChange={(e) => setOrganization({ ...organization, locale: { ...organization.locale, timezone: e.target.value } })} /></label><label><span>Currency</span><select disabled={!canManageOrg} value={organization.locale?.currency || "GBP"} onChange={(e) => setOrganization({ ...organization, locale: { ...organization.locale, currency: e.target.value } })}>{["GBP", "EUR", "USD", "AED"].map((value) => <option key={value}>{value}</option>)}</select></label><label><span>Primary colour</span><div className="settings-color-field"><Palette /><input disabled={!canManageOrg} type="color" value={organization.branding?.primaryColor || "#006d70"} onChange={(e) => setOrganization({ ...organization, branding: { ...organization.branding, primaryColor: e.target.value } })} /></div></label><label><span>Retention period</span><select disabled={!canManageOrg} value={organization.dataRetentionDays || 730} onChange={(e) => setOrganization({ ...organization, dataRetentionDays: Number(e.target.value) })}><option value="365">1 year</option><option value="730">2 years</option><option value="1825">5 years</option><option value="2555">7 years</option></select></label></div>
      <section className="onboarding-progress"><div><span>Workspace onboarding</span><strong>{organization.onboarding?.status}</strong></div><div className="onboarding-track"><i style={{ width: `${Math.min(100, (organization.onboarding?.completedSteps?.length || 0) * 25)}%` }} /></div><p>{organization.onboarding?.completedSteps?.length || 0} configuration steps completed</p></section>
      {canManageOrg && <footer><SubmitButton loading={saving}><Save /> Save workspace settings</SubmitButton></footer>}
    </form>}
    {tab === "team" && <section className="settings-panel"><header><span><UserPlus /></span><div><small>CONTROLLED ONBOARDING</small><h2>Team invitations</h2><p>Invite members with an assigned role. Links expire automatically after seven days.</p></div></header>
      <form className="workspace-invite-form" onSubmit={invite}><label><span>Name</span><input name="name" placeholder="Team member" /></label><label><span>Email *</span><input name="email" type="email" required /></label><label><span>Role *</span><select name="role" required>{["recruitment", "sales", "training", "marketing", "viewer"].map((value) => <option key={value} value={value}>{value.replaceAll("_", " ")}</option>)}</select></label><SubmitButton loading={saving}><MailPlus /> Create invitation</SubmitButton></form>
      {inviteResult && <div className="invitation-result"><Link2 /><div><strong>Invitation ready</strong><code>{inviteResult.invitationUrl}</code></div><button onClick={() => navigator.clipboard.writeText(inviteResult.invitationUrl)}><Copy /> Copy</button></div>}
      <div className="invitation-list"><header><strong>Invitation history</strong><span>{invitations.length}</span></header>{invitations.map((item) => <article key={item.id}><span className="invite-avatar">{item.email.slice(0, 2).toUpperCase()}</span><div><strong>{item.name || item.email}</strong><small>{item.email} · {item.role.replaceAll("_", " ")}</small></div><em className={item.status.toLowerCase()}>{item.status}</em><time>{new Date(item.expiresAt).toLocaleDateString("en-GB")}</time></article>)}</div>
    </section>}
    {tab === "billing" && <div className="subscription-workspace">
      <section className="subscription-plan-card"><div className="subscription-plan-copy"><span className="subscription-plan-icon"><Sparkles /></span><div><small>CURRENT SUBSCRIPTION</small><h2>{organization.subscription?.plan || "Trial"}</h2><p>Your workspace is <strong>{organization.subscription?.status || organization.status}</strong>. Limits are enforced across direct accounts, pending invitations and restored users.</p></div></div><div className={`subscription-state ${String(organization.subscription?.status || "").toLowerCase().replaceAll(" ", "-")}`}><i />{organization.subscription?.status || organization.status}</div></section>
      <section className="subscription-metrics"><article><span><Users /></span><div><small>ACTIVE MEMBERS</small><strong>{usage.activeSeats ?? "—"}</strong><p>Members with workspace access</p></div></article><article><span><MailPlus /></span><div><small>PENDING INVITES</small><strong>{usage.pendingInvitations ?? "—"}</strong><p>Reserved until invite expiry</p></div></article><article><span><Database /></span><div><small>AVAILABLE SEATS</small><strong>{usage.availableSeats ?? "—"}</strong><p>Of {usage.seatLimit ?? organization.subscription?.seatLimit} licensed seats</p></div></article><article><span><HardDrive /></span><div><small>STORAGE ALLOWANCE</small><strong>{usage.storageLimitMb ? `${(usage.storageLimitMb / 1024).toFixed(usage.storageLimitMb % 1024 ? 1 : 0)} GB` : "—"}</strong><p>Private document capacity</p></div></article></section>
      <section className="settings-panel subscription-usage-card"><header><span><CreditCard /></span><div><small>LICENSE UTILISATION</small><h2>Seat allocation</h2><p>Pending invitations reserve a seat so onboarding never exceeds licensed capacity.</p></div><strong className="subscription-usage-number">{usage.reservedSeats || 0}/{usage.seatLimit || organization.subscription?.seatLimit}</strong></header><div className="subscription-progress"><i style={{ width: `${seatPercent}%` }} /></div><div className="subscription-legend"><span><i className="active" />{usage.activeSeats || 0} active</span><span><i className="pending" />{usage.pendingInvitations || 0} reserved</span><strong>{seatPercent}% allocated</strong></div></section>
      <section className="subscription-policy-grid"><article><span><CalendarClock /></span><div><small>BILLING PERIOD</small><strong>{organization.subscription?.currentPeriodEndsAt ? `Renews ${new Date(organization.subscription.currentPeriodEndsAt).toLocaleDateString("en-GB")}` : organization.subscription?.trialEndsAt ? `Trial ends ${new Date(organization.subscription.trialEndsAt).toLocaleDateString("en-GB")}` : "Managed subscription"}</strong><p>Billing changes are handled by the platform owner.</p></div></article><article><span><ShieldCheck /></span><div><small>ACCESS POLICY</small><strong>Fail-safe enforcement</strong><p>Suspended, cancelled, past-due and expired trial workspaces are blocked server-side.</p></div></article></section>
    </div>}
    {tab === "security" && <div className="settings-security-grid"><section className="settings-panel"><header><span><Smartphone /></span><div><small>ACCOUNT PROTECTION</small><h2>Multi-factor authentication</h2><p>Add a rotating authenticator code to your password.</p></div></header>
      {!mfaSetup && !recoveryCodes.length && <button className="security-primary-action" onClick={beginMfa}><KeyRound /> {user.mfaEnabled ? "Reset authenticator" : "Set up authenticator"}</button>}
      {mfaSetup && <form className="mfa-setup" onSubmit={confirmMfa}><p>Add this secret to Google Authenticator, Microsoft Authenticator or 1Password:</p><code>{mfaSetup.secret}</code><label><span>Six-digit code</span><input name="code" inputMode="numeric" pattern="[0-9]{6}" required /></label><SubmitButton><Check /> Confirm MFA</SubmitButton></form>}
      {recoveryCodes.length > 0 && <div className="recovery-codes"><strong>Save these one-time recovery codes now</strong><div>{recoveryCodes.map((code) => <code key={code}>{code}</code>)}</div><button onClick={() => navigator.clipboard.writeText(recoveryCodes.join("\n"))}><Copy /> Copy all codes</button></div>}
    </section><section className="settings-panel"><header><span><Laptop /></span><div><small>ACTIVE ACCESS</small><h2>Signed-in devices</h2><p>Review and revoke sessions you no longer recognise.</p></div><button className="icon-button" onClick={load}><RefreshCw /></button></header><div className="session-list">{sessions.map((session) => <article key={session.id} className={session.suspicious ? "suspicious" : ""}><span><Laptop /></span><div><strong>{session.deviceLabel}{session.current ? " · This device" : ""}</strong><small>{session.ipAddress} · Last active {new Date(session.lastSeenAt).toLocaleString("en-GB")}</small></div>{session.suspicious && <em>Review</em>}{!session.revokedAt && !session.current && <button onClick={() => revokeSession(session.id)}><X /> Revoke</button>}</article>)}</div></section></div>}
  </div>;
}
