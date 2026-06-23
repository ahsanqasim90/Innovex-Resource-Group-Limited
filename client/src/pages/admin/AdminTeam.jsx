import { useEffect, useState } from "react";
import { LockKeyhole, ShieldCheck, UserCog, UserPlus, UsersRound } from "lucide-react";
import { api } from "../../api/client.js";
import { permissionGroups, rolePresets } from "../../auth/permissions.js";
import StatusMessage from "../../components/StatusMessage.jsx";
import SubmitButton from "../../components/SubmitButton.jsx";

const emptyForm = {
  name: "",
  email: "",
  password: "",
  role: "viewer",
  permissions: rolePresets.viewer,
  outboundCallerIds: [],
  assignedSenderEmails: [],
  canCopyData: false,
  isActive: true
};

const roles = [
  ["viewer", "Viewer"],
  ["recruitment", "Recruitment Consultant"],
  ["sales", "Sales Executive"],
  ["training", "Training Coordinator"],
  ["marketing", "Marketing / Content"],
  ["super_admin", "Super Admin"]
];

function roleLabel(role) {
  return roles.find(([value]) => value === role)?.[1] || role;
}

function toForm(user) {
  return {
    ...emptyForm,
    ...user,
    id: user.id || user._id,
    password: "",
    permissions: user.permissions || [],
    outboundCallerIds: user.assignedOutboundCallerIds || user.outboundCallerIds || [],
    assignedSenderEmails: user.assignedSenderEmails || []
  };
}

export default function AdminTeam() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editing, setEditing] = useState(null);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState(false);
  const [outboundCallerIds, setOutboundCallerIds] = useState([]);
  const [senderAccounts, setSenderAccounts] = useState([]);

  async function load() {
    try {
      setUsers(await api("/users"));
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  useEffect(() => {
    load();
    api("/users/permission-options")
      .then((data) => {
        setOutboundCallerIds(data.outboundCallerIds || []);
        setSenderAccounts(data.senderAccounts || []);
      })
      .catch(() => {});
  }, []);

  function setRole(role) {
    setForm({ ...form, role, permissions: rolePresets[role] || form.permissions });
  }

  function togglePermission(permission) {
    const permissions = form.permissions.includes(permission)
      ? form.permissions.filter((item) => item !== permission)
      : [...form.permissions, permission];
    setForm({ ...form, permissions });
  }

  function toggleCallerId(callerId) {
    const nextCallerIds = form.outboundCallerIds.includes(callerId)
      ? form.outboundCallerIds.filter((item) => item !== callerId)
      : [...form.outboundCallerIds, callerId];
    setForm({ ...form, outboundCallerIds: nextCallerIds });
  }

  function toggleSenderEmail(email) {
    const nextSenders = form.assignedSenderEmails.includes(email)
      ? form.assignedSenderEmails.filter((item) => item !== email)
      : [...form.assignedSenderEmails, email];
    setForm({ ...form, assignedSenderEmails: nextSenders });
  }

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form };
      if (editing && !payload.password) delete payload.password;
      await api(editing ? `/users/${editing}` : "/users", {
        method: editing ? "PUT" : "POST",
        body: payload
      });
      setStatus({ message: editing ? "Team member updated." : "Team member created." });
      setForm(emptyForm);
      setEditing(null);
      await load();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    } finally {
      setSaving(false);
    }
  }

  async function removeUser(id) {
    if (!confirm("Delete this team member?")) return;
    try {
      await api(`/users/${id}`, { method: "DELETE" });
      setStatus({ message: "Team member deleted." });
      await load();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  return (
    <>
      <section className="team-hero talent-hero talent-crm-hero">
        <div className="talent-hero-copy">
          <span className="eyebrow">Access control</span>
          <h1><UserCog size={30} /> Team Members</h1>
          <p>Create employee accounts with limited CRM access. Give each person only the modules they need, and keep copy/download behaviour restricted for sensitive records.</p>
          <div className="talent-workflow-strip">
            <span><ShieldCheck size={16} /> Role based</span>
            <span><LockKeyhole size={16} /> Copy restricted</span>
            <span><UsersRound size={16} /> Employee accounts</span>
          </div>
        </div>
        <div className="talent-command-card">
          <div className="talent-command-icon"><LockKeyhole size={22} /></div>
          <span>Data protection</span>
          <strong>Least-access CRM</strong>
          <p>Employees only see the sections assigned by the owner. Backend APIs also check permissions.</p>
        </div>
      </section>

      <StatusMessage status={status} />

      <div className="team-admin-grid">
        <form className="card form team-member-card" onSubmit={save}>
          <div className="admin-form-title">
            <span><UserPlus size={18} /> Employee account</span>
            <h2>{editing ? "Edit team member" : "Add team member"}</h2>
            <p>Use a role preset first, then fine-tune individual module access below.</p>
          </div>
          <div className="form-grid">
            <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input placeholder="Email address" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            <input placeholder={editing ? "New password optional" : "Password"} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editing} />
            <select value={form.role} onChange={(e) => setRole(e.target.value)}>
              {roles.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <div className="team-security-options">
            <label>
              <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
              Account active
            </label>
            <label>
              <input type="checkbox" checked={form.canCopyData} onChange={(e) => setForm({ ...form, canCopyData: e.target.checked })} />
              Allow copy/context-menu access
            </label>
          </div>
          <div className="team-caller-options">
            <h3>Outbound caller numbers</h3>
            <p>Assign which Innovex phone numbers this employee can use when placing CRM calls.</p>
            <div className="caller-checkbox-grid">
              {outboundCallerIds.map((callerId) => (
                <label key={callerId}>
                  <input type="checkbox" checked={form.outboundCallerIds.includes(callerId)} onChange={() => toggleCallerId(callerId)} />
                  <span>{callerId}</span>
                </label>
              ))}
              {!outboundCallerIds.length && <span className="muted">Add YAY_OUTBOUND_NUMBERS in Vercel to enable caller assignment.</span>}
            </div>
          </div>
          <div className="team-caller-options">
            <h3>Email sender mailboxes</h3>
            <p>Choose which Innovex email addresses this employee can send from inside the CRM.</p>
            <div className="caller-checkbox-grid">
              {senderAccounts.map((sender) => (
                <label key={sender.address}>
                  <input type="checkbox" checked={form.assignedSenderEmails.includes(sender.address)} onChange={() => toggleSenderEmail(sender.address)} />
                  <span>{sender.label} - {sender.address}</span>
                </label>
              ))}
              {!senderAccounts.length && <span className="muted">Configure SMTP_INFO and SMTP_MARK environment variables to enable sender assignment.</span>}
            </div>
          </div>
          <div className="permission-grid">
            {permissionGroups.map((group) => (
              <section className="permission-group" key={group.label}>
                <h3>{group.label}</h3>
                {group.permissions.map(([permission, label]) => (
                  <label key={permission}>
                    <input type="checkbox" checked={form.permissions.includes(permission)} onChange={() => togglePermission(permission)} />
                    {label}
                  </label>
                ))}
              </section>
            ))}
          </div>
          <div className="actions">
            <SubmitButton loading={saving} loadingText="Saving access...">{editing ? "Update Access" : "Create Employee"}</SubmitButton>
            {editing && <button className="button secondary" type="button" onClick={() => { setEditing(null); setForm(emptyForm); }}>Cancel</button>}
          </div>
        </form>

        <section className="card team-policy-card">
          <LockKeyhole size={34} />
          <h2>Important security note</h2>
          <p>Copy protection blocks browser copy, cut, text selection and right-click for restricted users. It reduces casual data copying, but screenshots and phone photos cannot be technically prevented if someone can view the data.</p>
          <strong>Best practice: give employees only the modules they truly need.</strong>
        </section>
      </div>

      <div className="table-wrap talent-table team-table">
        <table>
          <thead>
            <tr>
              <th>Team member</th>
              <th>Role</th>
              <th>Permissions</th>
              <th>Caller numbers</th>
              <th>Sender emails</th>
              <th>Copy access</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td><strong>{user.name}</strong><br /><span className="muted">{user.email}</span></td>
                <td>{roleLabel(user.role)}</td>
                <td>{user.permissions?.length || 0} modules</td>
                <td>{user.outboundCallerIds?.length ? user.outboundCallerIds.join(", ") : "None assigned"}</td>
                <td>{user.assignedSenderEmails?.length ? user.assignedSenderEmails.join(", ") : ["admin", "super_admin"].includes(user.role) ? "All configured" : "None assigned"}</td>
                <td>{user.canCopyData ? "Allowed" : "Restricted"}</td>
                <td><span className="status-chip table-chip">{user.isActive ? "Active" : "Suspended"}</span></td>
                <td className="actions compact-actions">
                  <button className="button small" onClick={() => { setEditing(user.id); setForm(toForm(user)); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Edit</button>
                  <button className="button secondary small" onClick={() => removeUser(user.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {!users.length && <tr><td colSpan="8">No team members found.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
