import mongoose from "mongoose";

const actorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    role: { type: String, default: "" }
  },
  { _id: false }
);

const offerLetterSchema = new mongoose.Schema(
  {
    offerNumber: { type: String, required: true, unique: true, index: true },
    candidateName: { type: String, required: true, trim: true, index: true },
    candidateEmail: { type: String, required: true, trim: true, lowercase: true, index: true },
    candidatePhone: { type: String, trim: true },
    roleTitle: { type: String, required: true, trim: true, index: true },
    department: { type: String, trim: true },
    employmentType: { type: String, enum: ["Permanent", "Temporary", "Contract", "Part-time", "Full-time", "Other"], default: "Permanent" },
    startDate: { type: Date },
    workLocation: { type: String, trim: true },
    salaryType: { type: String, enum: ["Annual salary", "Hourly rate", "Day rate", "Other"], default: "Annual salary" },
    salaryAmount: { type: Number, default: 0, min: 0 },
    hoursPerWeek: { type: Number, default: 0, min: 0 },
    reportingTo: { type: String, trim: true },
    probationPeriod: { type: String, trim: true, default: "6 months" },
    offerExpiryDate: { type: Date },
    conditions: { type: String, trim: true },
    benefits: { type: String, trim: true },
    notes: { type: String, trim: true },
    status: { type: String, enum: ["Draft", "Sent", "Accepted", "Declined", "Withdrawn"], default: "Draft", index: true },
    senderEmail: { type: String, trim: true, lowercase: true },
    cc: [{ type: String, trim: true, lowercase: true }],
    customMessage: { type: String, trim: true },
    sentAt: { type: Date },
    acceptedAt: { type: Date },
    sentFolderSaved: { type: Boolean, default: false },
    sentFolderError: { type: String, trim: true },
    createdBy: actorSchema,
    updatedBy: actorSchema
  },
  { timestamps: true }
);

offerLetterSchema.index({ candidateName: "text", candidateEmail: "text", roleTitle: "text", offerNumber: "text" });
offerLetterSchema.index({ createdAt: -1 });

export default mongoose.model("OfferLetter", offerLetterSchema);
