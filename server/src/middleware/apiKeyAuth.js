import ApiCredential from "../models/ApiCredential.js";
import { tokenHash } from "../utils/authSecurity.js";

export function requireApiKey(...requiredScopes) {
  return async (req, res, next) => {
    try {
      const supplied = String(req.get("x-api-key") || "").trim();
      if (!/^irg_live_[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{24,}$/.test(supplied)) return res.status(401).json({ message: "A valid API key is required" });
      const credential = await ApiCredential.findOne({ keyHash: tokenHash(supplied), status: "Active", $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] }).select("+keyHash");
      if (!credential) return res.status(401).json({ message: "A valid API key is required" });
      if (requiredScopes.some((scope) => !credential.scopes.includes(scope))) return res.status(403).json({ message: "API key does not have the required scope" });
      req.apiCredential = credential;
      if (!credential.lastUsedAt || Date.now() - credential.lastUsedAt.getTime() > 60000) {
        ApiCredential.updateOne({ _id: credential._id }, { lastUsedAt: new Date(), lastUsedIp: req.ip }).catch(() => null);
      }
      next();
    } catch (error) { next(error); }
  };
}
