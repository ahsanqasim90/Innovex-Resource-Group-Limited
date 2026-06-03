import mongoose from "mongoose";

const cvUploadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    desiredRole: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    experience: { type: String, required: true, trim: true },
    status: { type: String, enum: ["New", "Contacted", "Shortlisted"], default: "New" },
    cv: {
      filename: { type: String, required: true },
      originalName: String,
      mimetype: String,
      size: Number
    }
  },
  { timestamps: true }
);

cvUploadSchema.index({ name: "text", email: "text", desiredRole: "text", location: "text" });

export default mongoose.model("CvUpload", cvUploadSchema);
