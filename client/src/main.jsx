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
import AdminJobs from "./pages/admin/AdminJobs.jsx";
import AdminApplications from "./pages/admin/AdminApplications.jsx";
import AdminCvs from "./pages/admin/AdminCvs.jsx";
import AdminTalentPool from "./pages/admin/AdminTalentPool.jsx";
import AdminBusinessLeads from "./pages/admin/AdminBusinessLeads.jsx";
import AdminInterviews from "./pages/admin/AdminInterviews.jsx";
import AdminMeetings from "./pages/admin/AdminMeetings.jsx";
import AdminTrainingBookings from "./pages/admin/AdminTrainingBookings.jsx";
import AdminTestimonials from "./pages/admin/AdminTestimonials.jsx";
import AdminPartners from "./pages/admin/AdminPartners.jsx";
import AdminTeam from "./pages/admin/AdminTeam.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { hasPermission } from "./auth/permissions.js";
import "./styles.css";

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
            <Route index element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="dashboard" element={<RequirePermission permission="dashboard.view"><Dashboard /></RequirePermission>} />
            <Route path="jobs" element={<RequirePermission permission="jobs.view"><AdminJobs /></RequirePermission>} />
            <Route path="applications" element={<RequirePermission permission="applications.view"><AdminApplications /></RequirePermission>} />
            <Route path="cv-uploads" element={<RequirePermission permission="cvs.view"><AdminCvs /></RequirePermission>} />
            <Route path="talent-pool" element={<RequirePermission permission="talentPool.view"><AdminTalentPool /></RequirePermission>} />
            <Route path="business-leads" element={<RequirePermission permission="businessLeads.view"><AdminBusinessLeads /></RequirePermission>} />
            <Route path="interviews" element={<RequirePermission permission="interviews.view"><AdminInterviews /></RequirePermission>} />
            <Route path="meetings" element={<RequirePermission permission="meetings.view"><AdminMeetings /></RequirePermission>} />
            <Route path="courses" element={<RequirePermission permission="courses.view"><AdminCourses /></RequirePermission>} />
            <Route path="training-bookings" element={<RequirePermission permission="trainingBookings.view"><AdminTrainingBookings /></RequirePermission>} />
            <Route path="blogs" element={<RequirePermission permission="blogs.view"><AdminBlogs /></RequirePermission>} />
            <Route path="testimonials" element={<RequirePermission permission="testimonials.view"><AdminTestimonials /></RequirePermission>} />
            <Route path="partners" element={<RequirePermission permission="partners.view"><AdminPartners /></RequirePermission>} />
            <Route path="team" element={<RequirePermission permission="team.manage"><AdminTeam /></RequirePermission>} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
