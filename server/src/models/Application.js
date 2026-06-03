import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    coverMessage: { type: String, trim: true },
    status: { type: String, enum: ["New", "Reviewed", "Shortlisted", "Rejected"], default: "New" },
    cv: {
      filename: String,
      originalName: String,
      mimetype: String,
      size: Number
    }
  },
  { timestamps: true }
);

applicationSchema.index({ name: "text", email: "text", phone: "text" });

export default mongoose.model("Application", applicationSchema);
