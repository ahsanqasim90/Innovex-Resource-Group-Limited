import { useEffect, useState } from "react";
import { Building2, Handshake } from "lucide-react";
import { api, publicAssetUrl } from "../../api/client.js";
import AdminSectionHero from "../../components/AdminSectionHero.jsx";
import FileUpload from "../../components/FileUpload.jsx";
import StatusMessage from "../../components/StatusMessage.jsx";

const empty = { name: "", serviceProvided: "", location: "", contactEmail: "", isActive: true };
const toPartnerPayload = (partner) => ({ ...empty, ...partner });

function toPartnerFormData(form, formElement) {
  const data = new FormData();
  data.append("name", form.name);
  data.append("serviceProvided", form.serviceProvided);
  data.append("location", form.location);
  data.append("contactEmail", form.contactEmail || "");
  data.append("isActive", String(Boolean(form.isActive)));
  const file = formElement.elements.logo?.files?.[0];
  if (file) data.append("logo", file);
  return data;
}

export default function AdminPartners() {
  const [partners, setPartners] = useState([]);
  const [form, setForm] = useState(empty);
  const [editing, setEditing] = useState(null);
  const [status, setStatus] = useState(null);
  const load = () => api("/partners?admin=true").then(setPartners).catch((error) => setStatus({ type: "error", message: error.message }));
  useEffect(() => {
    load();
  }, []);

  async function save(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    try {
      await api(editing ? `/partners/${editing}` : "/partners", { method: editing ? "PUT" : "POST", body: toPartnerFormData(form, formElement) });
      setForm(empty); setEditing(null); setStatus({ message: "Partner saved." }); load();
      formElement.reset();
    } catch (error) { setStatus({ type: "error", message: error.message }); }
  }

  async function remove(id) {
    if (!confirm("Delete this partner?")) return;
    try {
      await api(`/partners/${id}`, { method: "DELETE" });
      setStatus({ message: "Partner deleted." });
      load();
    } catch (error) {
      setStatus({ type: "error", message: error.message });
    }
  }

  return (
    <>
      <AdminSectionHero icon={Handshake} eyebrow="Website network" title="Partners" description="Manage trusted organisations, services and logos displayed across the Innovex website." aside={<div className="workspace-hero-count"><Building2 size={18} /><span><small>PARTNERS</small><strong>{partners.length}</strong></span></div>} />
      <StatusMessage status={status} />
      <form className="card form workspace-editor-card" onSubmit={save}>
        <div className="admin-form-title"><div><span className="eyebrow">Partner directory</span><h2>{editing ? "Update partner profile" : "Add a trusted partner"}</h2><p>Keep public partner information consistent and current.</p></div></div>
        <div className="form-grid">
          <input placeholder="Partner name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input placeholder="Service provided" value={form.serviceProvided} onChange={(e) => setForm({ ...form, serviceProvided: e.target.value })} required />
          <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} required />
          <input placeholder="Contact email" value={form.contactEmail || ""} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
          <label><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
        </div>
        <FileUpload name="logo" label="Partner logo" prompt="Choose or drag partner logo here" helper="JPG, PNG, WEBP, or SVG up to 2MB" accept=".jpg,.jpeg,.png,.webp,.svg,image/jpeg,image/png,image/webp,image/svg+xml" />
        <button className="button">{editing ? "Update Partner" : "Add Partner"}</button>
      </form>
      <div className="table-wrap workspace-data-table" style={{ marginTop: 24 }}><table><thead><tr><th>Logo</th><th>Name</th><th>Service</th><th>Location</th><th>Status</th><th>Actions</th></tr></thead><tbody>
        {partners.map((partner) => <tr key={partner._id}><td>{partner.logo?.url ? <img className="admin-logo-thumb" src={publicAssetUrl(partner.logo.url)} alt={`${partner.name} logo`} loading="lazy" width="58" height="42" /> : <span className="muted">No logo</span>}</td><td>{partner.name}</td><td>{partner.serviceProvided}</td><td>{partner.location}</td><td>{partner.isActive ? "Active" : "Inactive"}</td><td className="actions"><button className="button small" onClick={() => { setEditing(partner._id); setForm(toPartnerPayload(partner)); }}>Edit</button><button className="button secondary small" onClick={() => api(`/partners/${partner._id}`, { method: "PUT", body: { name: partner.name, serviceProvided: partner.serviceProvided, location: partner.location, contactEmail: partner.contactEmail || "", isActive: !partner.isActive } }).then(load).catch((error) => setStatus({ type: "error", message: error.message }))}>Toggle</button><button className="button small" onClick={() => remove(partner._id)}>Delete</button></td></tr>)}
      </tbody></table>{!partners.length && <div className="workspace-empty-state"><Handshake size={30} /><strong>No partners added</strong><span>Add your first partner using the form above.</span></div>}</div>
    </>
  );
}
