import mongoose from "mongoose";

const testimonialSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    reviewType: { type: String, enum: ["Candidate", "Partner"], default: "Candidate" },
    role: { type: String, required: true, trim: true },
    company: { type: String, trim: true },
    rating: { type: Number, min: 1, max: 5, default: 5 },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" }
  },
  { timestamps: true }
);

export default mongoose.model("Testimonial", testimonialSchema);
