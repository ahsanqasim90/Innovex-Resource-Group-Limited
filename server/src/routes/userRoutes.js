import express from "express";
import User from "../models/User.js";
import { allPermissions, permissionGroups, rolePresets, safeUser } from "../config/permissions.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { pick, requireFields, validateEmail } from "../utils.js";

const router = express.Router();

router.use(protect, requirePermission("team.manage"));

function cleanPermissions(input = []) {
  if (!Array.isArray(input)) return [];
  return Array.from(new Set(input.filter((permission) => allPermissions.includes(permission))));
}

function userPayload(input, existingUser = null) {
  const data = pick(input, ["name", "email", "role", "permissions", "canCopyData", "isActive"]);
  if (data.email) {
    validateEmail(data.email);
    data.email = data.email.toLowerCase();
  }
  if (data.permissions) data.permissions = cleanPermissions(data.permissions);
  if (data.role && rolePresets[data.role] && !input.permissions) data.permissions = rolePresets[data.role];
  if (existingUser?.role === "admin" && data.role && data.role !== "admin") {
    const error = new Error("Primary admin role cannot be downgraded from this panel");
    error.statusCode = 400;
    throw error;
  }
  return data;
}

router.get("/permission-options", (req, res) => {
  res.json({ permissionGroups, rolePresets });
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
    payload.password = req.body.password;
    if (!payload.permissions?.length) payload.permissions = rolePresets[payload.role] || [];
    const user = await User.create(payload);
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

    user.set(userPayload(req.body, user));
    if (req.body.password) {
      if (String(req.body.password).length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      user.password = req.body.password;
    }
    await user.save();
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
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "Team member not found" });
    res.json({ message: "Team member deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
