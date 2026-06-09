import { useEffect, useState } from "react";
import { api } from "../../api/client.js";

export default function Dashboard() {
  const [data, setData] = useState({ stats: {}, recentApplications: [], recentInterviews: [], recentMeetings: [] });
  useEffect(() => {
    api("/dashboard/stats").then(setData).catch(() => {});
  }, []);
  const stats = [
    ["Active Jobs", data.stats.activeJobs],
    ["Applications", data.stats.applications],
    ["New CVs", data.stats.newCvs],
    ["Pending Reviews", data.stats.pendingReviews],
    ["Partners", data.stats.partners],
    ["Placements", data.stats.placements],
    ["Total Revenue", `\u00a3${Number(data.stats.totalRevenue || 0).toLocaleString()}`],
    ["Pending Interviews", data.stats.pendingInterviews],
    ["Upcoming Meetings", data.stats.upcomingMeetings],
    ["Selected Candidates", data.stats.selectedCandidates],
    ["Rejected Candidates", data.stats.rejectedCandidates]
  ];
  return (
    <>
      <div className="admin-top"><h1>Admin Dashboard</h1></div>
      <div className="stats-grid">{stats.map(([label, value]) => <div className="card" key={label}><strong>{value ?? 0}</strong><p>{label}</p></div>)}</div>
      <h2>Recent interviews</h2>
      <div className="table-wrap">
        <table><thead><tr><th>Candidate</th><th>Job / Client</th><th>Interview</th><th>Status</th><th>Outcome</th><th>Revenue</th></tr></thead><tbody>
          {(data.recentInterviews || []).map((item) => <tr key={item._id}><td>{item.candidateName}<br /><span className="muted">{item.candidateEmail}</span></td><td>{item.jobTitle}<br /><span className="muted">{item.clientName}</span></td><td>{new Date(item.interviewDate).toLocaleDateString()}<br /><span className="muted">{item.interviewTime}</span></td><td>{item.interviewStatus}</td><td>{item.candidateSelected}</td><td>{"\u00a3"}{Number(item.revenue || 0).toLocaleString()}</td></tr>)}
        </tbody></table>
      </div>
      <h2>Recent meetings</h2>
      <div className="table-wrap">
        <table><thead><tr><th>Attendee</th><th>Company</th><th>Meeting</th><th>Date</th><th>Status</th></tr></thead><tbody>
          {(data.recentMeetings || []).map((item) => <tr key={item._id}><td>{item.attendeeName}<br /><span className="muted">{item.attendeeEmail || item.attendeePhone || "No contact added"}</span></td><td>{item.companyName}</td><td>{item.meetingTitle}<br /><span className="muted">{item.meetingPurpose}</span></td><td>{new Date(item.meetingDate).toLocaleDateString()}<br /><span className="muted">{item.meetingTime}</span></td><td>{item.meetingStatus}</td></tr>)}
        </tbody></table>
      </div>
      <h2>Recent applications</h2>
      <div className="table-wrap">
        <table><thead><tr><th>Candidate</th><th>Job</th><th>Status</th><th>Date</th></tr></thead><tbody>
          {(data.recentApplications || []).map((item) => <tr key={item._id}><td>{item.name}<br /><span className="muted">{item.email}</span></td><td>{item.job?.title || "Deleted job"}</td><td>{item.status}</td><td>{new Date(item.createdAt).toLocaleDateString()}</td></tr>)}
        </tbody></table>
      </div>
    </>
  );
}
