import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import Home from "./pages/Home.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { canViewFinance, hasPermission } from "./auth/permissions.js";
import "./styles.css";

const AdminLayout = React.lazy(() => import("./layouts/AdminLayout.jsx"));
const About = React.lazy(() => import("./pages/About.jsx"));
const BlogDetail = React.lazy(() => import("./pages/BlogDetail.jsx"));
const Blogs = React.lazy(() => import("./pages/Blogs.jsx"));
const Contact = React.lazy(() => import("./pages/Contact.jsx"));
const Courses = React.lazy(() => import("./pages/Courses.jsx"));
const CRMSystems = React.lazy(() => import("./pages/CRMSystems.jsx"));
const Jobs = React.lazy(() => import("./pages/Jobs.jsx"));
const Partners = React.lazy(() => import("./pages/Partners.jsx"));
const Services = React.lazy(() => import("./pages/Services.jsx"));
const ServiceLanding = React.lazy(() => import("./pages/ServiceLanding.jsx"));
const Testimonials = React.lazy(() => import("./pages/Testimonials.jsx"));
const UploadCv = React.lazy(() => import("./pages/UploadCv.jsx"));
const HireStaff = React.lazy(() => import("./pages/HireStaff.jsx"));
const NotFound = React.lazy(() => import("./pages/NotFound.jsx"));
const Newsletters = React.lazy(() => import("./pages/Newsletters.jsx"));
const NewsletterUnsubscribe = React.lazy(() => import("./pages/NewsletterUnsubscribe.jsx"));
const PrivacyNotice = React.lazy(() => import("./pages/PrivacyNotice.jsx"));
const PasswordRecovery = React.lazy(() => import("./pages/PasswordRecovery.jsx"));
const AcceptInvitation = React.lazy(() => import("./pages/AcceptInvitation.jsx"));
const ProductPolicyPage = React.lazy(() => import("./pages/ProductPolicyPage.jsx"));
const PortalAccess = React.lazy(() => import("./pages/PortalAccess.jsx"));
const PortalDashboard = React.lazy(() => import("./pages/PortalDashboard.jsx"));
const Login = React.lazy(() => import("./pages/admin/Login.jsx"));
const Dashboard = React.lazy(() => import("./pages/admin/Dashboard.jsx"));
const AdminBlogs = React.lazy(() => import("./pages/admin/AdminBlogs.jsx"));
const AdminCourses = React.lazy(() => import("./pages/admin/AdminCourses.jsx"));
const AdminEmailCentre = React.lazy(() => import("./pages/admin/AdminEmailCentre.jsx"));
const AdminNewsletterCentre = React.lazy(() => import("./pages/admin/AdminNewsletterCentre.jsx"));
const AdminJobs = React.lazy(() => import("./pages/admin/AdminJobs.jsx"));
const AdminApplications = React.lazy(() => import("./pages/admin/AdminApplications.jsx"));
const AdminRecruitmentAts = React.lazy(() => import("./pages/admin/AdminRecruitmentAts.jsx"));
const AdminAttendance = React.lazy(() => import("./pages/admin/AdminAttendance.jsx"));
const AdminCvs = React.lazy(() => import("./pages/admin/AdminCvs.jsx"));
const AdminTalentPool = React.lazy(() => import("./pages/admin/AdminTalentPool.jsx"));
const AdminCandidateCommunications = React.lazy(() => import("./pages/admin/AdminCandidateCommunications.jsx"));
const AdminCvLibrary = React.lazy(() => import("./pages/admin/AdminCvLibrary.jsx"));
const AdminVacancyIntelligence = React.lazy(() => import("./pages/admin/AdminVacancyIntelligence.jsx"));
const AdminBusinessLeads = React.lazy(() => import("./pages/admin/AdminBusinessLeads.jsx"));
const AdminCalls = React.lazy(() => import("./pages/admin/AdminCalls.jsx"));
const AdminInterviews = React.lazy(() => import("./pages/admin/AdminInterviews.jsx"));
const AdminMeetings = React.lazy(() => import("./pages/admin/AdminMeetings.jsx"));
const AdminTrainingBookings = React.lazy(() => import("./pages/admin/AdminTrainingBookings.jsx"));
const AdminTrainingQuotations = React.lazy(() => import("./pages/admin/AdminTrainingQuotations.jsx"));
const AdminClientTerms = React.lazy(() => import("./pages/admin/AdminClientTerms.jsx"));
const AdminFinance = React.lazy(() => import("./pages/admin/AdminFinance.jsx"));
const AdminSalarySlips = React.lazy(() => import("./pages/admin/AdminSalarySlips.jsx"));
const AdminOfferLetters = React.lazy(() => import("./pages/admin/AdminOfferLetters.jsx"));
const AdminTestimonials = React.lazy(() => import("./pages/admin/AdminTestimonials.jsx"));
const AdminPartners = React.lazy(() => import("./pages/admin/AdminPartners.jsx"));
const AdminContactMessages = React.lazy(() => import("./pages/admin/AdminContactMessages.jsx"));
const AdminClientAccounts = React.lazy(() => import("./pages/admin/AdminClientAccounts.jsx"));
const AdminWorkspaceSettings = React.lazy(() => import("./pages/admin/AdminWorkspaceSettings.jsx"));
const AdminArchive = React.lazy(() => import("./pages/admin/AdminArchive.jsx"));
const AdminOperations = React.lazy(() => import("./pages/admin/AdminOperations.jsx"));
const AdminAutomations = React.lazy(() => import("./pages/admin/AdminAutomations.jsx"));
const AdminCompliance = React.lazy(() => import("./pages/admin/AdminCompliance.jsx"));
const AdminReports = React.lazy(() => import("./pages/admin/AdminReports.jsx"));
const AdminPortals = React.lazy(() => import("./pages/admin/AdminPortals.jsx"));
const AdminIntegrations = React.lazy(() => import("./pages/admin/AdminIntegrations.jsx"));
const AdminScheduling = React.lazy(() => import("./pages/admin/AdminScheduling.jsx"));
const AdminTeam = React.lazy(() => import("./pages/admin/AdminTeam.jsx"));
const AdminSuggestions = React.lazy(() => import("./pages/admin/AdminSuggestions.jsx"));
const AdminWebLeads = React.lazy(() => import("./pages/admin/AdminWebLeads.jsx"));

function RequireAuth({ children }) {
  const { user, loadingUser } = useAuth();
  if (loadingUser) return <div className="admin-loading-screen">Loading secure admin...</div>;
  return user ? children : <Navigate to="/admin/login" replace />;
}

function RequirePermission({ permission, children }) {
  const { user, loadingUser } = useAuth();
  if (loadingUser) return <div className="admin-loading-screen">Checking permissions...</div>;
  if (!hasPermission(user, permission)) {
    return (
      <section className="card admin-denied-card">
        <h1>Access restricted</h1>
        <p>Your account does not have permission to view this admin area.</p>
      </section>
    );
  }
  return children;
}

function RequireFinance({ children }) {
  const { user, loadingUser } = useAuth();
  if (loadingUser) return <div className="admin-loading-screen">Checking finance access...</div>;
  return canViewFinance(user) ? children : <Navigate to="/admin/dashboard" replace />;
}

function AdminIndexRedirect() {
  const { user, loadingUser } = useAuth();
  if (loadingUser) return <div className="admin-loading-screen">Loading secure workspace...</div>;
  return <Navigate to={hasPermission(user, "dashboard.view") ? "/admin/dashboard" : hasPermission(user, "attendance.view") ? "/admin/attendance" : hasPermission(user, "webLeads.view") ? "/admin/web-leads" : "/admin/login"} replace />;
}

function WebLeadPage({ mode }) {
  return <React.Suspense fallback={<div className="admin-loading-screen">Loading Web Leads CRM...</div>}><AdminWebLeads mode={mode} /></React.Suspense>;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <React.Suspense fallback={<div className="route-loading-screen">Loading Innovex...</div>}>
          <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/services" element={<Services />} />
            <Route path="/healthcare-recruitment" element={<ServiceLanding service="recruitment" />} />
            <Route path="/hire-staff" element={<HireStaff />} />
            <Route path="/website-development" element={<ServiceLanding service="websites" />} />
            <Route path="/seo-services" element={<ServiceLanding service="seo" />} />
            <Route path="/crm-systems" element={<CRMSystems />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/jobs/:jobId" element={<Jobs />} />
            <Route path="/blogs" element={<Blogs />} />
            <Route path="/blogs/:slug" element={<BlogDetail />} />
            <Route path="/newsletters" element={<Newsletters />} />
            <Route path="/newsletters/:slug" element={<Newsletters />} />
            <Route path="/newsletter/unsubscribe/:token" element={<NewsletterUnsubscribe />} />
            <Route path="/privacy" element={<PrivacyNotice />} />
            <Route path="/security" element={<ProductPolicyPage page="security" />} />
            <Route path="/terms" element={<ProductPolicyPage page="terms" />} />
            <Route path="/dpa" element={<ProductPolicyPage page="dpa" />} />
            <Route path="/subprocessors" element={<ProductPolicyPage page="subprocessors" />} />
            <Route path="/status" element={<ProductPolicyPage page="status" />} />
            <Route path="/support" element={<ProductPolicyPage page="support" />} />
            <Route path="/pricing" element={<ProductPolicyPage page="pricing" />} />
            <Route path="/testimonials" element={<Testimonials />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/upload-cv" element={<UploadCv />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route path="/admin/login" element={<Login />} />
          <Route path="/forgot-password" element={<PasswordRecovery mode="request" />} />
          <Route path="/reset-password" element={<PasswordRecovery mode="reset" />} />
          <Route path="/accept-invitation" element={<AcceptInvitation />} />
          <Route path="/portal/login" element={<PortalAccess mode="login" />} />
          <Route path="/portal/activate" element={<PortalAccess mode="activate" />} />
          <Route path="/portal" element={<PortalDashboard />} />
          <Route
            path="/admin"
            element={
              <RequireAuth>
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<AdminIndexRedirect />} />
            <Route path="dashboard" element={<RequirePermission permission="dashboard.view"><Dashboard /></RequirePermission>} />
            <Route path="attendance" element={<RequirePermission permission="attendance.view"><AdminAttendance /></RequirePermission>} />
            <Route path="jobs" element={<RequirePermission permission="jobs.view"><AdminJobs /></RequirePermission>} />
            <Route path="applications" element={<RequirePermission permission="applications.view"><AdminApplications /></RequirePermission>} />
            <Route path="recruitment-ats" element={<RequirePermission permission="recruitmentPipeline.view"><AdminRecruitmentAts /></RequirePermission>} />
            <Route path="cv-uploads" element={<RequirePermission permission="cvs.view"><AdminCvs /></RequirePermission>} />
            <Route path="cv-library" element={<RequirePermission permission="candidateCvs.view"><AdminCvLibrary /></RequirePermission>} />
            <Route path="vacancy-intelligence" element={<RequirePermission permission="vacancyIntelligence.view"><AdminVacancyIntelligence /></RequirePermission>} />
            <Route path="talent-pool" element={<RequirePermission permission="talentPool.view"><AdminTalentPool /></RequirePermission>} />
            <Route path="candidate-communications" element={<RequirePermission permission="talentPool.view"><AdminCandidateCommunications /></RequirePermission>} />
            <Route path="business-leads" element={<RequirePermission permission="businessLeads.view"><AdminBusinessLeads /></RequirePermission>} />
            <Route path="emails" element={<RequirePermission permission="emails.view"><AdminEmailCentre /></RequirePermission>} />
            <Route path="newsletters" element={<RequirePermission permission="newsletters.view"><AdminNewsletterCentre /></RequirePermission>} />
            <Route path="calls" element={<RequirePermission permission="calls.view"><AdminCalls /></RequirePermission>} />
            <Route path="interviews" element={<RequirePermission permission="interviews.view"><AdminInterviews /></RequirePermission>} />
            <Route path="scheduling" element={<RequirePermission permission="interviews.view"><AdminScheduling /></RequirePermission>} />
            <Route path="meetings" element={<RequirePermission permission="meetings.view"><AdminMeetings /></RequirePermission>} />
            <Route path="courses" element={<RequirePermission permission="courses.view"><AdminCourses /></RequirePermission>} />
            <Route path="training-bookings" element={<RequirePermission permission="trainingBookings.view"><AdminTrainingBookings /></RequirePermission>} />
            <Route path="training-quotations" element={<RequirePermission permission="trainingQuotations.view"><AdminTrainingQuotations /></RequirePermission>} />
            <Route path="client-terms" element={<RequirePermission permission="terms.view"><AdminClientTerms /></RequirePermission>} />
            <Route path="finance" element={<RequireFinance><AdminFinance /></RequireFinance>} />
            <Route path="salary-slips" element={<RequirePermission permission="salarySlips.view"><AdminSalarySlips /></RequirePermission>} />
            <Route path="offer-letters" element={<RequirePermission permission="offerLetters.view"><AdminOfferLetters /></RequirePermission>} />
            <Route path="blogs" element={<RequirePermission permission="blogs.view"><AdminBlogs /></RequirePermission>} />
            <Route path="testimonials" element={<RequirePermission permission="testimonials.view"><AdminTestimonials /></RequirePermission>} />
            <Route path="partners" element={<RequirePermission permission="partners.view"><AdminPartners /></RequirePermission>} />
            <Route path="website-enquiries" element={<RequirePermission permission="contacts.view"><AdminContactMessages /></RequirePermission>} />
            <Route path="organisations" element={<RequirePermission permission="clients.view"><AdminClientAccounts /></RequirePermission>} />
            <Route path="workspace-settings" element={<RequirePermission permission="organization.manage"><AdminWorkspaceSettings /></RequirePermission>} />
            <Route path="archive" element={<RequirePermission permission="archive.manage"><AdminArchive /></RequirePermission>} />
            <Route path="operations" element={<RequirePermission permission="audit.view"><AdminOperations /></RequirePermission>} />
            <Route path="automations" element={<RequirePermission permission="automations.view"><AdminAutomations /></RequirePermission>} />
            <Route path="compliance" element={<RequirePermission permission="compliance.view"><AdminCompliance /></RequirePermission>} />
            <Route path="reports" element={<RequirePermission permission="reports.view"><AdminReports /></RequirePermission>} />
            <Route path="portals" element={<RequirePermission permission="portals.manage"><AdminPortals /></RequirePermission>} />
            <Route path="integrations" element={<RequirePermission permission="integrations.manage"><AdminIntegrations /></RequirePermission>} />
            <Route path="team" element={<RequirePermission permission="team.manage"><AdminTeam /></RequirePermission>} />
            <Route path="suggestions" element={<AdminSuggestions />} />
            <Route path="web-leads" element={<RequirePermission permission="webLeads.view"><WebLeadPage mode="dashboard" /></RequirePermission>} />
            <Route path="web-leads/add" element={<RequirePermission permission="webLeads.view"><WebLeadPage mode="add" /></RequirePermission>} />
            <Route path="web-leads/prospects" element={<RequirePermission permission="webLeads.view"><WebLeadPage mode="prospects" /></RequirePermission>} />
            <Route path="web-leads/emails" element={<RequirePermission permission="webLeads.view"><WebLeadPage mode="emails" /></RequirePermission>} />
            <Route path="web-leads/follow-ups" element={<RequirePermission permission="webLeads.view"><WebLeadPage mode="followups" /></RequirePermission>} />
            <Route path="web-leads/qualified" element={<RequirePermission permission="webLeads.view"><WebLeadPage mode="qualified" /></RequirePermission>} />
            <Route path="web-leads/meetings" element={<RequirePermission permission="webLeads.view"><WebLeadPage mode="meetings" /></RequirePermission>} />
            <Route path="web-leads/templates" element={<RequirePermission permission="webLeads.view"><WebLeadPage mode="templates" /></RequirePermission>} />
            <Route path="web-leads/reports" element={<RequirePermission permission="webLeads.view"><WebLeadPage mode="reports" /></RequirePermission>} />
            <Route path="web-leads/settings" element={<RequirePermission permission="webLeads.settings"><WebLeadPage mode="settings" /></RequirePermission>} />
          </Route>
          </Routes>
        </React.Suspense>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
