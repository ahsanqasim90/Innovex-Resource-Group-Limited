import mongoose from "mongoose";

const automationRunSchema = new mongoose.Schema({
  rule: { type: mongoose.Schema.Types.ObjectId, ref: "AutomationRule", required: true, index: true },
  ruleName: { type: String, trim: true },
  trigger: { entity: String, event: String },
  entityType: String,
  entityId: mongoose.Schema.Types.ObjectId,
  matched: { type: Boolean, default: false },
  status: { type: String, enum: ["Succeeded", "Skipped", "Failed"], required: true, index: true },
  actionsCreated: { type: Number, default: 0 },
  message: { type: String, trim: true, maxlength: 1200 },
  durationMs: Number
}, { timestamps: true });

automationRunSchema.index({ organization: 1, createdAt: -1 });
export default mongoose.model("AutomationRun", automationRunSchema);
