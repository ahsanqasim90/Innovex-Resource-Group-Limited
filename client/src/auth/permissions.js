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

export const rolePresets = {
  recruitment: ["dashboard.view", "jobs.view", "applications.view", "cvs.view", "talentPool.view", "calls.view", "interviews.view", "meetings.view", "terms.view", "terms.manage"],
  sales: ["dashboard.view", "businessLeads.view", "emails.view", "calls.view", "meetings.view", "terms.view", "terms.manage", "courses.view", "trainingBookings.view"],
  training: ["dashboard.view", "courses.view", "trainingBookings.view", "meetings.view", "terms.view", "terms.manage", "businessLeads.view"],
  marketing: ["dashboard.view", "businessLeads.view", "emails.view", "blogs.view", "testimonials.view", "partners.view", "contacts.view"],
  sales_manager: ["webLeads.view", "webLeads.manage"],
  external_agent: ["webLeads.view"],
  viewer: ["dashboard.view"]
};

export function hasPermission(user, permission) {
  if (!permission) return true;
  if (["admin", "super_admin"].includes(user?.role)) return true;
  if (user?.permissions?.includes(permission)) return true;
  const [moduleName, action] = permission.split(".");
  return action === "view" && Boolean(user?.permissions?.includes(`${moduleName}.manage`));
}

export function canViewFinance(user) {
  return Boolean(user?.canViewFinance || ["admin", "super_admin"].includes(user?.role));
}
