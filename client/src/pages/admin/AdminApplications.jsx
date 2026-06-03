import { useEffect, useState } from "react";
import { api, downloadFile } from "../../api/client.js";

export default function AdminApplications() {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const load = () => {
    const query = new URLSearchParams(Object.entries({ status, search }).filter(([, value]) => value)).toString();
    api(`/applications${query ? `?${query}` : ""}`).then(setItems).catch(() => {});
  };
  useEffect(() => {
    load();
  }, [status]);
  return (
    <>
      <div className="admin-top"><h1>Admin Applications</h1><input placeholder="Search applications" value={search} onChange={(e) => setSearch(e.target.value)} onBlur={load} /><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All statuses</option><option>New</option><option>Reviewed</option><option>Shortlisted</option><option>Rejected</option></select></div>
      <div className="table-wrap"><table><thead><tr><th>Candidate</th><th>Job</th><th>Status</th><th>CV</th></tr></thead><tbody>
        {items.map((item) => <tr key={item._id}><td>{item.name}<br /><span className="muted">{item.email} · {item.phone}</span></td><td>{item.job?.title}</td><td><select value={item.status} onChange={(e) => api(`/applications/${item._id}/status`, { method: "PUT", body: { status: e.target.value } }).then(load)}><option>New</option><option>Reviewed</option><option>Shortlisted</option><option>Rejected</option></select></td><td>{item.cv?.filename ? <button className="button small" onClick={() => downloadFile(`/applications/${item._id}/download`, item.cv.originalName)}>Download</button> : "No CV"}</td></tr>)}
      </tbody></table></div>
    </>
  );
}
