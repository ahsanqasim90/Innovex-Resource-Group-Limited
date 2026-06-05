import mongoose from "mongoose";

const contactMessageSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    inquiryType: {
      type: String,
      enum: [
        "Recruitment Support",
        "Job Application / CV",
        "Website Development",
        "SEO Services",
        "Partnership",
        "General Enquiry"
      ],
      default: "General Enquiry"
    },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    status: { type: String, enum: ["New", "Read", "Resolved"], default: "New" }
  },
  { timestamps: true }
);

export default mongoose.model("ContactMessage", contactMessageSchema);
