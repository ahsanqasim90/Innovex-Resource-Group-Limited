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

const employmentTypes = ["Permanent", "Temporary", "Contract", "Part-time", "Full-time", "Other"];
const salaryTypes = ["Annual salary", "Hourly rate", "Day rate", "Fixed fee", "Other"];

function normalizeEnum(value, allowedValues) {
  if (!value) return value;
  const clean = String(value).trim().toLowerCase().replace(/_/g, "-").replace(/\s+/g, " ");
  const aliases = {
    "full time": "Full-time",
    fulltime: "Full-time",
    "full-time": "Full-time",
    "part time": "Part-time",
    parttime: "Part-time",
    "part-time": "Part-time",
    "fixed fee": "Fixed fee",
    fixedfee: "Fixed fee",
    "fixed-fee": "Fixed fee"
  };
  if (aliases[clean]) return aliases[clean];
  return allowedValues.find((item) => item.toLowerCase() === clean) || value;
}

const offerLetterSchema = new mongoose.Schema(
  {
    offerNumber: { type: String, required: true, unique: true, index: true },
    candidateName: { type: String, required: true, trim: true, index: true },
    candidateEmail: { type: String, required: true, trim: true, lowercase: true, index: true },
    candidatePhone: { type: String, trim: true },
    roleTitle: { type: String, required: true, trim: true, index: true },
    department: { type: String, trim: true },
    employmentType: { type: String, enum: employmentTypes, default: "Permanent", set: (value) => normalizeEnum(value, employmentTypes) },
    startDate: { type: Date },
    workLocation: { type: String, trim: true },
    salaryType: { type: String, enum: salaryTypes, default: "Annual salary", set: (value) => normalizeEnum(value, salaryTypes) },
    salaryAmount: { type: Number, default: 0, min: 0 },
    hoursPerWeek: { type: Number, default: 0, min: 0 },
    reportingTo: { type: String, trim: true },
    probationPeriod: { type: String, trim: true, default: "6 months" },
    offerExpiryDate: { type: Date },
    conditions: { type: String, trim: true },
    benefits: { type: String, trim: true },
    notes: { type: String, trim: true },
    signatoryName: { type: String, trim: true, default: "Muhammad Ahsan Qasim" },
    signatoryTitle: { type: String, trim: true, default: "Co-founder & Director" },
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
