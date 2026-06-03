import app from "../server/src/app.js";
import { connectDB } from "../server/src/config/db.js";

let ready;

export default async function handler(req, res) {
  if (!ready) {
    ready = connectDB();
  }

  await ready;
  return app(req, res);
}
