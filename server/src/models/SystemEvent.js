import mongoose from "mongoose";

const systemEventSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["Error", "Security", "Queue", "Uptime", "Backup", "Integration"], required: true, index: true },
    severity: { type: String, enum: ["Info", "Warning", "Error", "Critical"], default: "Info", index: true },
    status: { type: String, enum: ["Open", "Monitoring", "Resolved"], default: "Open", index: true },
    title: { type: String, required: true, trim: true },
    message: { type: String, trim: true, default: "" },
    fingerprint: { type: String, trim: true, index: true },
    occurrences: { type: Number, default: 1, min: 1 },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt: { type: Date, default: Date.now, index: true },
    resolvedAt: Date,
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

systemEventSchema.index({ organization: 1, status: 1, severity: 1, lastSeenAt: -1 });

export default mongoose.model("SystemEvent", systemEventSchema);

