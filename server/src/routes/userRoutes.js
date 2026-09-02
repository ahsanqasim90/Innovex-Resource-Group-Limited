import express from "express";
import User from "../models/User.js";
import { outboundCallerIds } from "../config/calling.js";
import { publicEmailAccounts } from "../config/emailAccounts.js";
import { allPermissions, permissionGroups, rolePresets, safeUser } from "../config/permissions.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { pick, requireFields, validateEmail } from "../utils.js";
import { logActivity } from "../services/activityLogService.js";
import { assertSeatAvailable, assertActiveSeatAvailable } from "../services/subscriptionService.js";

const router = express.Router();

router.use(protect, requirePermission("team.manage"));

function cleanPermissions(input = []) {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.filter((permission) => allPermissions.includes(permission))));
}

function cleanCallerIds(input = []) {
  if (!Array.isArray(input)) return [];
  const allowed = outboundCallerIds();
  return Array.from(
    new Set(
      input
        .map((number) => String(number || "").replace(/[^\d+]/g, "").trim())
        .filter((number) => allowed.includes(number))
    )
  );
}

function cleanSenderEmails(input = []) {
  if (!Array.isArray(input)) return [];
  const allowed = publicEmailAccounts().map((account) => account.address);
  return Array.from(
    new Set(
      input
        .map((email) => String(email || "").toLowerCase().trim())
        .filter((email) => allowed.includes(email))
    )
  );
}

function userPayload(input, existingUser = null) {
  const data = pick(input, ["name", "email", "role", "permissions", "outboundCallerIds", "assignedSenderEmails", "canCopyData", "isActive"]);
  if (data.email) {
    validateEmail(data.email);
    data.email = data.email.toLowerCase();
  }
  if (data.permissions) data.permissions = cleanPermissions(data.permissions);
  if (data.outboundCallerIds) data.outboundCallerIds = cleanCallerIds(data.outboundCallerIds);
  if (data.assignedSenderEmails) data.assignedSenderEmails = cleanSenderEmails(data.assignedSenderEmails);
  if (data.role && rolePresets[data.role] && !input.permissions) data.permissions = rolePresets[data.role];
  if (existingUser?.role === "admin" && data.role && data.role !== "admin") {
    const error = new Error("Primary admin role cannot be downgraded from this panel");
    error.statusCode = 400;
    throw error;
  }
  return data;
}

router.get("/permission-options", (req, res) => {
  res.json({ permissionGroups, rolePresets, outboundCallerIds: outboundCallerIds(), senderAccounts: publicEmailAccounts() });
});

router.get("/", async (req, res, next) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 }).lean();
    res.json(users.map((user) => safeUser(user)));
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    requireFields(req.body, ["name", "email", "password", "role"]);
    if (String(req.body.password || "").length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }
    const payload = userPayload(req.body);
    await assertSeatAvailable(req.organization);
    payload.password = req.body.password;
    const user = await User.create(payload);
    await logActivity(req, { module: "Team", action: "User created", entityType: "User", entityId: user._id, summary: `Created ${user.role} account for ${user.name}` });
    res.status(201).json(safeUser(user));
  } catch (error) {
    if (error.code === 11000) error.message = "A team member with this email already exists";
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "Team member not found" });
    if (String(user._id) === String(req.user._id) && req.body.isActive === false) {
      return res.status(400).json({ message: "You cannot suspend your own account" });
    }

    const previousRole = user.role;
    const previousActive = user.isActive;
    if (!previousActive && req.body.isActive === true) await assertActiveSeatAvailable(req.organization);
    user.set(userPayload(req.body, user));
    if (req.body.password) {
      if (String(req.body.password).length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      user.password = req.body.password;
    }
    await user.save();
    if (previousRole !== user.role) await logActivity(req, { module: "Team", action: "Role changed", entityType: "User", entityId: user._id, summary: `${user.name} changed from ${previousRole} to ${user.role}` });
    if (previousActive !== user.isActive) await logActivity(req, { module: "Team", action: user.isActive ? "User enabled" : "User disabled", entityType: "User", entityId: user._id, summary: `${user.name} was ${user.isActive ? "enabled" : "disabled"}` });
    res.json(safeUser(user));
  } catch (error) {
    if (error.code === 11000) error.message = "A team member with this email already exists";
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    if (String(req.params.id) === String(req.user._id)) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: "Team member not found" });
    user.isActive = false;
    await user.archive(req.user._id, String(req.body?.reason || "Team member archived"));
    await logActivity(req, { module: "Team", action: "User archived", entityType: "User", entityId: user._id, summary: `${user.name} was archived and access revoked` });
    res.json({ message: "Team member archived and access revoked" });
  } catch (error) {
    next(error);
  }
});

router.post("/:id/restore", async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id }).setOptions({ withArchived: true });
    if (!user) return res.status(404).json({ message: "Archived team member not found" });
    await assertActiveSeatAvailable(req.organization);
    user.isActive = true;
    await user.restore();
    await logActivity(req, { module: "Team", action: "User restored", entityType: "User", entityId: user._id, summary: `${user.name} was restored` });
    res.json(safeUser(user));
  } catch (error) { next(error); }
});

export default router;
