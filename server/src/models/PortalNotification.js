import mongoose from "mongoose";

const portalNotificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, required: true, trim: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    link: { type: String, trim: true, maxlength: 500 },
    entityType: { type: String, trim: true },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    read: { type: Boolean, default: false, index: true },
    actor: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, trim: true }
    }
  },
  { timestamps: true }
);

portalNotificationSchema.index({ user: 1, read: 1, createdAt: -1 });

export default mongoose.model("PortalNotification", portalNotificationSchema);
