import mongoose from "mongoose";

const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  prospect: { type: mongoose.Schema.Types.ObjectId, ref: "WebLeadProspect" },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, required: true },
  read: { type: Boolean, default: false }
}, { timestamps: true });

schema.index({ user: 1, read: 1, createdAt: -1 });
export default mongoose.model("WebLeadNotification", schema);
