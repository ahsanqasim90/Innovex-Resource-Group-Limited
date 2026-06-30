import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { protect } from "../middleware/auth.js";
import { safeUser } from "../config/permissions.js";
import { requireFields, validateEmail } from "../utils.js";
import ActivityLog from "../models/ActivityLog.js";

const router = express.Router();

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d"
  });
}

router.post("/login", async (req, res, next) => {
  try {
    requireFields(req.body, ["email", "password"]);
    validateEmail(req.body.email);

    const user = await User.findOne({ email: req.body.email.toLowerCase() });
    if (!user || !(await user.matchPassword(req.body.password))) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    await ActivityLog.create({
      actor: { user: user._id, name: user.name, email: user.email, role: user.role },
      module: user.role === "external_agent" || user.role === "sales_manager" ? "Web Leads CRM" : "Authentication",
      action: "Login",
      entityType: "User",
      entityId: user._id,
      summary: `${user.name} logged in`,
      ipAddress: req.ip,
      userAgent: req.get("user-agent") || ""
    }).catch(() => null);

    res.json({
      token: signToken(user),
      user: safeUser(user)
    });
  } catch (error) {
    next(error);
  }
});

router.get("/me", protect, (req, res) => {
  res.json({ user: safeUser(req.user) });
});

export default router;
