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
import Home from "./pages/Home.jsx";
import Jobs from "./pages/Jobs.jsx";
import Partners from "./pages/Partners.jsx";
import Services from "./pages/Services.jsx";
import Testimonials from "./pages/Testimonials.jsx";
import UploadCv from "./pages/UploadCv.jsx";
import Login from "./pages/admin/Login.jsx";
import Dashboard from "./pages/admin/Dashboard.jsx";
import AdminBlogs from "./pages/admin/AdminBlogs.jsx";
import AdminJobs from "./pages/admin/AdminJobs.jsx";
import AdminApplications from "./pages/admin/AdminApplications.jsx";
import AdminCvs from "./pages/admin/AdminCvs.jsx";
import AdminInterviews from "./pages/admin/AdminInterviews.jsx";
import AdminTestimonials from "./pages/admin/AdminTestimonials.jsx";
import AdminPartners from "./pages/admin/AdminPartners.jsx";
import "./styles.css";

function RequireAuth({ children }) {
  const token = localStorage.getItem("innovexToken");
  return token ? children : <Navigate to="/admin/login" replace />;
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
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="jobs" element={<AdminJobs />} />
            <Route path="applications" element={<AdminApplications />} />
            <Route path="cv-uploads" element={<AdminCvs />} />
            <Route path="interviews" element={<AdminInterviews />} />
            <Route path="blogs" element={<AdminBlogs />} />
            <Route path="testimonials" element={<AdminTestimonials />} />
            <Route path="partners" element={<AdminPartners />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
