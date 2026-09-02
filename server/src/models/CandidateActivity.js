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

const candidateActivitySchema = new mongoose.Schema(
  {
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true, index: true },
    type: {
      type: String,
      enum: ["Note", "Message", "Status change", "Follow-up update", "Profile update"],
      default: "Note",
      index: true
    },
    channel: { type: String, enum: ["CRM", "Email", "Phone", "WhatsApp", "SMS", "Other"], default: "CRM" },
    summary: { type: String, required: true, trim: true, maxlength: 300 },
    details: { type: String, trim: true, maxlength: 5000, default: "" },
    createdBy: actorSchema
  },
  { timestamps: true }
);

candidateActivitySchema.index({ candidate: 1, createdAt: -1 });

export default mongoose.model("CandidateActivity", candidateActivitySchema);
