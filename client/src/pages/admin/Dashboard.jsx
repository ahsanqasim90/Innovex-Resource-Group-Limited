import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  GraduationCap,
  LayoutDashboard,
  LineChart,
  Search,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UsersRound
} from "lucide-react";
import { api } from "../../api/client.js";
import { useAuth } from "../../context/AuthContext.jsx";
import { canViewFinance, hasPermission } from "../../auth/permissions.js";

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const showFinance = canViewFinance(user);
  const [data, setData] = useState({ stats: {}, recentApplications: [], recentInterviews: [], recentMeetings: [], trainingReminders: [], recentTrainingBookings: [], recentActivityLogs: [] });
  const [sectionSearch, setSectionSearch] = useState("");
  useEffect(() => {
    api("/dashboard/stats").then(setData).catch(() => {});
  }, []);
  const stats = data.stats || {};
  const heroMetrics = showFinance ? [
    ["Total revenue", money(stats.totalRevenue), LineChart],
    ["Training profit", money(stats.totalTrainingProfit), TrendingUp],
    ["Live jobs", stats.activeJobs ?? 0, BriefcaseBusiness]
  ] : [
    ["Live jobs", stats.activeJobs ?? 0, BriefcaseBusiness],
    ["Pending interviews", stats.pendingInterviews ?? 0, CalendarClock],
    ["Applications", stats.applications ?? 0, UsersRound]
  ];
  const metricGroups = [
    {
      title: "Recruitment pipeline",
      description: "Jobs, applicants, talent pool and placements.",
      Icon: UsersRound,
      metrics: [
        ["Talent pool", stats.totalCandidates],
        ["Available talent", stats.availableCandidates],
        ["Interested talent", stats.interestedTalent],
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
        ["Upcoming meetings", stats.upcomingMeetings],
        ["Calls today", stats.todayCalls],
        ["Call backs due", stats.followUpsDue]
      ]
    },
    {
      title: "Training performance",
      description: showFinance ? "Courses, bookings and training financials." : "Courses, bookings and upcoming training activity.",
      Icon: GraduationCap,
      metrics: [
        ["Training bookings", stats.totalTrainingBookings],
        ["Upcoming training", stats.upcomingTrainingSessions],
        ...(showFinance ? [
        ["Training revenue", money(stats.totalQuotedRevenue)],
        ["Trainer costs", money(stats.totalTrainerCosts)],
        ["Training profit", money(stats.totalTrainingProfit)]
        ] : [])
      ]
    },
    {
      title: "Trust & visibility",
      description: "Reviews, partners and business confidence.",
      Icon: ShieldCheck,
      metrics: [
        ["Partners", stats.partners],
        ["Pending reviews", stats.pendingReviews],
        ...(showFinance ? [["Total revenue", money(stats.totalRevenue)]] : [["New messages", stats.messages]])
      ]
    }
  ];
  const adminSections = useMemo(() => {
    const sections = [
      ["Dashboard", "/admin/dashboard", "overview stats operations", "dashboard.view"],
      ["Jobs", "/admin/jobs", "vacancies roles job adverts", "jobs.view"],
      ["Applications", "/admin/applications", "job applications applicants", "applications.view"],
      ["CV Uploads", "/admin/cv-uploads", "candidate cvs documents", "cvs.view"],
      ["Talent Pool", "/admin/talent-pool", "candidates search sourcing outreach", "talentPool.view"],
      ["Business Leads", "/admin/business-leads", "care homes clients prospects", "businessLeads.view"],
      ["Email Centre", "/admin/emails", "email compose bulk campaigns", "emails.view"],
      ["Client Terms", "/admin/client-terms", "terms commercial schedule rates", "terms.view"],
      ["Call Centre", "/admin/calls", "calls dialler phone outreach", "calls.view"],
      ["Interviews", "/admin/interviews", "candidate interviews placements", "interviews.view"],
      ["Meetings", "/admin/meetings", "appointments meetings reminders", "meetings.view"],
      ["Courses", "/admin/courses", "training courses library", "courses.view"],
      ["Training Bookings", "/admin/training-bookings", "training bookings quotes sessions", "trainingBookings.view"],
      ["Finance Centre", "/admin/finance", "invoices expenses ledger payments", null],
      ["Blogs", "/admin/blogs", "website content seo articles", "blogs.view"],
      ["Testimonials", "/admin/testimonials", "reviews feedback approvals", "testimonials.view"],
      ["Partners", "/admin/partners", "partner logos clients", "partners.view"]
    ];
    const query = sectionSearch.trim().toLowerCase();
    return sections
      .filter(([, path, , permission]) => (path === "/admin/finance" ? showFinance : hasPermission(user, permission)))
      .filter(([label, , keywords]) => !query || `${label} ${keywords}`.toLowerCase().includes(query))
      .slice(0, query ? 8 : 5);
  }, [sectionSearch, showFinance, user]);
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
            <p>{showFinance ? "Track recruitment, interviews, meetings, training revenue and client activity from one professional admin workspace." : "Track recruitment, interviews, meetings, training and client activity from one professional admin workspace."}</p>
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

      <section className="dashboard-section-search" aria-label="Admin section search">
        <div className="dashboard-section-search-box">
          <Search size={19} />
          <input
            value={sectionSearch}
            onChange={(event) => setSectionSearch(event.target.value)}
            placeholder="Search CRM section, e.g. invoices, candidates, calls..."
          />
        </div>
        <div className="dashboard-search-results">
          {adminSections.map(([label, path]) => (
            <button type="button" key={path} className="dashboard-search-card" onClick={() => navigate(path)}>
              <span>{label}</span>
              <ArrowRight size={16} />
            </button>
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
      {showFinance && (data.recentActivityLogs || []).length > 0 && (
        <DashboardSection title="Team activity log" subtitle="Recent actions completed by admin users and employees.">
          <div className="activity-log-grid">
            {(data.recentActivityLogs || []).map((item) => (
              <article className="activity-log-card" key={item._id}>
                <span className="activity-icon"><UserCheck size={18} /></span>
                <div>
                  <strong>{item.summary}</strong>
                  <p>{item.actor?.name || "Team member"} • {item.module} • {new Date(item.createdAt).toLocaleString("en-GB")}</p>
                </div>
                <span className="status-chip table-chip">{item.action}</span>
              </article>
            ))}
          </div>
        </DashboardSection>
      )}
      <DashboardSection title="Recent training bookings" subtitle={showFinance ? "Latest training enquiries, confirmed sessions and profit overview." : "Latest training enquiries, confirmed sessions and course activity."}>
        <div className="table-wrap">
          <table><thead><tr><th>Client</th><th>Courses</th><th>Date</th><th>Status</th>{showFinance && <><th>Payment</th><th>Profit</th></>}</tr></thead><tbody>
            {(data.recentTrainingBookings || []).map((item) => <tr key={item._id}><td>{item.clientName}<br /><span className="muted">{item.contactPersonName}</span></td><td>{item.selectedCourses?.map((course) => course.title).join(", ")}</td><td>{dateLabel(item.trainingDate)}<br /><span className="muted">{item.trainingStartTime}</span></td><td>{item.bookingStatus}</td>{showFinance && <><td>{item.paymentStatus}</td><td>{money(item.profit)}</td></>}</tr>)}
          </tbody></table>
        </div>
      </DashboardSection>
      <DashboardSection title="Recent interviews" subtitle={showFinance ? "Candidate interviews, client details and placement revenue." : "Candidate interviews, client details and outcomes."}>
        <div className="table-wrap">
          <table><thead><tr><th>Candidate</th><th>Job / Client</th><th>Interview</th><th>Status</th><th>Outcome</th>{showFinance && <th>Revenue</th>}</tr></thead><tbody>
            {(data.recentInterviews || []).map((item) => <tr key={item._id}><td>{item.candidateName}<br /><span className="muted">{item.candidateEmail}</span></td><td>{item.jobTitle}<br /><span className="muted">{item.clientName}</span></td><td>{new Date(item.interviewDate).toLocaleDateString()}<br /><span className="muted">{item.interviewTime}</span></td><td>{item.interviewStatus}</td><td>{item.candidateSelected}</td>{showFinance && <td>{money(item.revenue)}</td>}</tr>)}
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
      <DashboardSection title="Recent calls" subtitle="Latest candidate and client call activity from the CRM dialler.">
        <div className="table-wrap">
          <table><thead><tr><th>Contact</th><th>Source</th><th>Status</th><th>Outcome</th><th>Owner</th><th>Date</th></tr></thead><tbody>
            {(data.recentCalls || []).map((item) => <tr key={item._id}><td>{item.targetName}<br /><span className="muted">{item.targetPhone}</span></td><td>{item.sourceModule}</td><td>{item.status}</td><td>{item.outcome}</td><td>{item.initiatedBy?.name || "Team"}</td><td>{new Date(item.createdAt).toLocaleDateString("en-GB")}<br /><span className="muted">{new Date(item.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span></td></tr>)}
            {!(data.recentCalls || []).length && <tr><td colSpan="6">No calls logged yet.</td></tr>}
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
