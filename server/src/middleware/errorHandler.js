export function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

export function errorHandler(error, req, res, next) {
  const status = error.statusCode || 500;
  if (status >= 500) {
    const fingerprint = crypto.createHash("sha256").update(`${req.method}:${req.route?.path || req.path}:${error.name}:${error.message}`).digest("hex").slice(0, 24);
    SystemEvent.findOneAndUpdate(
      { fingerprint, status: { $ne: "Resolved" } },
      { $set: { type: "Error", severity: status >= 503 ? "Critical" : "Error", status: "Open", title: `${req.method} ${req.originalUrl} failed`, message: error.message || "Server error", lastSeenAt: new Date(), metadata: { status, method: req.method, path: req.originalUrl } }, $setOnInsert: { firstSeenAt: new Date() }, $inc: { occurrences: 1 } },
      { upsert: true }
    ).catch(() => null);
  }
  res.status(status).json({
    message: error.message || "Server error",
    details: process.env.NODE_ENV === "production" ? undefined : error.stack
  });
}
import crypto from "node:crypto";
import SystemEvent from "../models/SystemEvent.js";
