import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    salary: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    shift: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    requirements: [{ type: String, trim: true }],
    isActive: { type: Boolean, default: true },
    closingDate: Date
  },
  { timestamps: true }
);

jobSchema.index({ title: "text", location: "text", description: "text" });

export default mongoose.model("Job", jobSchema);
