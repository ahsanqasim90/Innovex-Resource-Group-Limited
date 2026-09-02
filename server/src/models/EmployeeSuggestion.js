import mongoose from "mongoose";

const suggestionStatuses = ["Submitted", "Under Review", "Planned", "Implemented", "Declined"];

const employeeSuggestionSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 140 },
    message: { type: String, required: true, trim: true, maxlength: 3000 },
    kind: { type: String, enum: ["Suggestion", "Process Improvement", "Portal Idea", "Workplace Feedback", "Concern"], default: "Suggestion", index: true },
    area: { type: String, enum: ["Recruitment", "Sales & CRM", "Training", "People & Culture", "Portal & Technology", "General"], default: "General", index: true },
    impact: { type: String, enum: ["Low", "Medium", "High"], default: "Medium", index: true },
    anonymous: { type: Boolean, default: false },
    status: { type: String, enum: suggestionStatuses, default: "Submitted", index: true },
    submittedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
      name: { type: String, required: true, trim: true },
      email: { type: String, required: true, trim: true, lowercase: true },
      role: { type: String, trim: true }
    },
    adminResponse: { type: String, trim: true, maxlength: 2000 },
    reviewedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, trim: true }
    },
    statusUpdatedAt: { type: Date },
    statusHistory: [{
      status: { type: String, enum: suggestionStatuses, required: true },
      note: { type: String, trim: true, maxlength: 2000 },
      changedBy: { type: String, trim: true },
      changedAt: { type: Date, default: Date.now }
    }]
  },
  { timestamps: true }
);

employeeSuggestionSchema.index({ "submittedBy.user": 1, createdAt: -1 });
employeeSuggestionSchema.index({ status: 1, createdAt: -1 });

export { suggestionStatuses };
export default mongoose.model("EmployeeSuggestion", employeeSuggestionSchema);
