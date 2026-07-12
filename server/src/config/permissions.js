import { allowedCallerIdsForUser } from "./calling.js";

export const permissionGroups = [
  {
    label: "Core workspace",
    permissions: [
      ["dashboard.view", "Dashboard"],
      ["jobs.view", "Jobs"],
      ["applications.view", "Applications"],
      ["cvs.view", "CV Uploads"]
    ]
  },
  {
    label: "Recruitment CRM",
    permissions: [
      ["talentPool.view", "Talent Pool"],
      ["calls.view", "Call Centre"],
      ["interviews.view", "Interviews"],
      ["meetings.view", "Meetings"]
    ]
  },
  {
    label: "Sales and growth",
    permissions: [
      ["businessLeads.view", "Business Leads"],
      ["emails.view", "Email Centre"],
      ["terms.view", "Client Terms"],
      ["terms.manage", "Manage Client Terms"],
      ["courses.view", "Courses"],
      ["trainingBookings.view", "Training Bookings"]
    ]
  },
  {
    label: "HR documents",
    permissions: [
      ["salarySlips.view", "Salary Slips"],
      ["offerLetters.view", "Offer Letters"]
    ]
  },
  {
    label: "Website content",
    permissions: [
      ["blogs.view", "Blogs"],
      ["testimonials.view", "Testimonials"],
      ["partners.view", "Partners"],
      ["contacts.view", "Contact Messages"]
    ]
  },
  {
    label: "Administration",
    permissions: [["team.manage", "Team Members"]]
  },
  {
    label: "Web Leads CRM",
    permissions: [
      ["webLeads.view", "Web Leads CRM"],
      ["webLeads.manage", "Manage Web Leads"],
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
    "jobs.view",
    "applications.view",
    "cvs.view",
    "talentPool.view",
    "calls.view",
    "interviews.view",
    "meetings.view",
    "terms.view",
    "terms.manage"
  ],
  sales: [
    "dashboard.view",
    "businessLeads.view",
    "emails.view",
    "calls.view",
    "meetings.view",
    "terms.view",
    "terms.manage",
    "courses.view",
    "trainingBookings.view"
  ],
  training: [
    "dashboard.view",
    "courses.view",
    "trainingBookings.view",
    "meetings.view",
    "terms.view",
    "terms.manage",
    "businessLeads.view"
  ],
  marketing: [
    "dashboard.view",
    "businessLeads.view",
    "emails.view",
    "blogs.view",
    "testimonials.view",
    "partners.view",
    "contacts.view"
  ],
  sales_manager: ["webLeads.view", "webLeads.manage"],
  external_agent: ["webLeads.view"],
  viewer: ["dashboard.view"]
};

export function effectivePermissions(user) {
  if (!user) return [];
  if (["admin", "super_admin"].includes(user.role)) return allPermissions;
  // Role presets are only defaults when creating/editing an account. Once saved,
  // the explicit checkbox selection is the source of truth for employee access.
  return Array.from(new Set(Array.isArray(user.permissions) ? user.permissions : []));
}

export function hasPermission(user, permission) {
  if (!permission) return true;
  if (["admin", "super_admin"].includes(user?.role)) return true;
  const permissions = effectivePermissions(user);
  if (permissions.includes("*") || permissions.includes(permission)) return true;
  const [moduleName, action] = permission.split(".");
  return action === "view" && permissions.includes(`${moduleName}.manage`);
}

export function canViewFinance(user) {
  return ["admin", "super_admin"].includes(user?.role);
}

export function safeUser(user) {
  const permissions = effectivePermissions(user);
  const isOwner = ["admin", "super_admin"].includes(user.role);
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    permissions,
    canViewFinance: isOwner,
    canCopyData: isOwner ? true : Boolean(user.canCopyData),
    outboundCallerIds: allowedCallerIdsForUser(user),
    assignedOutboundCallerIds: Array.isArray(user.outboundCallerIds) ? user.outboundCallerIds : [],
    assignedSenderEmails: Array.isArray(user.assignedSenderEmails) ? user.assignedSenderEmails : [],
    isActive: user.isActive
  };
}
