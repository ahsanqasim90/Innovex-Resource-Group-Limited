export const teamRoles = [
  ["viewer", "Viewer", "Dashboard and personal attendance."],
  ["recruitment", "Recruitment", "Candidates, vacancies, interviews and compliance."],
  ["sales", "Sales", "Business leads, calls, meetings and client relationships."],
  ["training", "Training", "Courses, bookings and training quotations."],
  ["marketing", "Marketing", "Website content, enquiries and campaigns."],
  ["sales_manager", "Web leads manager", "Manage web leads and the sales team’s pipeline."],
  ["external_agent", "Web leads agent", "Work on assigned web leads and attendance."],
  ["super_admin", "Administrator", "Full workspace access, including finance and team settings."]
];
export const isAdministrator = (role) => ["admin", "super_admin"].includes(role);
export const requiredTeamPermissions = (role) => ["attendance.view", ...(role === "recruitment" ? ["recruitmentPipeline.view", "recruitmentPipeline.submit"] : [])];
export const displayedTeamPermissions = (member) => [...new Set([...requiredTeamPermissions(member.role), ...(member.permissions || [])])];
export const teamRoleLabel = (role) => role === "admin" ? "Primary administrator" : teamRoles.find(([id]) => id === role)?.[1] || role;
export function samePermissions(left = [], right = []) {
  const a = new Set(left), b = new Set(right);
  return a.size === b.size && [...a].every((permission) => b.has(permission));
}
export function moduleCount(permissions = []) {
  return new Set(permissions.map((permission) => permission.split(".")[0])).size;
}
export function memberForm(member, defaults) {
  return {
    ...defaults, name: member.name || "", email: member.email || "", password: "",
    role: member.role, permissions: [...(member.permissions || [])],
    outboundCallerIds: [...(member.assignedOutboundCallerIds || member.outboundCallerIds || [])],
    assignedSenderEmails: [...(member.assignedSenderEmails || [])],
    canCopyData: Boolean(member.canCopyData), isActive: Boolean(member.isActive)
  };
}
