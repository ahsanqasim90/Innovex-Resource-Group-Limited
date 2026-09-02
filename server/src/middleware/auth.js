import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { hasPermission } from "../config/permissions.js";
import { currentOrganizationId, runWithTenant } from "../tenancy/tenantContext.js";
import UserSession from "../models/UserSession.js";
import Organization from "../models/Organization.js";
import { tokenHash } from "../utils/authSecurity.js";
import { workspaceAccessState } from "../services/subscriptionService.js";

function cookieValue(req, name) {
  const cookies = String(req.headers.cookie || "").split(";");
  const match = cookies.find((cookie) => cookie.trim().startsWith(`${name}=`));
  return match ? decodeURIComponent(match.trim().slice(name.length + 1)) : null;
}

export async function protect(req, res, next) {
  try {
    const cookieToken = cookieValue(req, "__Host-innovex_session") || cookieValue(req, "innovex_session");
    const token = cookieToken;

    if (!token) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (cookieToken && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      const csrfToken = req.get("x-csrf-token");
      if (!csrfToken || !decoded.csrf || csrfToken !== decoded.csrf) {
        return res.status(403).json({ message: "Security validation failed. Refresh the page and try again." });
      }
    }
    const organizationId = decoded.organizationId || currentOrganizationId();
    if (decoded.organizationId && req.organization?._id && String(decoded.organizationId) !== String(req.organization._id)) {
      return res.status(401).json({ message: "This session belongs to a different workspace" });
    }
    return await runWithTenant({ organizationId: String(organizationId || "") }, async () => {
      const organization = req.organization && String(req.organization._id) === String(organizationId)
        ? req.organization
        : await Organization.findById(organizationId);
      const access = workspaceAccessState(organization);
      if (!access.allowed) return res.status(access.statusCode).json({ message: access.message });
      const user = await User.findById(decoded.id).select("-password");
      if (!user || !user.isActive) {
        return res.status(401).json({ message: "Invalid authentication token" });
      }
      if (decoded.organizationId && user.organization && String(decoded.organizationId) !== String(user.organization)) {
        return res.status(401).json({ message: "Workspace session is no longer valid" });
      }
      if (decoded.sessionVersion && Number(decoded.sessionVersion) !== Number(user.sessionVersion || 1)) {
        return res.status(401).json({ message: "This session has expired. Sign in again." });
      }
      if (decoded.jti) {
        const session = await UserSession.findOne({ jtiHash: tokenHash(decoded.jti), user: user._id, revokedAt: null, expiresAt: { $gt: new Date() } });
        if (!session) return res.status(401).json({ message: "This session has been revoked" });
        if (!session.lastSeenAt || Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
          session.lastSeenAt = new Date();
          await session.save();
        }
        req.session = session;
      }
      req.user = user;
      req.auth = decoded;
      req.organizationId = user.organization || organizationId;
      return next();
    });
  } catch (error) {
    res.status(401).json({ message: "Invalid authentication token" });
  }
}

export function requirePermission(permission) {
  return (req, res, next) => {
    let required = permission;
    const [moduleName, action] = String(permission || "").split(".");
    if (action === "view") {
      const path = String(req.path || "").toLowerCase();
      const method = String(req.method || "GET").toUpperCase();
      if (path.includes("export")) required = `${moduleName}.export`;
      else if (/(send|email|dispatch|remind)/.test(path)) required = `${moduleName}.send`;
      else if (/(approve|publish|review)/.test(path)) required = `${moduleName}.approve`;
      else if (method === "DELETE") required = `${moduleName}.delete`;
      else if (["PUT", "PATCH"].includes(method)) required = `${moduleName}.edit`;
      else if (method === "POST") required = /^\/[a-f\d]{24}(\/|$)/i.test(path) ? `${moduleName}.edit` : `${moduleName}.create`;
    }
    if (hasPermission(req.user, required)) return next();
    return res.status(403).json({ message: "You do not have permission to access this area" });
  };
}
