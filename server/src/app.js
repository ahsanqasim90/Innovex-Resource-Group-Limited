import "./tenancy/tenantPlugin.js";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import { resolveTenant } from "./middleware/tenant.js";

dotenv.config();

const app = express();

// Serverless functions should not evaluate every admin module for a simple
// login or public-content request. Cache each dynamic import after its first
// use in a warm function instance.
function lazyRoute(loader) {
  let routePromise;
  return async function loadRoute(req, res, next) {
    try {
      routePromise ||= loader().then((module) => module.default);
      const route = await routePromise;
      return route(req, res, next);
    } catch (error) {
      routePromise = undefined;
      return next(error);
    }
  };
}

app.use(helmet({
  crossOriginResourcePolicy: { policy: "same-site" },
  referrerPolicy: { policy: "no-referrer" },
  strictTransportSecurity: { maxAge: 31536000, includeSubDomains: true, preload: true }
}));
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store, max-age=0");
  res.set("Pragma", "no-cache");
  next();
});
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: true, legacyHeaders: false }));

app.get("/api/health", (req, res) => res.json({ status: "ok", service: "Innovex API" }));
app.use("/api", resolveTenant);
app.use("/api/auth", lazyRoute(() => import("./routes/authRoutes.js")));
app.use("/api/v1", lazyRoute(() => import("./routes/publicApiRoutes.js")));
app.use("/api/blogs", lazyRoute(() => import("./routes/blogRoutes.js")));
app.use("/api/business-leads", lazyRoute(() => import("./routes/businessLeadRoutes.js")));
app.use("/api/calls", lazyRoute(() => import("./routes/callRoutes.js")));
app.use("/api/candidates", lazyRoute(() => import("./routes/candidateRoutes.js")));
app.use("/api/candidate-cvs", lazyRoute(() => import("./routes/candidateCvRoutes.js")));
app.use("/api/candidate-communications", lazyRoute(() => import("./routes/candidateCommunicationRoutes.js")));
app.use("/api/client-accounts", lazyRoute(() => import("./routes/clientAccountRoutes.js")));
app.use("/api/jobs", lazyRoute(() => import("./routes/jobRoutes.js")));
app.use("/api/applications", lazyRoute(() => import("./routes/applicationRoutes.js")));
app.use("/api/analytics", lazyRoute(() => import("./routes/analyticsRoutes.js")));
app.use("/api/automations", lazyRoute(() => import("./routes/automationRoutes.js")));
app.use("/api/archive", lazyRoute(() => import("./routes/archiveRoutes.js")));
app.use("/api/portal-notifications", lazyRoute(() => import("./routes/portalNotificationRoutes.js")));
app.use("/api/admin-badges", lazyRoute(() => import("./routes/adminBadgeRoutes.js")));
app.use("/api/candidate-match", lazyRoute(() => import("./routes/candidateMatchRoutes.js")));
app.use("/api/portal", lazyRoute(() => import("./routes/portalRoutes.js")));
app.use("/api/portal-admin", lazyRoute(() => import("./routes/portalAdminRoutes.js")));
app.use("/api/recruitment-workflow", lazyRoute(() => import("./routes/recruitmentWorkflowRoutes.js")));
app.use("/api/attendance", lazyRoute(() => import("./routes/attendanceRoutes.js")));
app.use("/api/cv-uploads", lazyRoute(() => import("./routes/cvRoutes.js")));
app.use("/api/testimonials", lazyRoute(() => import("./routes/testimonialRoutes.js")));
app.use("/api/terms", lazyRoute(() => import("./routes/termsRoutes.js")));
app.use("/api/partners", lazyRoute(() => import("./routes/partnerRoutes.js")));
app.use("/api/contact", lazyRoute(() => import("./routes/contactRoutes.js")));
app.use("/api/compliance", lazyRoute(() => import("./routes/complianceRoutes.js")));
app.use("/api/dashboard", lazyRoute(() => import("./routes/dashboardRoutes.js")));
app.use("/api/emails", lazyRoute(() => import("./routes/emailRoutes.js")));
app.use("/api/employee-suggestions", lazyRoute(() => import("./routes/employeeSuggestionRoutes.js")));
app.use("/api/finance", lazyRoute(() => import("./routes/financeRoutes.js")));
app.use("/api/hr", lazyRoute(() => import("./routes/hrRoutes.js")));
app.use("/api/interviews", lazyRoute(() => import("./routes/interviewRoutes.js")));
app.use("/api/scheduling", lazyRoute(() => import("./routes/schedulingRoutes.js")));
app.use("/api/integrations", lazyRoute(() => import("./routes/integrationRoutes.js")));
app.use("/api/meetings", lazyRoute(() => import("./routes/meetingRoutes.js")));
app.use("/api/newsletters", lazyRoute(() => import("./routes/newsletterRoutes.js")));
app.use("/api/organizations", lazyRoute(() => import("./routes/organizationRoutes.js")));
app.use("/api/operations", lazyRoute(() => import("./routes/operationsRoutes.js")));
app.use("/api/courses", lazyRoute(() => import("./routes/courseRoutes.js")));
app.use("/api/training-bookings", lazyRoute(() => import("./routes/trainingBookingRoutes.js")));
app.use("/api/training-quotations", lazyRoute(() => import("./routes/trainingQuotationRoutes.js")));
app.use("/api/users", lazyRoute(() => import("./routes/userRoutes.js")));
app.use("/api/vacancy-intelligence", lazyRoute(() => import("./routes/vacancyIntelligenceRoutes.js")));
app.use("/api/web-leads", lazyRoute(() => import("./routes/webLeadRoutes.js")));
app.use("/api", lazyRoute(() => import("./routes/seoRoutes.js")));

app.use(notFound);
app.use(errorHandler);

export default app;
