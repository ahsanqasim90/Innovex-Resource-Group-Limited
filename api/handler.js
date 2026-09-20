import app from "../server/src/app.js";
import { connectDB } from "../server/src/config/db.js";

let ready;

function databaseReady() {
  if (!ready) {
    ready = connectDB().catch((error) => {
      // Do not permanently poison a warm function instance after a temporary
      // Atlas/DNS failure. The next request gets a fresh connection attempt.
      ready = undefined;
      throw error;
    });
  }
  return ready;
}

export default async function handler(req, res) {
  // Health checks must report the function's availability even while the
  // database is reconnecting; operational DB health has its own protected API.
  if (/^\/api\/health(?:\?|$)/.test(req.url || "")) {
    return app(req, res);
  }

  try {
    await databaseReady();
    return app(req, res);
  } catch (error) {
    console.error("Database connection failed", error);
    return res.status(503).json({ message: "The secure portal is reconnecting. Please try again in a moment." });
  }
}
