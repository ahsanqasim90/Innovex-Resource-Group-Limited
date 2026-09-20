// Scheduled jobs (Vercel Cron) call these endpoints without a login. Vercel sends
// "Authorization: Bearer <CRON_SECRET>" automatically when the CRON_SECRET environment
// variable is set. If no secret is configured the endpoint stays closed, so nobody can
// trigger reminder emails or bulk jobs by simply visiting the URL.
export function isCronAuthorized(req) {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && req.headers.authorization === `Bearer ${secret}`;
}

export function rejectUnlessCron(req, res) {
  if (isCronAuthorized(req)) return false;
  res.status(401).json({ message: "Invalid cron authorization" });
  return true;
}
