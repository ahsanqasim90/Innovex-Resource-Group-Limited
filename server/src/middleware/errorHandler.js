export function notFound(req, res, next) {
  const error = new Error(`Route not found: ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
}

export function errorHandler(error, req, res, next) {
  const status = error.statusCode || 500;
  res.status(status).json({
    message: error.message || "Server error",
    details: process.env.NODE_ENV === "production" ? undefined : error.stack
  });
}
