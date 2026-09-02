import mongoose from "mongoose";

const automationTaskSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, trim: true, maxlength: 2000, default: "" },
  status: { type: String, enum: ["Open", "Completed", "Cancelled"], default: "Open", index: true },
  priority: { type: String, enum: ["Low", "Normal", "High", "Urgent"], default: "Normal", index: true },
  dueAt: { type: Date, index: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  rule: { type: mongoose.Schema.Types.ObjectId, ref: "AutomationRule", index: true },
  entityType: { type: String, trim: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, index: true },
  entityLabel: { type: String, trim: true },
  completedAt: Date,
  completedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

automationTaskSchema.index({ organization: 1, status: 1, dueAt: 1 });
export default mongoose.model("AutomationTask", automationTaskSchema);
