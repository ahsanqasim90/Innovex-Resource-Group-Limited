import { useEffect, useState } from "react";
import { api } from "../../api/client.js";

function money(value) {
  return `\u00a3${Number(value || 0).toLocaleString()}`;
}

function dateLabel(value) {
  return value ? new Date(value).toLocaleDateString("en-GB") : "-";
}

export default function Dashboard() {
  const [data, setData] = useState({ stats: {}, recentApplications: [], recentInterviews: [], recentMeetings: [], trainingReminders: [], recentTrainingBookings: [] });
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
    ["Total Revenue", money(data.stats.totalRevenue)],
    ["Pending Interviews", data.stats.pendingInterviews],
    ["Upcoming Meetings", data.stats.upcomingMeetings],
    ["Selected Candidates", data.stats.selectedCandidates],
    ["Rejected Candidates", data.stats.rejectedCandidates],
    ["Training Bookings", data.stats.totalTrainingBookings],
    ["Upcoming Training", data.stats.upcomingTrainingSessions],
    ["Training Revenue", money(data.stats.totalQuotedRevenue)],
    ["Trainer Costs", money(data.stats.totalTrainerCosts)],
    ["Training Profit", money(data.stats.totalTrainingProfit)]
  ];
  return (
    <>
      <div className="admin-top"><h1>Admin Dashboard</h1></div>
      <div className="stats-grid">{stats.map(([label, value]) => <div className="card" key={label}><strong>{value ?? 0}</strong><p>{label}</p></div>)}</div>
      {(data.trainingReminders || []).length > 0 && (
        <>
          <h2>Upcoming training reminders</h2>
          <div className="training-reminder-grid">
            {(data.trainingReminders || []).map((item) => (
              <article className="training-reminder-card" key={item._id}>
                <span>Upcoming training</span>
                <strong>{item.selectedCourses?.[0]?.title || "Training session"}</strong>
                <p>Upcoming training: {item.selectedCourses?.[0]?.title || "Training session"} for {item.clientName} on {dateLabel(item.trainingDate)} at {item.trainingStartTime}</p>
              </article>
            ))}
          </div>
        </>
      )}
      <h2>Recent training bookings</h2>
      <div className="table-wrap">
        <table><thead><tr><th>Client</th><th>Courses</th><th>Date</th><th>Status</th><th>Payment</th><th>Profit</th></tr></thead><tbody>
          {(data.recentTrainingBookings || []).map((item) => <tr key={item._id}><td>{item.clientName}<br /><span className="muted">{item.contactPersonName}</span></td><td>{item.selectedCourses?.map((course) => course.title).join(", ")}</td><td>{dateLabel(item.trainingDate)}<br /><span className="muted">{item.trainingStartTime}</span></td><td>{item.bookingStatus}</td><td>{item.paymentStatus}</td><td>{money(item.profit)}</td></tr>)}
        </tbody></table>
      </div>
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
