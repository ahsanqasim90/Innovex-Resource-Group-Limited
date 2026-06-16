import { useEffect, useState } from "react";
import {
  BriefcaseBusiness,
  CalendarClock,
  GraduationCap,
  LayoutDashboard,
  LineChart,
  ShieldCheck,
  TrendingUp
} from "lucide-react";
import { api } from "../../api/client.js";

function money(value) {
  return `\u00a3${Number(value || 0).toLocaleString()}`;
}

function dateLabel(value) {
  return value ? new Date(value).toLocaleDateString("en-GB") : "-";
}

function DashboardSection({ title, subtitle, children }) {
  return (
    <section className="dashboard-section-card">
      <div className="dashboard-section-head">
        <div>
          <span>Recent activity</span>
          <h2>{title}</h2>
        </div>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

export default function Dashboard() {
  const [data, setData] = useState({ stats: {}, recentApplications: [], recentInterviews: [], recentMeetings: [], trainingReminders: [], recentTrainingBookings: [] });
  useEffect(() => {
    api("/dashboard/stats").then(setData).catch(() => {});
  }, []);
  const stats = data.stats || {};
  const heroMetrics = [
    ["Total revenue", money(stats.totalRevenue), LineChart],
    ["Training profit", money(stats.totalTrainingProfit), TrendingUp],
    ["Live jobs", stats.activeJobs ?? 0, BriefcaseBusiness]
  ];
  const metricGroups = [
    {
      title: "Recruitment pipeline",
      description: "Jobs, applicants, CVs and placements.",
      Icon: BriefcaseBusiness,
      metrics: [
        ["Active jobs", stats.activeJobs],
        ["Applications", stats.applications],
        ["New CVs", stats.newCvs],
        ["Placements", stats.placements]
      ]
    },
    {
      title: "Interviews & outcomes",
      description: "Candidate progress and meeting activity.",
      Icon: CalendarClock,
      metrics: [
        ["Pending interviews", stats.pendingInterviews],
        ["Selected candidates", stats.selectedCandidates],
        ["Rejected candidates", stats.rejectedCandidates],
        ["Upcoming meetings", stats.upcomingMeetings]
      ]
    },
    {
      title: "Training performance",
      description: "Courses, bookings and training financials.",
      Icon: GraduationCap,
      metrics: [
        ["Training bookings", stats.totalTrainingBookings],
        ["Upcoming training", stats.upcomingTrainingSessions],
        ["Training revenue", money(stats.totalQuotedRevenue)],
        ["Trainer costs", money(stats.totalTrainerCosts)],
        ["Training profit", money(stats.totalTrainingProfit)]
      ]
    },
    {
      title: "Trust & visibility",
      description: "Reviews, partners and business confidence.",
      Icon: ShieldCheck,
      metrics: [
        ["Partners", stats.partners],
        ["Pending reviews", stats.pendingReviews],
        ["Total revenue", money(stats.totalRevenue)]
      ]
    }
  ];
  return (
    <>
      <section className="dashboard-hero">
        <div className="dashboard-hero-brand">
          <div className="dashboard-logo-panel">
            <img src="/Logo.png" alt="Innovex Resource Group Limited logo" />
          </div>
          <div>
            <span className="eyebrow">Innovex Resource Group Limited</span>
            <h1><LayoutDashboard size={30} /> Operations Dashboard</h1>
            <p>Track recruitment, interviews, meetings, training revenue and client activity from one professional admin workspace.</p>
          </div>
        </div>
        <div className="dashboard-hero-metrics">
          {heroMetrics.map(([label, value, Icon]) => (
            <article className="dashboard-hero-metric" key={label}>
              <Icon size={20} />
              <span>{label}</span>
              <strong>{value}</strong>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-kpi-grid">
        {metricGroups.map(({ title, description, Icon, metrics }) => (
          <article className="dashboard-kpi-panel" key={title}>
            <div className="dashboard-kpi-header">
              <div className="dashboard-kpi-icon"><Icon size={22} /></div>
              <div>
                <h2>{title}</h2>
                <p>{description}</p>
              </div>
            </div>
            <div className="dashboard-kpi-list">
              {metrics.map(([label, value]) => (
                <div className="dashboard-kpi-item" key={label}>
                  <span>{label}</span>
                  <strong>{value ?? 0}</strong>
                </div>
              ))}
            </div>
          </article>
        ))}
      </section>

      {(data.trainingReminders || []).length > 0 && (
        <DashboardSection title="Upcoming training reminders" subtitle="Sessions happening within the next 48 hours.">
          <div className="training-reminder-grid">
            {(data.trainingReminders || []).map((item) => (
              <article className="training-reminder-card" key={item._id}>
                <span>Upcoming training</span>
                <strong>{item.selectedCourses?.[0]?.title || "Training session"}</strong>
                <p>Upcoming training: {item.selectedCourses?.[0]?.title || "Training session"} for {item.clientName} on {dateLabel(item.trainingDate)} at {item.trainingStartTime}</p>
              </article>
            ))}
          </div>
        </DashboardSection>
      )}
      <DashboardSection title="Recent training bookings" subtitle="Latest training enquiries, confirmed sessions and profit overview.">
        <div className="table-wrap">
          <table><thead><tr><th>Client</th><th>Courses</th><th>Date</th><th>Status</th><th>Payment</th><th>Profit</th></tr></thead><tbody>
            {(data.recentTrainingBookings || []).map((item) => <tr key={item._id}><td>{item.clientName}<br /><span className="muted">{item.contactPersonName}</span></td><td>{item.selectedCourses?.map((course) => course.title).join(", ")}</td><td>{dateLabel(item.trainingDate)}<br /><span className="muted">{item.trainingStartTime}</span></td><td>{item.bookingStatus}</td><td>{item.paymentStatus}</td><td>{money(item.profit)}</td></tr>)}
          </tbody></table>
        </div>
      </DashboardSection>
      <DashboardSection title="Recent interviews" subtitle="Candidate interviews, client details and placement revenue.">
        <div className="table-wrap">
          <table><thead><tr><th>Candidate</th><th>Job / Client</th><th>Interview</th><th>Status</th><th>Outcome</th><th>Revenue</th></tr></thead><tbody>
            {(data.recentInterviews || []).map((item) => <tr key={item._id}><td>{item.candidateName}<br /><span className="muted">{item.candidateEmail}</span></td><td>{item.jobTitle}<br /><span className="muted">{item.clientName}</span></td><td>{new Date(item.interviewDate).toLocaleDateString()}<br /><span className="muted">{item.interviewTime}</span></td><td>{item.interviewStatus}</td><td>{item.candidateSelected}</td><td>{money(item.revenue)}</td></tr>)}
          </tbody></table>
        </div>
      </DashboardSection>
      <DashboardSection title="Recent meetings" subtitle="Upcoming and recent business meetings.">
        <div className="table-wrap">
          <table><thead><tr><th>Attendee</th><th>Company</th><th>Meeting</th><th>Date</th><th>Status</th></tr></thead><tbody>
            {(data.recentMeetings || []).map((item) => <tr key={item._id}><td>{item.attendeeName}<br /><span className="muted">{item.attendeeEmail || item.attendeePhone || "No contact added"}</span></td><td>{item.companyName}</td><td>{item.meetingTitle}<br /><span className="muted">{item.meetingPurpose}</span></td><td>{new Date(item.meetingDate).toLocaleDateString()}<br /><span className="muted">{item.meetingTime}</span></td><td>{item.meetingStatus}</td></tr>)}
          </tbody></table>
        </div>
      </DashboardSection>
      <DashboardSection title="Recent applications" subtitle="Latest candidate applications from the public website.">
        <div className="table-wrap">
          <table><thead><tr><th>Candidate</th><th>Job</th><th>Status</th><th>Date</th></tr></thead><tbody>
            {(data.recentApplications || []).map((item) => <tr key={item._id}><td>{item.name}<br /><span className="muted">{item.email}</span></td><td>{item.job?.title || "Deleted job"}</td><td>{item.status}</td><td>{new Date(item.createdAt).toLocaleDateString()}</td></tr>)}
          </tbody></table>
        </div>
      </DashboardSection>
    </>
  );
}
