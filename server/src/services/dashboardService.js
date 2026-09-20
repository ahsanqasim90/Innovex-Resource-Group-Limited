import { canViewFinance, hasPermission } from "../config/permissions.js";

// Every query is gated before execution; dashboard access alone grants no access
// to another module's records. Models retain the normal tenant query middleware.
export async function buildDashboard(user, models, now = new Date()) {
  const stats = {};
  const attention = [];
  const agenda = [];
  const recent = {};
  const work = [];
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(end.getDate() + 7);
  const can = (permission) => hasPermission(user, permission);
  const count = (permission, model, key, filter = {}, alert) => {
    if (!can(permission)) return;
    work.push(Promise.resolve(models[model].countDocuments(filter)).then((value) => {
      stats[key] = value;
      if (alert) attention.push({ id: key, count: value, ...alert });
    }));
  };
  const list = (permission, model, key, fields, filter = {}, sort = { createdAt: -1 }) => {
    if (!can(permission)) return;
    work.push(Promise.resolve(models[model].find(filter).select(fields).sort(sort).limit(6).lean()).then((items) => { recent[key] = items; }));
  };
  const scheduled = (permission, model, dateField, timeField, titleField, detailField, type, href, filter) => {
    if (!can(permission)) return;
    work.push(Promise.resolve(models[model].find({ ...filter, [dateField]: { $gte: start, $lt: end } })
      .select(`${dateField} ${timeField} ${titleField} ${detailField}`).sort({ [dateField]: 1, [timeField]: 1 }).limit(8).lean()).then((items) => {
      agenda.push(...items.map((item) => ({ id: `${type}-${item._id}`, type, href, date: item[dateField], time: item[timeField], title: item[titleField], detail: item[detailField] })));
    }));
  };
  count("jobs.view", "Job", "activeJobs", { isActive: true, $and: [{ $or: [{ publicationStatus: "Approved" }, { publicationStatus: { $exists: false } }] }, { $or: [{ closingDate: null }, { closingDate: { $exists: false } }, { closingDate: { $gte: now } }] }] });
  count("applications.view", "Application", "applications");
  count("cvs.view", "CvUpload", "newCvs", { status: "New" }, { label: "CVs awaiting review", group: "Recruitment", href: "/admin/cv-uploads", tone: "normal" });
  count("talentPool.view", "Candidate", "totalCandidates");
  count("talentPool.view", "Candidate", "availableCandidates", { status: "Available" });
  count("talentPool.view", "Candidate", "placements", { status: "Placed" });
  count("interviews.view", "Interview", "pendingInterviews", { interviewStatus: "Pending" });
  count("interviews.view", "Interview", "interviewsToClose", { interviewStatus: "Pending", interviewDate: { $lt: start } }, { label: "Past interviews to update", group: "Recruitment", href: "/admin/interviews", tone: "warning" });
  count("compliance.view", "CompliancePassport", "complianceReviews", { "checks.status": "Pending review" }, { label: "Passports awaiting review", group: "Recruitment", href: "/admin/compliance", tone: "warning" });
  count("contacts.view", "ContactMessage", "messages", { status: "New" }, { label: "New website enquiries", group: "Sales", href: "/admin/website-enquiries", tone: "normal" });
  count("businessLeads.view", "BusinessLead", "newLeads", { status: "New" });
  count("businessLeads.view", "BusinessLead", "leadFollowUps", { status: "Follow-up" }, { label: "Leads needing follow-up", group: "Sales", href: "/admin/business-leads", tone: "normal" });
  count("calls.view", "CallLog", "todayCalls", { createdAt: { $gte: start, $lte: now } });
  count("calls.view", "CallLog", "followUpsDue", { followUpAt: { $lte: now }, outcome: "Call Back" }, { label: "Callbacks due", group: "Sales", href: "/admin/calls", tone: "warning" });
  count("trainingBookings.view", "TrainingBooking", "totalTrainingBookings");
  count("trainingBookings.view", "TrainingBooking", "upcomingTrainingSessions", { trainingDate: { $gte: start }, bookingStatus: { $nin: ["Cancelled", "Completed"] } });
  count("trainingQuotations.view", "TrainingQuotation", "draftQuotations", { status: "Draft" }, { label: "Draft training quotations", group: "Training", href: "/admin/training-quotations", tone: "normal" });
  count("testimonials.view", "Testimonial", "pendingReviews", { status: "Pending" }, { label: "Testimonials awaiting review", group: "Content", href: "/admin/testimonials", tone: "normal" });
  count("partners.view", "Partner", "partners", { isActive: true });
  count("automations.view", "AutomationTask", "openTasks", { status: "Open" });
  count("automations.view", "AutomationTask", "overdueTasks", { status: "Open", dueAt: { $lt: now } }, { label: "Overdue team tasks", group: "Operations", href: "/admin/tasks", tone: "warning" });
  count("audit.view", "SystemEvent", "openErrors", { status: { $ne: "Resolved" }, severity: { $in: ["Error", "Critical"] } }, { label: "Operational errors to review", group: "Operations", href: "/admin/operations", tone: "warning" });
  list("applications.view", "Application", "recentApplications", "name email status createdAt");
  list("interviews.view", "Interview", "recentInterviews", "candidateName jobTitle clientName interviewDate interviewTime interviewStatus candidateSelected");
  list("meetings.view", "Meeting", "recentMeetings", "attendeeName companyName meetingTitle meetingDate meetingTime meetingStatus");
  list("trainingBookings.view", "TrainingBooking", "recentTrainingBookings", "clientName selectedCourses.title trainingDate trainingStartTime bookingStatus");
  list("calls.view", "CallLog", "recentCalls", "targetName status outcome createdAt");
  if (user?._id) {
    work.push(Promise.resolve(models.ActivityLog.find({ "actor.user": user._id })
      .select("summary actor.name module action createdAt")
      .sort({ createdAt: -1 }).limit(10).lean())
      .then((items) => { recent.recentOwnActivity = items; }));
  }
  list("audit.view", "ActivityLog", "recentActivityLogs", "summary actor.name module action createdAt");
  scheduled("interviews.view", "Interview", "interviewDate", "interviewTime", "candidateName", "jobTitle", "Interview", "/admin/interviews", { interviewStatus: "Pending" });
  scheduled("meetings.view", "Meeting", "meetingDate", "meetingTime", "meetingTitle", "companyName", "Meeting", "/admin/meetings", { meetingStatus: "Upcoming" });
  scheduled("trainingBookings.view", "TrainingBooking", "trainingDate", "trainingStartTime", "clientName", "bookingStatus", "Training", "/admin/training-bookings", { bookingStatus: { $nin: ["Cancelled", "Completed"] } });
  if (canViewFinance(user)) {
    work.push(Promise.resolve(models.Invoice.aggregate([{ $match: { status: { $nin: ["Draft", "Cancelled"] } } }, { $group: { _id: null, invoiced: { $sum: "$total" }, received: { $sum: "$amountPaid" }, outstanding: { $sum: "$balanceDue" } } }])).then(([totals]) => {
      Object.assign(stats, { invoiced: totals?.invoiced || 0, received: totals?.received || 0, outstanding: totals?.outstanding || 0 });
    }));
    work.push(Promise.resolve(models.Invoice.countDocuments({ status: { $nin: ["Draft", "Paid", "Cancelled"] }, balanceDue: { $gt: 0 }, dueDate: { $lt: start } })).then((value) => {
      stats.overdueInvoices = value;
      attention.push({ id: "overdueInvoices", count: value, label: "Overdue invoices", group: "Finance", href: "/admin/finance", tone: "warning" });
    }));
  }
  await Promise.all(work);
  attention.sort((a, b) => Number(b.tone === "warning") - Number(a.tone === "warning") || b.count - a.count || a.label.localeCompare(b.label));
  agenda.sort((a, b) => new Date(a.date) - new Date(b.date) || String(a.time || "").localeCompare(String(b.time || "")));
  return { stats, attention, agenda, ...recent, updatedAt: now.toISOString() };
}
