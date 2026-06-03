import { useEffect, useState } from "react";
import { api } from "../../api/client.js";

export default function Dashboard() {
  const [data, setData] = useState({ stats: {}, recentApplications: [] });
  useEffect(() => {
    api("/dashboard/stats").then(setData).catch(() => {});
  }, []);
  const stats = [
    ["Active Jobs", data.stats.activeJobs],
    ["Applications", data.stats.applications],
    ["New CVs", data.stats.newCvs],
    ["Pending Reviews", data.stats.pendingReviews],
    ["Partners", data.stats.partners],
    ["Placements", data.stats.placements]
  ];
  return (
    <>
      <div className="admin-top"><h1>Admin Dashboard</h1></div>
      <div className="stats-grid">{stats.map(([label, value]) => <div className="card" key={label}><strong>{value ?? 0}</strong><p>{label}</p></div>)}</div>
      <h2>Recent applications</h2>
      <div className="table-wrap">
        <table><thead><tr><th>Candidate</th><th>Job</th><th>Status</th><th>Date</th></tr></thead><tbody>
          {data.recentApplications.map((item) => <tr key={item._id}><td>{item.name}<br /><span className="muted">{item.email}</span></td><td>{item.job?.title || "Deleted job"}</td><td>{item.status}</td><td>{new Date(item.createdAt).toLocaleDateString()}</td></tr>)}
        </tbody></table>
      </div>
    </>
  );
}
