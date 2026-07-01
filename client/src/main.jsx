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
const Jobs = React.lazy(() => import("./pages/Jobs.jsx"));
const Partners = React.lazy(() => import("./pages/Partners.jsx"));
const Services = React.lazy(() => import("./pages/Services.jsx"));
const ServiceLanding = React.lazy(() => import("./pages/ServiceLanding.jsx"));
const Testimonials = React.lazy(() => import("./pages/Testimonials.jsx"));
const UploadCv = React.lazy(() => import("./pages/UploadCv.jsx"));
const Login = React.lazy(() => import("./pages/admin/Login.jsx"));
const Dashboard = React.lazy(() => import("./pages/admin/Dashboard.jsx"));
const AdminBlogs = React.lazy(() => import("./pages/admin/AdminBlogs.jsx"));
const AdminCourses = React.lazy(() => import("./pages/admin/AdminCourses.jsx"));
const AdminEmailCentre = React.lazy(() => import("./pages/admin/AdminEmailCentre.jsx"));
const AdminJobs = React.lazy(() => import("./pages/admin/AdminJobs.jsx"));
const AdminApplications = React.lazy(() => import("./pages/admin/AdminApplications.jsx"));
const AdminCvs = React.lazy(() => import("./pages/admin/AdminCvs.jsx"));
const AdminTalentPool = React.lazy(() => import("./pages/admin/AdminTalentPool.jsx"));
const AdminBusinessLeads = React.lazy(() => import("./pages/admin/AdminBusinessLeads.jsx"));
const AdminCalls = React.lazy(() => import("./pages/admin/AdminCalls.jsx"));
const AdminInterviews = React.lazy(() => import("./pages/admin/AdminInterviews.jsx"));
const AdminMeetings = React.lazy(() => import("./pages/admin/AdminMeetings.jsx"));
const AdminTrainingBookings = React.lazy(() => import("./pages/admin/AdminTrainingBookings.jsx"));
const AdminFinance = React.lazy(() => import("./pages/admin/AdminFinance.jsx"));
const AdminTestimonials = React.lazy(() => import("./pages/admin/AdminTestimonials.jsx"));
const AdminPartners = React.lazy(() => import("./pages/admin/AdminPartners.jsx"));
const AdminTeam = React.lazy(() => import("./pages/admin/AdminTeam.jsx"));
const AdminWebLeads = React.lazy(() => import("./pages/admin/AdminWebLeads.jsx"));

function RequireAuth({ children }) {
  const token = localStorage.getItem("innovexToken");
  const { loadingUser } = useAuth();
  if (token && loadingUser) return <div className="admin-loading-screen">Loading secure admin...</div>;
  return token ? children : <Navigate to="/admin/login" replace />;
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
  return <Navigate to={hasPermission(user, "dashboard.view") ? "/admin/dashboard" : hasPermission(user, "webLeads.view") ? "/admin/web-leads" : "/admin/login"} replace />;
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
            <Route path="/website-development" element={<ServiceLanding service="websites" />} />
            <Route path="/seo-services" element={<ServiceLanding service="seo" />} />
            <Route path="/courses" element={<Courses />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/blogs" element={<Blogs />} />
            <Route path="/blogs/:slug" element={<BlogDetail />} />
            <Route path="/testimonials" element={<Testimonials />} />
            <Route path="/partners" element={<Partners />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/upload-cv" element={<UploadCv />} />
          </Route>
          <Route path="/admin/login" element={<Login />} />
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
            <Route path="jobs" element={<RequirePermission permission="jobs.view"><AdminJobs /></RequirePermission>} />
            <Route path="applications" element={<RequirePermission permission="applications.view"><AdminApplications /></RequirePermission>} />
            <Route path="cv-uploads" element={<RequirePermission permission="cvs.view"><AdminCvs /></RequirePermission>} />
            <Route path="talent-pool" element={<RequirePermission permission="talentPool.view"><AdminTalentPool /></RequirePermission>} />
            <Route path="business-leads" element={<RequirePermission permission="businessLeads.view"><AdminBusinessLeads /></RequirePermission>} />
            <Route path="emails" element={<RequirePermission permission="emails.view"><AdminEmailCentre /></RequirePermission>} />
            <Route path="calls" element={<RequirePermission permission="calls.view"><AdminCalls /></RequirePermission>} />
            <Route path="interviews" element={<RequirePermission permission="interviews.view"><AdminInterviews /></RequirePermission>} />
            <Route path="meetings" element={<RequirePermission permission="meetings.view"><AdminMeetings /></RequirePermission>} />
            <Route path="courses" element={<RequirePermission permission="courses.view"><AdminCourses /></RequirePermission>} />
            <Route path="training-bookings" element={<RequirePermission permission="trainingBookings.view"><AdminTrainingBookings /></RequirePermission>} />
            <Route path="finance" element={<RequireFinance><AdminFinance /></RequireFinance>} />
            <Route path="blogs" element={<RequirePermission permission="blogs.view"><AdminBlogs /></RequirePermission>} />
            <Route path="testimonials" element={<RequirePermission permission="testimonials.view"><AdminTestimonials /></RequirePermission>} />
            <Route path="partners" element={<RequirePermission permission="partners.view"><AdminPartners /></RequirePermission>} />
            <Route path="team" element={<RequirePermission permission="team.manage"><AdminTeam /></RequirePermission>} />
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
