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
    lastContactedAt: Date,
    outreachHistory: [outreachSchema]
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
