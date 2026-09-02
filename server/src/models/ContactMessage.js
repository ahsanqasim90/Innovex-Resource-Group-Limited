import mongoose from "mongoose";

const contactNoteSchema = new mongoose.Schema(
  {
    body: { type: String, required: true, trim: true, maxlength: 3000 },
    createdBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true }
    },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

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
        "CRM Systems",
        "SEO Services",
        "Partnership",
        "General Enquiry"
      ],
      default: "General Enquiry"
    },
    subject: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ["New", "Read", "In Progress", "Waiting", "Resolved", "Archived"],
      default: "New",
      index: true
    },
    priority: { type: String, enum: ["Low", "Normal", "High", "Urgent"], default: "Normal", index: true },
    source: { type: String, trim: true, default: "Website contact form" },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    internalNotes: [contactNoteSchema],
    lastActivityAt: { type: Date, default: Date.now, index: true },
    firstRespondedAt: Date,
    resolvedAt: Date,
    sourceIp: { type: String, trim: true },
    userAgent: { type: String, trim: true }
  },
  { timestamps: true }
);

contactMessageSchema.add({ clientAccount: { type: mongoose.Schema.Types.ObjectId, ref: "ClientAccount", index: true } });

contactMessageSchema.index({ createdAt: -1, status: 1 });
contactMessageSchema.index({ inquiryType: 1, priority: 1, lastActivityAt: -1 });
contactMessageSchema.index({ name: "text", email: "text", phone: "text", subject: "text", message: "text" });

export default mongoose.model("ContactMessage", contactMessageSchema);
