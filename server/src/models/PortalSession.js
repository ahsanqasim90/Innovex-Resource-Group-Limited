import mongoose from "mongoose";

const portalSessionSchema = new mongoose.Schema({
  account: { type: mongoose.Schema.Types.ObjectId, ref: "PortalAccount", required: true, index: true },
  jtiHash: { type: String, required: true, index: true },
  ipAddress: String,
  userAgent: String,
  expiresAt: { type: Date, required: true, expires: 0 },
  revokedAt: Date
}, { timestamps: true });

export default mongoose.model("PortalSession", portalSessionSchema);
