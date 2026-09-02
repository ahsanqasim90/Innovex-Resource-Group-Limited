import { allowedCallerIdsForUser } from "./calling.js";

const actions = (moduleName, label, names = ["create", "edit", "delete"]) => names.map((name) => [`${moduleName}.${name}`, `${name[0].toUpperCase()}${name.slice(1)} ${label}`]);

export const permissionGroups = [
  {
    label: "Core workspace",
    permissions: [
      ["dashboard.view", "Dashboard"],
      ["attendance.view", "My Attendance"],
      ["jobs.view", "Jobs"],
      ...actions("jobs", "Jobs", ["create", "edit", "delete", "export", "approve"]),
      ["applications.view", "Applications"],
      ...actions("applications", "Applications", ["edit", "delete", "export"]),
      ["cvs.view", "CV Uploads"],
      ...actions("cvs", "CV Uploads", ["edit", "delete", "export"])
    ]
  },
  {
    label: "Recruitment CRM",
    permissions: [
      ["recruitmentPipeline.view", "Recruitment ATS"],
      ["recruitmentPipeline.submit", "Submit ATS Candidates"],
      ["recruitmentPipeline.review", "Review ATS Candidates"],
      ["talentPool.view", "Talent Pool"],
      ...actions("talentPool", "Talent Pool", ["create", "edit", "delete", "export", "send"]),
      ["candidateCvs.view", "CV Library"],
      ["candidateCvs.manage", "Manage CV Library"],
      ["automations.view", "Workflow Automations"],
      ["automations.manage", "Manage Workflow Automations"],
      ["automations.execute", "Complete Automation Tasks"],
      ["compliance.view", "Healthcare Compliance Passport"],
      ["compliance.manage", "Manage Healthcare Compliance"],
      ["vacancyIntelligence.view", "Vacancy Intelligence"],
      ["vacancyIntelligence.manage", "Manage Vacancy Intelligence"],
      ["calls.view", "Call Centre"],
      ...actions("calls", "Calls", ["create", "edit", "delete", "export"]),
      ["interviews.view", "Interviews"],
      ...actions("interviews", "Interviews", ["create", "edit", "delete", "send"]),
      ["meetings.view", "Meetings"],
      ...actions("meetings", "Meetings", ["create", "edit", "delete", "send"])
    ]
  },
  {
    label: "Sales and growth",
    permissions: [
      ["clients.view", "Organisation 360"],
      ["clients.manage", "Manage Organisations"],
      ["businessLeads.view", "Business Leads"],
      ...actions("businessLeads", "Business Leads", ["create", "edit", "delete", "export", "send"]),
      ["emails.view", "Email Centre"],
      ...actions("emails", "Email", ["create", "edit", "delete", "send"]),
      ["newsletters.view", "Newsletter Centre"],
      ["newsletters.manage", "Manage Newsletter Campaigns"],
      ["terms.view", "Client Terms"],
      ["terms.manage", "Manage Client Terms"],
      ...actions("terms", "Client Terms", ["create", "edit", "delete", "export", "send", "approve"]),
      ["courses.view", "Courses"],
      ...actions("courses", "Courses", ["create", "edit", "delete"]),
      ["trainingBookings.view", "Training Bookings"],
      ...actions("trainingBookings", "Training Bookings", ["create", "edit", "delete", "export"]),
      ["trainingQuotations.view", "Course Quotations"],
      ["trainingQuotations.manage", "Manage Course Quotations"],
      ...actions("trainingQuotations", "Course Quotations", ["create", "edit", "delete", "export", "send", "approve"])
    ]
  },
  {
    label: "HR documents",
    permissions: [
      ["salarySlips.view", "Salary Slips"],
      ...actions("salarySlips", "Salary Slips", ["create", "edit", "delete", "export", "send"]),
      ["offerLetters.view", "Offer Letters"],
      ...actions("offerLetters", "Offer Letters", ["create", "edit", "delete", "export", "send", "approve"])
    ]
  },
  {
    label: "Website content",
    permissions: [
      ["blogs.view", "Blogs"],
      ...actions("blogs", "Blogs", ["create", "edit", "delete", "approve"]),
      ["testimonials.view", "Testimonials"],
      ...actions("testimonials", "Testimonials", ["edit", "delete", "approve"]),
      ["partners.view", "Partners"],
      ...actions("partners", "Partners", ["create", "edit", "delete"]),
      ["contacts.view", "Website Enquiries"],
      ["contacts.manage", "Manage Website Enquiries"]
    ]
  },
  {
    label: "Administration",
    permissions: [
      ["team.manage", "Team Members"],
      ["attendance.manage", "Attendance Reports"],
      ["organization.manage", "Organisation Settings"],
      ["security.manage", "Security & Sessions"],
      ["audit.view", "Audit Log"],
      ["exports.manage", "Data Exports"],
      ["archive.manage", "Archive & Retention"],
      ["reports.view", "Advanced Recruitment Reports"],
      ["portals.manage", "Candidate & Client Portals"],
      ["integrations.manage", "API & Webhook Integrations"]
    ]
  },
  {
    label: "Web Leads CRM",
    permissions: [
      ["webLeads.view", "Web Leads CRM"],
      ["webLeads.manage", "Manage Web Leads"],
      ...actions("webLeads", "Web Leads", ["create", "edit", "delete", "export", "send", "approve"]),
      ["webLeads.settings", "Web Leads Settings"]
    ]
  }
];

export const allPermissions = permissionGroups.flatMap((group) => group.permissions.map(([key]) => key));

export const rolePresets = {
  super_admin: allPermissions,
  admin: allPermissions,
  recruitment: [
    "dashboard.view",
    "attendance.view",
    "recruitmentPipeline.view",
    "recruitmentPipeline.submit",
    "jobs.view", "jobs.create", "jobs.edit", "jobs.export",
    "applications.view", "applications.edit", "applications.export",
    "cvs.view", "cvs.edit",
    "talentPool.view", "talentPool.create", "talentPool.edit", "talentPool.export", "talentPool.send",
    "candidateCvs.view",
    "calls.view", "calls.create", "calls.edit",
    "interviews.view", "interviews.create", "interviews.edit", "interviews.send",
    "meetings.view", "meetings.create", "meetings.edit", "meetings.send",
    "terms.view",
    "terms.manage",
    "clients.view", "portals.manage",
    "compliance.view", "compliance.manage",
    "automations.view", "automations.execute", "reports.view"
  ],
  sales: [
    "dashboard.view",
    "attendance.view",
    "businessLeads.view", "businessLeads.create", "businessLeads.edit", "businessLeads.export", "businessLeads.send",
    "emails.view", "emails.create", "emails.edit", "emails.send",
    "newsletters.view",
    "calls.view", "calls.create", "calls.edit", "calls.export",
    "meetings.view", "meetings.create", "meetings.edit", "meetings.send",
    "terms.view",
    "terms.manage",
    "courses.view", "courses.create", "courses.edit",
    "trainingBookings.view", "trainingBookings.create", "trainingBookings.edit", "trainingBookings.export",
    "trainingQuotations.view",
    "trainingQuotations.manage",
    "clients.view",
    "clients.manage", "automations.view", "portals.manage"
  ],
  training: [
    "dashboard.view",
    "attendance.view",
    "courses.view", "courses.create", "courses.edit",
    "trainingBookings.view", "trainingBookings.create", "trainingBookings.edit", "trainingBookings.export",
    "trainingQuotations.view",
    "trainingQuotations.manage",
    "meetings.view", "meetings.create", "meetings.edit", "meetings.send",
    "terms.view",
    "terms.manage",
    "businessLeads.view", "automations.view"
  ],
  marketing: [
    "dashboard.view",
    "attendance.view",
    "businessLeads.view", "businessLeads.create", "businessLeads.edit", "businessLeads.export",
    "emails.view", "emails.create", "emails.edit", "emails.send",
    "newsletters.view",
    "newsletters.manage",
    "blogs.view", "blogs.create", "blogs.edit", "blogs.approve",
    "testimonials.view", "testimonials.edit", "testimonials.approve",
    "partners.view", "partners.create", "partners.edit",
    "contacts.view",
    "contacts.manage"
  ],
  sales_manager: ["attendance.view", "webLeads.view", "webLeads.manage"],
  external_agent: ["attendance.view", "webLeads.view"],
  viewer: ["dashboard.view", "attendance.view"]
};

export function effectivePermissions(user) {
  if (!user) return [];
  if (["admin", "super_admin"].includes(user.role)) return allPermissions;
  // Role presets are only defaults when creating/editing an account. Once saved,
  // the explicit checkbox selection is the source of truth for employee access.
  // Attendance is part of every active employee account, including accounts
  // created before this module was introduced.
  const recruitmentDefaults = user.role === "recruitment" ? ["recruitmentPipeline.view", "recruitmentPipeline.submit"] : [];
  return Array.from(new Set(["attendance.view", ...recruitmentDefaults, ...(Array.isArray(user.permissions) ? user.permissions : [])]));
}

export function hasPermission(user, permission) {
  if (!permission) return true;
  if (["admin", "super_admin"].includes(user?.role)) return true;
  const permissions = effectivePermissions(user);
  if (permissions.includes("*") || permissions.includes(permission)) return true;
  const [moduleName, action] = permission.split(".");
  if (permissions.includes(`${moduleName}.manage`)) return true;
  return action === "view" && permissions.some((value) => value.startsWith(`${moduleName}.`));
}

export function canViewFinance(user) {
  return ["admin", "super_admin"].includes(user?.role);
}

export function safeUser(user) {
  const permissions = effectivePermissions(user);
  const isOwner = ["admin", "super_admin"].includes(user.role);
  return {
    id: user._id,
    organizationId: user.organization?._id || user.organization || null,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions,
    canViewFinance: isOwner,
    canCopyData: isOwner ? true : Boolean(user.canCopyData),
    outboundCallerIds: allowedCallerIdsForUser(user),
    assignedOutboundCallerIds: Array.isArray(user.outboundCallerIds) ? user.outboundCallerIds : [],
    assignedSenderEmails: Array.isArray(user.assignedSenderEmails) ? user.assignedSenderEmails : [],
    mfaEnabled: Boolean(user.mfa?.enabled),
    isActive: user.isActive
  };
}
