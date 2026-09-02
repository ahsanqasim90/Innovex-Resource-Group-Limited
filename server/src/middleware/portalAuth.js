import jwt from "jsonwebtoken";
import PortalAccount from "../models/PortalAccount.js";
import PortalSession from "../models/PortalSession.js";
import { tokenHash } from "../utils/authSecurity.js";

function cookie(req, name) {
  const found = String(req.headers.cookie || "").split(";").find((item) => item.trim().startsWith(`${name}=`));
  return found ? decodeURIComponent(found.trim().slice(name.length + 1)) : "";
}

export async function protectPortal(req, res, next) {
  try {
    const token = cookie(req, process.env.NODE_ENV === "production" ? "__Host-innovex_portal" : "innovex_portal");
    if (!token) return res.status(401).json({ message: "Portal sign in required" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.audience !== "portal") return res.status(401).json({ message: "Invalid portal session" });
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (!req.get("x-portal-csrf") || req.get("x-portal-csrf") !== decoded.csrf) return res.status(403).json({ message: "Portal security validation failed. Refresh and try again." });
    }
    const account = await PortalAccount.findById(decoded.accountId).select("+password");
    if (!account || account.status !== "Active" || Number(account.sessionVersion || 1) !== Number(decoded.sessionVersion || 1)) return res.status(401).json({ message: "Portal session is no longer active" });
    const session = await PortalSession.findOne({ account: account._id, jtiHash: tokenHash(decoded.jti), revokedAt: null, expiresAt: { $gt: new Date() } });
    if (!session) return res.status(401).json({ message: "Portal session has expired" });
    req.portalAccount = account;
    req.portalAuth = decoded;
    next();
  } catch { res.status(401).json({ message: "Invalid portal session" }); }
}
