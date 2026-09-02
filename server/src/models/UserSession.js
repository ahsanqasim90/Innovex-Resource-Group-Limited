import mongoose from "mongoose";

const userSessionSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    jtiHash: { type: String, required: true, unique: true, index: true },
    ipAddress: { type: String, trim: true, default: "" },
    userAgent: { type: String, trim: true, default: "" },
    deviceLabel: { type: String, trim: true, default: "Unknown device" },
    lastSeenAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    revokeReason: { type: String, trim: true, default: "" },
    suspicious: { type: Boolean, default: false, index: true }
  },
  { timestamps: true }
);

userSessionSchema.index({ organization: 1, user: 1, revokedAt: 1, expiresAt: -1 });
userSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export default mongoose.model("UserSession", userSessionSchema);
