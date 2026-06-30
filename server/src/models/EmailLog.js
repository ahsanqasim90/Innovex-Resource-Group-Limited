import mongoose from "mongoose";

const emailActorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    role: { type: String, default: "" }
  },
  { _id: false }
);

const emailLogSchema = new mongoose.Schema(
  {
    fromEmail: { type: String, required: true, trim: true, lowercase: true, index: true },
    fromName: { type: String, trim: true },
    to: [{ type: String, trim: true, lowercase: true }],
    cc: [{ type: String, trim: true, lowercase: true }],
    bcc: [{ type: String, trim: true, lowercase: true }],
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true },
    targetType: { type: String, enum: ["Candidate", "BusinessLead", "WebLeadProspect", "Manual"], default: "Manual", index: true },
    targetId: { type: mongoose.Schema.Types.ObjectId },
    status: { type: String, enum: ["Sent", "Failed"], default: "Sent", index: true },
    error: { type: String, trim: true },
    sentBy: emailActorSchema
  },
  { timestamps: true }
);

emailLogSchema.index({ createdAt: -1 });
emailLogSchema.index({ "sentBy.user": 1, createdAt: -1 });
emailLogSchema.index({ subject: "text", message: "text", to: "text", fromEmail: "text" });

export default mongoose.model("EmailLog", emailLogSchema);
