import ActivityLog from "../models/ActivityLog.js";

export async function logActivity(req, details) {
  if (!req?.user || !details?.module || !details?.action || !details?.entityType || !details?.summary) return null;

  try {
    return await ActivityLog.create({
      actor: {
        user: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role
      },
      module: details.module,
      action: details.action,
      entityType: details.entityType,
      entityId: details.entityId,
      summary: details.summary,
      metadata: details.metadata || {},
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || ""
    });
  } catch {
    return null;
  }
}
