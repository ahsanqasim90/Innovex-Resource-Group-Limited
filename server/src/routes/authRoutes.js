import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import jwt from "jsonwebtoken";
import ActivityLog from "../models/ActivityLog.js";
import PasswordResetToken from "../models/PasswordResetToken.js";
import User from "../models/User.js";
import UserSession from "../models/UserSession.js";
import { protect } from "../middleware/auth.js";
import { safeUser } from "../config/permissions.js";
import { sendSystemEmail } from "../services/emailService.js";
import { requireFields, validateEmail } from "../utils.js";
import { decryptSecret, deviceLabel, encryptSecret, generateRecoveryCodes, generateTotpSecret, tokenHash, verifyTotp } from "../utils/authSecurity.js";

const router = express.Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false, message: { message: "Too many login attempts. Please wait 15 minutes and try again." } });
const recoveryLimiter = rateLimit({ windowMs: 60 * 60 * 1000, limit: 6, standardHeaders: true, legacyHeaders: false, message: { message: "Too many recovery requests. Please try again later." } });

function signToken(user, csrf, jti) {
  return jwt.sign({ id: user._id, role: user.role, organizationId: user.organization, sessionVersion: user.sessionVersion || 1, csrf, jti }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || "8h" });
}

function sessionCookieName() {
  return process.env.NODE_ENV === "production" ? "__Host-innovex_session" : "innovex_session";
}

function clearSessionCookies(res) {
  res.clearCookie("__Host-innovex_session", { httpOnly: true, secure: true, sameSite: "strict", path: "/" });
  res.clearCookie("innovex_session", { httpOnly: true, secure: false, sameSite: "strict", path: "/" });
  res.clearCookie("innovex_csrf", { httpOnly: false, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/" });
}

async function issueSession(req, res, user, suspicious = false) {
  const csrfToken = crypto.randomBytes(32).toString("hex");
  const jti = crypto.randomUUID();
  const maxAge = 8 * 60 * 60 * 1000;
  const secure = process.env.NODE_ENV === "production";
  await UserSession.create({
    user: user._id,
    jtiHash: tokenHash(jti),
    ipAddress: req.ip,
    userAgent: req.get("user-agent") || "",
    deviceLabel: deviceLabel(req.get("user-agent")),
    expiresAt: new Date(Date.now() + maxAge),
    suspicious
  });
  res.cookie(sessionCookieName(), signToken(user, csrfToken, jti), { httpOnly: true, secure, sameSite: "strict", path: "/", maxAge });
  res.cookie("innovex_csrf", csrfToken, { httpOnly: false, secure, sameSite: "strict", path: "/", maxAge });
  return csrfToken;
}

async function validSecondFactor(user, suppliedCode) {
  if (!user.mfa?.enabled) return true;
  if (!suppliedCode) return false;
  try {
    if (verifyTotp(decryptSecret(user.mfa.secret), suppliedCode)) return true;
  } catch {}
  const recoveryHash = tokenHash(String(suppliedCode).replace(/\s/g, "").toUpperCase());
  const index = (user.mfa.recoveryCodeHashes || []).indexOf(recoveryHash);
  if (index < 0) return false;
  user.mfa.recoveryCodeHashes.splice(index, 1);
  await user.save();
  return true;
}

router.post("/login", loginLimiter, async (req, res, next) => {
  try {
    requireFields(req.body, ["email", "password"]);
    validateEmail(req.body.email);
    const user = await User.findOne({ email: req.body.email.toLowerCase() }).select("+mfa.secret +mfa.recoveryCodeHashes");
    if (!user || !user.isActive || !(await user.matchPassword(req.body.password))) return res.status(401).json({ message: "Invalid email or password" });
    if (!user.organization && req.organization?._id) {
      user.organization = req.organization._id;
      await user.save();
    }
    if (user.mfa?.enabled && !req.body.mfaCode) return res.status(202).json({ mfaRequired: true, message: "Enter the code from your authenticator app" });
    if (!(await validSecondFactor(user, req.body.mfaCode))) return res.status(401).json({ message: "Invalid authentication or recovery code", mfaRequired: true });
    const currentAgent = req.get("user-agent") || "";
    const suspicious = Boolean(user.lastLoginAt && ((user.lastLoginIp && user.lastLoginIp !== req.ip) || (user.lastLoginUserAgent && user.lastLoginUserAgent !== currentAgent)));
    await ActivityLog.create({
      actor: { user: user._id, name: user.name, email: user.email, role: user.role },
      module: "Authentication",
      action: suspicious ? "Login from a new environment" : "Login",
      entityType: "User",
      entityId: user._id,
      summary: suspicious ? `${user.name} logged in from a new IP address or device` : `${user.name} logged in`,
      metadata: { suspicious },
      ipAddress: req.ip,
      userAgent: currentAgent
    }).catch(() => null);
    const csrfToken = await issueSession(req, res, user, suspicious);
    user.lastLoginAt = new Date();
    user.lastLoginIp = req.ip;
    user.lastLoginUserAgent = currentAgent;
    await user.save();
    res.json({ user: safeUser(user), csrfToken, suspiciousLogin: suspicious });
  } catch (error) { next(error); }
});

router.post("/forgot-password", recoveryLimiter, async (req, res, next) => {
  try {
    requireFields(req.body, ["email"]);
    validateEmail(req.body.email);
    const user = await User.findOne({ email: req.body.email.toLowerCase(), isActive: true });
    if (user) {
      await PasswordResetToken.updateMany({ user: user._id, usedAt: null }, { usedAt: new Date() });
      const token = crypto.randomBytes(32).toString("hex");
      await PasswordResetToken.create({ user: user._id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + 30 * 60 * 1000), requestedIp: req.ip });
      const resetUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password?workspace=${encodeURIComponent(req.organization.slug)}&token=${token}`;
      await sendSystemEmail({
        to: user.email,
        subject: "Reset your Innovex workspace password",
        text: `Use this secure link within 30 minutes to reset your password: ${resetUrl}`,
        html: `<p>Hello ${user.name},</p><p>Use the secure link below within 30 minutes to reset your workspace password.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, no action is required.</p>`
      }).catch(() => null);
    }
    res.json({ message: "If the account exists, a secure reset link has been sent." });
  } catch (error) { next(error); }
});

router.post("/reset-password/:token", recoveryLimiter, async (req, res, next) => {
  try {
    requireFields(req.body, ["password"]);
    if (String(req.body.password).length < 12) return res.status(400).json({ message: "Password must be at least 12 characters" });
    const reset = await PasswordResetToken.findOne({ tokenHash: tokenHash(req.params.token), usedAt: null, expiresAt: { $gt: new Date() } });
    if (!reset) return res.status(404).json({ message: "Reset link is invalid or has expired" });
    const user = await User.findById(reset.user).select("+mfa.secret +mfa.recoveryCodeHashes");
    if (!user) return res.status(404).json({ message: "Account not found" });
    user.password = req.body.password;
    user.sessionVersion = Number(user.sessionVersion || 1) + 1;
    await user.save();
    reset.usedAt = new Date();
    await reset.save();
    await UserSession.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date(), revokeReason: "Password reset" });
    clearSessionCookies(res);
    res.json({ message: "Password updated. Sign in again on your devices." });
  } catch (error) { next(error); }
});

router.get("/me", protect, (req, res) => res.json({ user: safeUser(req.user), csrfToken: req.auth?.csrf || "" }));

router.post("/logout", protect, async (req, res, next) => {
  try {
    if (req.auth?.jti) await UserSession.updateOne({ jtiHash: tokenHash(req.auth.jti), user: req.user._id }, { revokedAt: new Date(), revokedBy: req.user._id, revokeReason: "Signed out" });
    clearSessionCookies(res);
    res.json({ message: "Logged out securely" });
  } catch (error) { next(error); }
});

router.get("/sessions", protect, async (req, res, next) => {
  try {
    const sessions = await UserSession.find({ user: req.user._id, expiresAt: { $gt: new Date() } }).sort({ lastSeenAt: -1 }).lean();
    res.json(sessions.map((session) => ({ id: session._id, deviceLabel: session.deviceLabel, ipAddress: session.ipAddress, lastSeenAt: session.lastSeenAt, createdAt: session.createdAt, expiresAt: session.expiresAt, revokedAt: session.revokedAt, suspicious: session.suspicious, current: req.auth?.jti ? session.jtiHash === tokenHash(req.auth.jti) : false })));
  } catch (error) { next(error); }
});

router.delete("/sessions/:id", protect, async (req, res, next) => {
  try {
    const session = await UserSession.findOne({ _id: req.params.id, user: req.user._id });
    if (!session) return res.status(404).json({ message: "Session not found" });
    session.revokedAt = new Date();
    session.revokedBy = req.user._id;
    session.revokeReason = "Revoked by account owner";
    await session.save();
    res.json({ message: "Session revoked" });
  } catch (error) { next(error); }
});

router.post("/change-password", protect, async (req, res, next) => {
  try {
    requireFields(req.body, ["currentPassword", "newPassword"]);
    if (String(req.body.newPassword).length < 12) return res.status(400).json({ message: "New password must be at least 12 characters" });
    const user = await User.findById(req.user._id);
    if (!(await user.matchPassword(req.body.currentPassword))) return res.status(401).json({ message: "Current password is incorrect" });
    user.password = req.body.newPassword;
    user.sessionVersion = Number(user.sessionVersion || 1) + 1;
    await user.save();
    const currentJtiHash = req.auth?.jti ? tokenHash(req.auth.jti) : "";
    await UserSession.updateMany({ user: user._id, jtiHash: { $ne: currentJtiHash }, revokedAt: null }, { revokedAt: new Date(), revokeReason: "Password changed" });
    if (req.auth?.jti && req.auth?.csrf) {
      const secure = process.env.NODE_ENV === "production";
      res.cookie(sessionCookieName(), signToken(user, req.auth.csrf, req.auth.jti), { httpOnly: true, secure, sameSite: "strict", path: "/", maxAge: 8 * 60 * 60 * 1000 });
    }
    res.json({ message: "Password changed and other sessions revoked" });
  } catch (error) { next(error); }
});

router.post("/mfa/setup", protect, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("+mfa.secret +mfa.recoveryCodeHashes");
    const secret = generateTotpSecret();
    user.mfa.secret = encryptSecret(secret);
    user.mfa.enabled = false;
    user.mfa.recoveryCodeHashes = [];
    await user.save();
    const issuer = encodeURIComponent(req.organization?.name || "Innovex Workspace");
    const account = encodeURIComponent(user.email);
    res.json({ secret, otpauthUrl: `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&digits=6&period=30` });
  } catch (error) { next(error); }
});

router.post("/mfa/confirm", protect, async (req, res, next) => {
  try {
    requireFields(req.body, ["code"]);
    const user = await User.findById(req.user._id).select("+mfa.secret +mfa.recoveryCodeHashes");
    if (!user.mfa?.secret || !verifyTotp(decryptSecret(user.mfa.secret), req.body.code)) return res.status(400).json({ message: "Authenticator code is invalid" });
    const recoveryCodes = generateRecoveryCodes();
    user.mfa.enabled = true;
    user.mfa.enabledAt = new Date();
    user.mfa.recoveryCodeHashes = recoveryCodes.map((code) => tokenHash(code));
    await user.save();
    res.json({ message: "Multi-factor authentication enabled", recoveryCodes });
  } catch (error) { next(error); }
});

router.post("/mfa/disable", protect, async (req, res, next) => {
  try {
    requireFields(req.body, ["password", "code"]);
    const user = await User.findById(req.user._id).select("+mfa.secret +mfa.recoveryCodeHashes");
    if (!(await user.matchPassword(req.body.password))) return res.status(401).json({ message: "Password is incorrect" });
    if (!(await validSecondFactor(user, req.body.code))) return res.status(401).json({ message: "Authentication code is invalid" });
    user.mfa.enabled = false;
    user.mfa.secret = "";
    user.mfa.recoveryCodeHashes = [];
    user.mfa.enabledAt = null;
    await user.save();
    res.json({ message: "Multi-factor authentication disabled" });
  } catch (error) { next(error); }
});

export default router;
