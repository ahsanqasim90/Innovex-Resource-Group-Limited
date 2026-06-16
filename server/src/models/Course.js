import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    duration: { type: String, required: true, trim: true },
    defaultSellingPrice: { type: Number, default: 0, min: 0 },
    defaultTrainerCost: { type: Number, default: 0, min: 0 },
    certificateIncluded: { type: Boolean, default: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" }
  },
  { timestamps: true }
);

courseSchema.index({ title: "text", category: "text", description: "text" });
courseSchema.index({ status: 1, category: 1 });

export default mongoose.model("Course", courseSchema);
