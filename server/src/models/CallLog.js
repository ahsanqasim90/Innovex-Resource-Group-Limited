import mongoose from "mongoose";

const callActorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    role: { type: String, default: "" }
  },
  { _id: false }
);

const callLogSchema = new mongoose.Schema(
  {
    targetType: {
      type: String,
      enum: ["Candidate", "BusinessLead", "Manual"],
      default: "Manual",
      index: true
    },
    targetId: { type: mongoose.Schema.Types.ObjectId, index: true },
    targetName: { type: String, required: true, trim: true },
    targetPhone: { type: String, required: true, trim: true },
    sourceModule: { type: String, trim: true, default: "Calls" },
    provider: { type: String, default: "Yay.com" },
    direction: { type: String, enum: ["Outbound", "Inbound"], default: "Outbound" },
    status: {
      type: String,
      enum: ["Queued", "Dialling", "Connected", "Completed", "No Answer", "Failed", "Logged"],
      default: "Queued",
      index: true
    },
    outcome: {
      type: String,
      enum: ["Pending", "Interested", "Not Interested", "Call Back", "No Answer", "Wrong Number", "Converted", "Do Not Contact"],
      default: "Pending",
      index: true
    },
    durationSeconds: { type: Number, default: 0 },
    followUpAt: Date,
    notes: { type: String, trim: true },
    initiatedBy: callActorSchema,
    yay: {
      requestPayload: { type: mongoose.Schema.Types.Mixed, default: {} },
      responsePayload: { type: mongoose.Schema.Types.Mixed, default: {} },
      requestUrl: { type: String, default: "" },
      requestStatus: { type: Number },
      configured: { type: Boolean, default: false },
      message: { type: String, default: "" }
    }
  },
  { timestamps: true }
);

callLogSchema.index({ createdAt: -1 });
callLogSchema.index({ "initiatedBy.user": 1, createdAt: -1 });
callLogSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

export default mongoose.model("CallLog", callLogSchema);
