import { useEffect, useState } from "react";
import { api, downloadFile } from "../../api/client.js";

export default function AdminCvs() {
  const [items, setItems] = useState([]);
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const load = () => {
    const query = new URLSearchParams(Object.entries({ role, search }).filter(([, value]) => value)).toString();
    api(`/cv-uploads${query ? `?${query}` : ""}`).then(setItems).catch(() => {});
  };
  useEffect(() => {
    load();
  }, [role]);
  return (
    <>
      <div className="admin-top"><h1>Admin CV Uploads</h1><input placeholder="Search CVs" value={search} onChange={(e) => setSearch(e.target.value)} onBlur={load} /><input placeholder="Filter by role" value={role} onChange={(e) => setRole(e.target.value)} /></div>
      <div className="table-wrap"><table><thead><tr><th>Candidate</th><th>Role</th><th>Location</th><th>Status</th><th>CV</th></tr></thead><tbody>
        {items.map((item) => <tr key={item._id}><td>{item.name}<br /><span className="muted">{item.email} · {item.phone}</span></td><td>{item.desiredRole}</td><td>{item.location}</td><td><select value={item.status} onChange={(e) => api(`/cv-uploads/${item._id}/status`, { method: "PUT", body: { status: e.target.value } }).then(load)}><option>New</option><option>Contacted</option><option>Shortlisted</option></select></td><td><button className="button small" onClick={() => downloadFile(`/cv-uploads/${item._id}/download`, item.cv?.originalName)}>Download</button></td></tr>)}
      </tbody></table></div>
    </>
  );
}
