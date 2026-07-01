import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AppLayout from "./layouts/AppLayout.jsx";
import AdminLayout from "./layouts/AdminLayout.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import About from "./pages/About.jsx";
import BlogDetail from "./pages/BlogDetail.jsx";
import Blogs from "./pages/Blogs.jsx";
import Contact from "./pages/Contact.jsx";
import Courses from "./pages/Courses.jsx";
import Home from "./pages/Home.jsx";
import Jobs from "./pages/Jobs.jsx";
import Partners from "./pages/Partners.jsx";
import Services from "./pages/Services.jsx";
import Testimonials from "./pages/Testimonials.jsx";
import UploadCv from "./pages/UploadCv.jsx";
import Login from "./pages/admin/Login.jsx";
import Dashboard from "./pages/admin/Dashboard.jsx";
import AdminBlogs from "./pages/admin/AdminBlogs.jsx";
import AdminCourses from "./pages/admin/AdminCourses.jsx";
import AdminEmailCentre from "./pages/admin/AdminEmailCentre.jsx";
import AdminJobs from "./pages/admin/AdminJobs.jsx";
import AdminApplications from "./pages/admin/AdminApplications.jsx";
import AdminCvs from "./pages/admin/AdminCvs.jsx";
import AdminTalentPool from "./pages/admin/AdminTalentPool.jsx";
import AdminBusinessLeads from "./pages/admin/AdminBusinessLeads.jsx";
import AdminCalls from "./pages/admin/AdminCalls.jsx";
import AdminInterviews from "./pages/admin/AdminInterviews.jsx";
import AdminMeetings from "./pages/admin/AdminMeetings.jsx";
import AdminTrainingBookings from "./pages/admin/AdminTrainingBookings.jsx";
import AdminFinance from "./pages/admin/AdminFinance.jsx";
import AdminTestimonials from "./pages/admin/AdminTestimonials.jsx";
import AdminPartners from "./pages/admin/AdminPartners.jsx";
import AdminTeam from "./pages/admin/AdminTeam.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { canViewFinance, hasPermission } from "./auth/permissions.js";
import "./styles.css";

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
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/about" element={<About />} />
            <Route path="/services" element={<Services />} />
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
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
