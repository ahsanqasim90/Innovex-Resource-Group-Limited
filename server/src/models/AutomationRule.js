import mongoose from "mongoose";

const conditionSchema = new mongoose.Schema({
  field: { type: String, required: true, trim: true, maxlength: 120 },
  operator: { type: String, enum: ["equals", "not_equals", "contains", "exists", "changes_to"], default: "equals" },
  value: { type: String, trim: true, maxlength: 500, default: "" }
}, { _id: false });

const actionSchema = new mongoose.Schema({
  type: { type: String, enum: ["Create task", "In-app notification", "SLA reminder"], required: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  message: { type: String, trim: true, maxlength: 1200, default: "" },
  priority: { type: String, enum: ["Low", "Normal", "High", "Urgent"], default: "Normal" },
  dueMinutes: { type: Number, min: 0, max: 525600, default: 1440 },
  targetUser: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  targetRole: { type: String, trim: true, default: "" }
}, { _id: true });

const automationRuleSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 160 },
  description: { type: String, trim: true, maxlength: 800, default: "" },
  enabled: { type: Boolean, default: true, index: true },
  trigger: {
    entity: { type: String, enum: ["Candidate", "Job", "Application", "ClientAccount", "Compliance"], required: true },
    event: { type: String, enum: ["created", "status_changed", "approved", "document_expiring"], required: true }
  },
  conditions: [conditionSchema],
  actions: { type: [actionSchema], validate: [(value) => value.length > 0, "At least one action is required"] },
  metrics: { runs: { type: Number, default: 0 }, succeeded: { type: Number, default: 0 }, failed: { type: Number, default: 0 }, lastRunAt: Date },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

automationRuleSchema.index({ organization: 1, enabled: 1, "trigger.entity": 1, "trigger.event": 1 });
export default mongoose.model("AutomationRule", automationRuleSchema);
