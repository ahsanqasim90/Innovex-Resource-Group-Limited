export function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

// Problems caused by the person uploading a file (too large, wrong type) are not server faults:
// answer with a clear 4xx message and keep them out of the Operations error log.
const uploadMessages = {
  LIMIT_FILE_SIZE: "That file is too large. Please upload a file under the size limit shown on the form (5MB for CVs).",
  LIMIT_FILE_COUNT: "Too many files were attached.",
  LIMIT_UNEXPECTED_FILE: "That file could not be accepted. Please attach it using the upload box on the form."
};

export function errorHandler(error, req, res, next) {
  if (error?.name === "MulterError") {
    error.statusCode = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    error.message = uploadMessages[error.code] || error.message;
  }
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
