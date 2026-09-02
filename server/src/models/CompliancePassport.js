import mongoose from "mongoose";

export const CORE_COMPLIANCE_TYPES = ["Identity", "Right to Work", "Enhanced DBS", "Reference 1", "Reference 2"];
export const REQUIRED_COMPLIANCE_TYPES = [...CORE_COMPLIANCE_TYPES, "NMC Registration"];

const actorSchema = new mongoose.Schema({ user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, name: String, email: String }, { _id: false });
const fileSchema = new mongoose.Schema({ filename: String, originalName: String, mimetype: String, size: Number, data: { type: Buffer, select: false }, contentHash: String, verifiedType: String, scanStatus: String, scanEngine: String, scannedAt: Date, quarantineReason: String, uploadedAt: Date, uploadedBy: actorSchema }, { _id: false });
const historySchema = new mongoose.Schema({ action: String, note: String, actor: actorSchema, at: { type: Date, default: Date.now } }, { _id: true });
const checkSchema = new mongoose.Schema({
  type: { type: String, enum: [...REQUIRED_COMPLIANCE_TYPES, "Care Certificate", "Mandatory Training", "Driving Licence", "Vaccination", "Other"], required: true },
  label: { type: String, trim: true },
  required: { type: Boolean, default: function requiredByDefault() { return CORE_COMPLIANCE_TYPES.includes(this.type); } },
  status: { type: String, enum: ["Missing", "Pending review", "Verified", "Rejected", "Expired"], default: "Missing", index: true },
  reference: { type: String, trim: true },
  issuer: { type: String, trim: true },
  issuedAt: Date,
  expiresAt: { type: Date, index: true },
  notes: { type: String, trim: true, maxlength: 2000 },
  file: fileSchema,
  verifiedAt: Date,
  verifiedBy: actorSchema,
  rejectionReason: { type: String, trim: true }
}, { timestamps: true });

const compliancePassportSchema = new mongoose.Schema({
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true, index: true },
  overallStatus: { type: String, enum: ["Red", "Amber", "Green"], default: "Red", index: true },
  checks: [checkSchema],
  consentCapturedAt: Date,
  consentMethod: { type: String, trim: true },
  consentCapturedBy: actorSchema,
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  riskNotes: { type: String, trim: true, maxlength: 3000 },
  lastReviewedAt: Date,
  history: [historySchema]
}, { timestamps: true });

compliancePassportSchema.index({ organization: 1, candidate: 1 }, { unique: true });
compliancePassportSchema.pre("save", function calculateStatus() {
  const now = new Date();
  this.checks.forEach((check) => { if (check.expiresAt && check.expiresAt < now && check.status === "Verified") check.status = "Expired"; });
  const required = this.checks.filter((check) => check.required);
  const verified = required.filter((check) => check?.status === "Verified").length;
  this.overallStatus = required.length > 0 && verified === required.length ? "Green" : verified > 0 ? "Amber" : "Red";
});

export default mongoose.model("CompliancePassport", compliancePassportSchema);
