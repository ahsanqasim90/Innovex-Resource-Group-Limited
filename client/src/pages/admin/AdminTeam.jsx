import { useEffect, useMemo, useState } from "react";
import { Check, ChevronRight, Clock3, History, Mail, Search, Settings2, ShieldCheck, UserPlus, UsersRound, X } from "lucide-react";
import { api } from "../../api/client.js";
import { permissionGroups, rolePresets, hasPermission } from "../../auth/permissions.js";
import { useAuth } from "../../context/AuthContext.jsx";
import StatusMessage from "../../components/StatusMessage.jsx";
import SubmitButton from "../../components/SubmitButton.jsx";
import AdminLoadState from "../../components/AdminLoadState.jsx";
import { displayedTeamPermissions, requiredTeamPermissions, isAdministrator, memberForm, moduleCount, samePermissions, teamRoleLabel, teamRoles } from "../../utils/teamAccess.js";
import "../../styles/team-access.css";

const emptyForm = { name: "", email: "", password: "", role: "viewer", permissions: rolePresets.viewer, outboundCallerIds: [], assignedSenderEmails: [], canCopyData: false, isActive: true };
const dateTime = (value) => value ? new Date(value).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "No activity recorded";

export default function AdminTeam() {
  const { user: signedInUser } = useAuth();
  const [users, setUsers] = useState(null);
  const [options, setOptions] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [status, setStatus] = useState(null);
  const [formStatus, setFormStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [permissionSearch, setPermissionSearch] = useState("");
  const [optionsError, setOptionsError] = useState("");
  const [memberActivity, setMemberActivity] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [activityError, setActivityError] = useState("");
  const presets = options?.rolePresets || rolePresets;
  const groups = options?.permissionGroups || permissionGroups;
  const fullAccess = isAdministrator(form.role);
  const accessPermissions = displayedTeamPermissions(form);
  const requiredPermissions = requiredTeamPermissions(form.role);
  const customised = !fullAccess && !samePermissions(form.permissions, presets[form.role] || []);
  const self = editing === signedInUser?.id;
  const original = users?.find((member) => member.id === editing);
  const changes = original ? { added: form.permissions.filter((p) => !original.permissions?.includes(p)).length, removed: (original.permissions || []).filter((p) => !form.permissions.includes(p)).length } : null;
  const visible = useMemo(() => (users || []).filter((member) => (!roleFilter || member.role === roleFilter) && (!stateFilter || (stateFilter === "active") === member.isActive) && `${member.name} ${member.email}`.toLowerCase().includes(search.toLowerCase().trim())), [users, search, roleFilter, stateFilter]);

  async function load() {
    try { setUsers(await api("/users")); }
    catch (error) { setStatus({ type: "error", message: error.message }); }
  }
  async function loadOptions() {
    setOptionsError("");
    try { setOptions(await api("/users/permission-options")); }
    catch (error) { setOptionsError(error.message); }
  }
  useEffect(() => { load(); loadOptions(); }, []);
  useEffect(() => {
    if (!editorOpen) return;
    const first = document.getElementById("team-member-name"); first?.focus();
  }, [editorOpen, editing]);

  async function loadMemberActivity(memberId) {
    setMemberActivity(null); setActivityError(""); setActivityLoading(true);
    try { setMemberActivity(await api(`/users/${memberId}/activity`)); }
    catch (error) { setActivityError(error.message); }
    finally { setActivityLoading(false); }
  }
  function openEditor(member) {
    setEditing(member?.id || null);
    setForm(member ? memberForm(member, emptyForm) : { ...emptyForm, permissions: [...(presets.viewer || rolePresets.viewer)] });
    if (member?.id) loadMemberActivity(member.id);
    else { setMemberActivity(null); setActivityError(""); setActivityLoading(false); }
    setPermissionSearch(""); setFormStatus(null); setEditorOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function closeEditor() { setEditorOpen(false); setEditing(null); setFormStatus(null); }
  function setRole(role) {
    if (role === form.role) return;
    setForm((current) => ({ ...current, role, permissions: [...(presets[role] || [])] }));
  }
  function toggle(key, value) {
    setForm((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value] }));
  }
  async function save(event) {
    event.preventDefault(); setSaving(true); setFormStatus(null);
    try {
      const payload = { ...form };
      if (editing && !payload.password) delete payload.password;
      await api(editing ? `/users/${editing}` : "/users", { method: editing ? "PUT" : "POST", body: payload });
      setStatus({ type: "success", message: editing ? `Access updated for ${form.name}.` : `${form.name} has been added to the team.` });
      closeEditor(); await load();
    } catch (error) { setFormStatus({ type: "error", message: error.message }); }
    finally { setSaving(false); }
  }
  async function archive(member) {
    if (!confirm(`Archive ${member.name}? They will lose access. Their existing work will be retained, and the account can be restored from Archive & Retention.`)) return;
    setBusy(member.id);
    try { await api(`/users/${member.id}`, { method: "DELETE" }); setStatus({ message: `${member.name} was archived.` }); await load(); }
    catch (error) { setStatus({ type: "error", message: error.message }); }
    finally { setBusy(""); }
  }
  if (!users) return <AdminLoadState error={status?.type === "error" ? status.message : ""} onRetry={() => { setStatus(null); load(); }} label="Loading your team…" />;
  return <div className="team-access-page">
    <section className="workspace-welcome"><div><span className="eyebrow">People & access</span><h2>Your team</h2><p>Choose a role for each person. Customise individual permissions only when needed.</p></div><button className="button" onClick={() => openEditor(null)} disabled={saving}><UserPlus size={17} />Add team member</button></section>
    <StatusMessage status={status} />
    {editorOpen && <section className="workspace-panel team-access-editor" aria-labelledby="team-editor-heading">
      <header><div><span className="eyebrow">{editing ? "Member settings" : "New member"}</span><h2 id="team-editor-heading">{editing ? `Edit ${original?.name || "team member"}` : "Add a team member"}</h2></div><button className="workspace-icon-button" onClick={closeEditor} disabled={saving} aria-label="Close member editor"><X size={18} /></button></header>
      <form onSubmit={save}>
        <fieldset disabled={saving}>
          <div className="team-editor-step"><span>1</span><div><h3>Account details</h3><p>The details this person uses to sign in.</p></div></div>
          <div className="team-details-grid">
            <label>Full name<input id="team-member-name" autoComplete="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></label>
            <label>Email address<input type="email" autoComplete="off" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
            <label>{editing ? "New password (optional)" : "Initial password"}<input type="password" minLength={8} autoComplete="new-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} /><small>{editing ? "Leave blank to keep the current password." : "At least 8 characters."}</small></label>
            <label>Account status<select disabled={self} value={form.isActive ? "active" : "suspended"} onChange={(e) => setForm({ ...form, isActive: e.target.value === "active" })}><option value="active">Active — can sign in</option><option value="suspended">Suspended — access paused</option></select>{self && <small>You cannot suspend your own account.</small>}</label>
          </div>
          <div className="team-editor-step"><span>2</span><div><h3>Choose their role</h3><p>Select the work they do. Each role comes with a ready-made access profile.</p></div></div>
          {form.role === "admin" ? <div className="team-full-access"><ShieldCheck size={21} /><div><strong>Primary administrator</strong><p>This account has full access. Its role cannot be changed here.</p></div></div> : <div className="team-role-grid" role="radiogroup" aria-label="Team member role">{teamRoles.map(([role, label, description]) => <label key={role} className={form.role === role ? "selected" : ""}><input type="radio" name="team-role" value={role} checked={form.role === role} onChange={() => setRole(role)} /><span><strong>{label}</strong><small>{description}</small></span>{form.role === role && <Check size={17} />}</label>)}</div>}
          <div className="team-access-preview"><ShieldCheck size={20} /><div><strong>{fullAccess ? "Full administrator access" : customised ? "Custom access profile" : `${teamRoleLabel(form.role)} access profile`}</strong><p>{fullAccess ? "Access to every module, financial information and team settings." : `${moduleCount(accessPermissions)} modules enabled. ${customised ? "Individual permissions have been customised." : "The role’s standard permissions are selected."}`}</p>{changes && !fullAccess && (changes.added > 0 || changes.removed > 0) && <small>{changes.added} permissions added · {changes.removed} removed on save</small>}</div></div>
          {editing && <section className="team-member-history" aria-label={`${form.name} account history`}>
            <header><div><History size={18} /><span><strong>Account history</strong><small>Previous sign-ins and actions retained for this member.</small></span></div><button type="button" className="button secondary small" onClick={() => loadMemberActivity(editing)} disabled={activityLoading}>{activityLoading ? "Refreshing…" : "Refresh"}</button></header>
            {activityLoading && !memberActivity ? <p className="team-history-state">Loading previous activity…</p> : activityError ? <p className="team-history-state error" role="alert">{activityError}</p> : memberActivity && <><div className="team-history-facts"><span><Clock3 size={15} /><small>Last login</small><strong>{dateTime(memberActivity.lastLoginAt)}</strong></span><span><UserPlus size={15} /><small>Account created</small><strong>{dateTime(memberActivity.createdAt)}</strong></span></div><div className="team-history-list">{memberActivity.activities?.map((entry) => <article key={entry._id}><span><strong>{entry.action}</strong><small>{entry.module}</small></span><p>{entry.summary}</p><time>{dateTime(entry.createdAt)}</time></article>)}{!memberActivity.activities?.length && <p className="team-history-state">No recorded actions yet. New logins and workspace changes will appear here.</p>}</div></>}
          </section>}
          <details className="team-advanced" key={editing || "new"}><summary><Settings2 size={17} /><span>Advanced settings<small>Individual permissions, phone numbers and email senders</small></span><ChevronRight size={17} /></summary>
            <div className="team-advanced-body">
              <section><h3>Data copying</h3>{fullAccess ? <p>Administrators have copying access.</p> : <label className="team-simple-check"><input type="checkbox" checked={form.canCopyData} onChange={(e) => setForm({ ...form, canCopyData: e.target.checked })} /><span>Allow copying text and using the right-click menu<small>File exports are controlled separately by export permissions.</small></span></label>}</section>
              <section><h3>Calling & email</h3><p>Assign the numbers and mailboxes this person can use.</p>{optionsError && <div className="workspace-inline-error" role="alert">Assignment options could not be loaded. Existing selections are kept. <button type="button" onClick={loadOptions}>Retry</button></div>}
              {fullAccess ? <p>Administrators can use all configured caller numbers and sender accounts.</p> : <div className="team-assignment-grid"><div><h4>Caller numbers</h4>{[...new Set([...(options?.outboundCallerIds || []), ...form.outboundCallerIds])].map((number) => <label className="team-simple-check" key={number}><input type="checkbox" checked={form.outboundCallerIds.includes(number)} onChange={() => toggle("outboundCallerIds", number)} /><span>{number}</span></label>)}{!options?.outboundCallerIds?.length && !form.outboundCallerIds.length && <p>{options ? "No caller numbers are configured." : "Loading caller numbers…"}</p>}</div><div><h4>Email senders</h4>{[...new Set([...(options?.senderAccounts || []).map((s) => s.address), ...form.assignedSenderEmails])].map((email) => <label className="team-simple-check" key={email}><input type="checkbox" checked={form.assignedSenderEmails.includes(email)} onChange={() => toggle("assignedSenderEmails", email)} /><span>{email}</span></label>)}{!options?.senderAccounts?.length && !form.assignedSenderEmails.length && <p>{options ? "No sender accounts are configured." : "Loading sender accounts…"}</p>}</div></div>}</section>
              <section><div className="team-permission-heading"><div><h3>Individual permissions</h3><p>{fullAccess ? "Administrators have all permissions automatically." : "Expand a group to change specific actions. Permissions included by a broader access setting are shown as included."}</p></div>{!fullAccess && <button className="button secondary small" type="button" onClick={() => setForm({ ...form, permissions: [...(presets[form.role] || [])] })}>Reset to role defaults</button>}</div>
                {!fullAccess && <><label className="team-permission-search"><Search size={16} /><input aria-label="Find a permission" placeholder="Find a module or permission" value={permissionSearch} onChange={(e) => setPermissionSearch(e.target.value)} /></label><div className="team-permission-groups">{groups.map((group) => {
                  const matching = group.permissions.filter(([id, label]) => `${group.label} ${label} ${id}`.toLowerCase().includes(permissionSearch.toLowerCase().trim()));
                  if (!matching.length) return null;
                  return <details key={`${group.label}-${Boolean(permissionSearch)}`} open={permissionSearch ? true : undefined}><summary>{group.label}<span>{group.permissions.filter(([id]) => hasPermission({ ...form, permissions: accessPermissions }, id)).length} / {group.permissions.length} enabled</span></summary><div>{matching.map(([id, label]) => {
                    const explicit = form.permissions.includes(id);
                    const required = requiredPermissions.includes(id);
                    const included = !explicit && hasPermission({ ...form, permissions: accessPermissions }, id);
                    return <label className="team-simple-check" key={id}><input type="checkbox" checked={explicit || included} disabled={included || required} onChange={() => toggle("permissions", id)} /><span>{label}{required ? <small>Included automatically for this role</small> : included && <small>Included by another permission in this module</small>}</span></label>;
                  })}</div></details>;
                })}</div>{!groups.some((group) => group.permissions.some(([id, label]) => `${group.label} ${label} ${id}`.toLowerCase().includes(permissionSearch.toLowerCase().trim()))) && <p>No matching permissions.</p>}</>}
              </section>
            </div>
          </details>
        </fieldset>
        <StatusMessage status={formStatus} />
        <footer className="team-save-bar"><span>{editing ? "Changes apply when you save." : "The new member gets the selected access profile."}</span><div><button className="button secondary" type="button" disabled={saving} onClick={closeEditor}>Cancel</button><SubmitButton loading={saving} loadingText="Saving…">{editing ? "Save changes" : "Add member"}</SubmitButton></div></footer>
      </form>
    </section>}
    <section className="workspace-panel team-member-list">
      <header><div><span className="eyebrow">Team directory</span><h2>{users.length} member{users.length === 1 ? "" : "s"} <span className="workspace-count">{users.filter((member) => member.isActive).length} active</span></h2></div><UsersRound size={21} /></header>
      <div className="team-directory-filters"><label><Search size={17} /><input aria-label="Search team members" placeholder="Search name or email" value={search} onChange={(e) => setSearch(e.target.value)} /></label><select aria-label="Filter by role" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}><option value="">All roles</option>{[...new Set(users.map((member) => member.role))].map((role) => <option value={role} key={role}>{teamRoleLabel(role)}</option>)}</select><select aria-label="Filter by account status" value={stateFilter} onChange={(e) => setStateFilter(e.target.value)}><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option></select></div>
      <div className="team-directory-rows">{visible.map((member) => <article key={member.id}><span className="team-member-avatar">{member.name?.split(/\s+/).map((part) => part[0]).slice(0,2).join("").toUpperCase() || "?"}</span><div className="team-member-identity"><strong>{member.name}{member.id === signedInUser?.id && <small>You</small>}</strong><span><Mail size={13} />{member.email}</span></div><div className="team-member-role"><strong>{teamRoleLabel(member.role)}</strong><small>{isAdministrator(member.role) ? "Full workspace access" : `${moduleCount(displayedTeamPermissions(member))} modules · ${samePermissions(member.permissions, presets[member.role] || []) ? "Role defaults" : "Custom access"}`}</small></div><span className={`team-account-status ${member.isActive ? "active" : ""}`}>{member.isActive ? "Active" : "Suspended"}</span><div className="team-member-actions"><button className="button secondary small" disabled={saving} onClick={() => openEditor(member)}>Manage access</button>{member.id !== signedInUser?.id && member.role !== "admin" && <button className="workspace-reset" disabled={Boolean(busy) || saving} onClick={() => archive(member)}>{busy === member.id ? "Archiving…" : "Archive"}</button>}</div></article>)}</div>
      {!visible.length && <div className="workspace-empty"><UsersRound /><strong>{users.length ? "No matching team members" : "Build your team"}</strong><p>{users.length ? "Try another name or clear the filters." : "Add your first team member and choose their role."}</p></div>}
    </section>
  </div>;
}
