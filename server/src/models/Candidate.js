import mongoose from "mongoose";

const outreachSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: "Job" },
    jobTitle: { type: String, trim: true },
    subject: { type: String, trim: true },
    message: { type: String, trim: true },
    status: {
      type: String,
      enum: ["Emailed", "Interested", "Not Interested", "No Response", "Shortlisted", "Submitted", "Placed"],
      default: "Emailed"
    },
    sentAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const cvFileSchema = new mongoose.Schema(
  {
    filename: { type: String, trim: true },
    originalName: { type: String, trim: true },
    mimetype: { type: String, trim: true },
    size: Number,
    data: { type: Buffer, select: false },
    extractedText: { type: String, select: false },
    indexedAt: Date,
    contentHash: { type: String, trim: true },
    verifiedType: { type: String, trim: true },
    scanStatus: { type: String, enum: ["Clean", "Quarantined", "Validated", "Needs review", "Rejected"], default: "Quarantined" },
    scanEngine: { type: String, trim: true },
    scannedAt: Date,
    quarantineReason: { type: String, trim: true },
    uploadedAt: Date,
    uploadedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true }
    }
  },
  { _id: false }
);

const cvDownloadRequestSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
  requestedAt: { type: Date, default: Date.now },
  reviewedAt: Date,
  reviewedBy: {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true }
  }
});

const candidateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    postcode: { type: String, trim: true, uppercase: true },
    postcodePrefix: { type: String, trim: true, uppercase: true, index: true },
    city: { type: String, trim: true },
    desiredRole: { type: String, trim: true, index: true },
    experience: { type: String, trim: true },
    visaStatus: { type: String, trim: true },
    availability: { type: String, trim: true },
    shiftPreference: { type: String, trim: true },
    payExpectation: { type: String, trim: true },
    latitude: Number,
    longitude: Number,
    status: {
      type: String,
      enum: ["Available", "Contacted", "Interested", "Not Interested", "Shortlisted", "Submitted", "Placed", "Do Not Contact"],
      default: "Available",
      index: true
    },
    source: { type: String, trim: true, default: "Talent Pool" },
    tags: [{ type: String, trim: true }],
    notes: { type: String, trim: true },
    lawfulBasis: { type: String, enum: ["Not recorded", "Consent", "Legitimate interests", "Contract", "Legal obligation"], default: "Not recorded" },
    privacyNoticeSentAt: Date,
    retentionReviewDate: Date,
    lastContactedAt: Date,
    lastCommunicationAt: { type: Date, index: true },
    nextFollowUpAt: { type: Date, index: true },
    assignedRecruiter: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true }
    },
    outreachHistory: [outreachSchema],
    cv: cvFileSchema,
    cvAccess: {
      viewUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      downloadUserIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      downloadRequests: [cvDownloadRequestSchema]
    }
  },
  { timestamps: true }
);

candidateSchema.index({
  name: "text",
  email: "text",
  phone: "text",
  postcode: "text",
  city: "text",
  desiredRole: "text",
  experience: "text",
  visaStatus: "text",
  tags: "text"
});
candidateSchema.index({ email: 1 }, { sparse: true });
candidateSchema.index({ phone: 1 }, { sparse: true });
candidateSchema.index({ postcodePrefix: 1, desiredRole: 1, status: 1 });
candidateSchema.index({ latitude: 1, longitude: 1 });

candidateSchema.pre("save", function setPostcodePrefix(next) {
  if (this.postcode) {
    this.postcode = this.postcode.toUpperCase().replace(/\s+/g, " ").trim();
    this.postcodePrefix = this.postcode.replace(/\s+/g, "").slice(0, 4);
  }
  next();
});

export default mongoose.model("Candidate", candidateSchema);
