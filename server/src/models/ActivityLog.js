import mongoose from "mongoose";

const activityLogSchema = new mongoose.Schema(
  {
    actor: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, default: "System" },
      email: { type: String, default: "" },
      role: { type: String, default: "" }
    },
    module: { type: String, required: true, trim: true },
    action: { type: String, required: true, trim: true },
    entityType: { type: String, required: true, trim: true },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    summary: { type: String, required: true, trim: true },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" }
  },
  { timestamps: true }
);

activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ "actor.user": 1, createdAt: -1 });
activityLogSchema.index({ module: 1, createdAt: -1 });

export default mongoose.model("ActivityLog", activityLogSchema);
