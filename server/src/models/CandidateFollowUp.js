import mongoose from "mongoose";

const actorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    role: { type: String, trim: true, default: "" }
  },
  { _id: false }
);

const candidateFollowUpSchema = new mongoose.Schema(
  {
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true, index: true },
    dueAt: { type: Date, required: true, index: true },
    channel: { type: String, enum: ["Email", "Phone", "WhatsApp", "SMS", "Other"], default: "Phone" },
    priority: { type: String, enum: ["Low", "Normal", "High", "Urgent"], default: "Normal", index: true },
    purpose: { type: String, trim: true, maxlength: 500, required: true },
    notes: { type: String, trim: true, maxlength: 3000, default: "" },
    status: { type: String, enum: ["Open", "Completed", "Cancelled"], default: "Open", index: true },
    outcome: { type: String, trim: true, maxlength: 500, default: "" },
    assignedTo: actorSchema,
    createdBy: actorSchema,
    completedBy: actorSchema,
    completedAt: Date
  },
  { timestamps: true }
);

candidateFollowUpSchema.index({ "assignedTo.user": 1, status: 1, dueAt: 1 });
candidateFollowUpSchema.index({ candidate: 1, dueAt: -1 });

export default mongoose.model("CandidateFollowUp", candidateFollowUpSchema);
