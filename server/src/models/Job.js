import mongoose from "mongoose";

const sourceDocumentSchema = new mongoose.Schema(
  {
    originalName: { type: String, trim: true },
    mimetype: { type: String, trim: true },
    size: Number,
    data: { type: Buffer, select: false },
    contentHash: { type: String, trim: true },
    verifiedType: { type: String, trim: true },
    uploadedAt: Date,
    uploadedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true }
    }
  },
  { _id: false }
);

const intelligenceSchema = new mongoose.Schema(
  {
    summary: { type: String, trim: true },
    skills: [{ type: String, trim: true }],
    qualifications: [{ type: String, trim: true }],
    essentialRequirements: [{ type: String, trim: true }],
    desirableRequirements: [{ type: String, trim: true }],
    keywords: [{ type: String, trim: true }],
    experienceYears: Number,
    analysedAt: Date,
    method: { type: String, default: "Privacy-safe explainable matching" }
  },
  { _id: false }
);

const criteriaReviewSchema = new mongoose.Schema(
  {
    mandatorySkills: [{ type: String, trim: true }],
    desirableSkills: [{ type: String, trim: true }],
    qualifications: [{ type: String, trim: true }],
    minimumExperienceYears: { type: Number, min: 0, max: 40, default: 0 },
    registrationRequired: { type: Boolean, default: false },
    registrationTerms: [{ type: String, trim: true }],
    rightToWorkRequired: { type: Boolean, default: true },
    drivingRequired: { type: Boolean, default: false },
    availabilityRequirement: { type: String, trim: true },
    reviewStatus: { type: String, enum: ["Needs review", "Reviewed"], default: "Needs review" },
    reviewedAt: Date,
    reviewedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true }
    }
  },
  { _id: false }
);

const scoreProfileSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "Balanced" },
    skills: { type: Number, min: 0, max: 100, default: 30 },
    experience: { type: Number, min: 0, max: 100, default: 25 },
    qualifications: { type: Number, min: 0, max: 100, default: 20 },
    location: { type: Number, min: 0, max: 100, default: 15 },
    availability: { type: Number, min: 0, max: 100, default: 5 },
    recency: { type: Number, min: 0, max: 100, default: 5 }
  },
  { _id: false }
);

const matchFeedbackSchema = new mongoose.Schema({
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true },
  verdict: { type: String, enum: ["Accurate", "Needs correction", "Strong candidate", "Not suitable"], required: true },
  reason: { type: String, trim: true },
  matchScore: Number,
  createdAt: { type: Date, default: Date.now },
  createdBy: {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true }
  }
});

const matchRunSchema = new mongoose.Schema(
  {
    analysedCandidates: Number,
    returnedCandidates: Number,
    minimumScore: Number,
    generatedAt: { type: Date, default: Date.now },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { _id: false }
);

const pipelineSchema = new mongoose.Schema({
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", required: true },
  stage: {
    type: String,
    enum: ["Shortlisted", "Contacted", "Interested", "Submitted", "Interview", "Offered", "Placed", "Rejected"],
    default: "Shortlisted"
  },
  matchScore: Number,
  notes: { type: String, trim: true },
  addedAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
  updatedBy: {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true }
  },
  vacancyEmailSentAt: Date,
  vacancyEmailFrom: { type: String, trim: true, lowercase: true }
});

const jobSchema = new mongoose.Schema(
  {
    reference: { type: String, trim: true, uppercase: true, index: true },
    clientName: { type: String, trim: true, select: false },
    title: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    salary: { type: String, required: true, trim: true },
    type: { type: String, required: true, trim: true },
    shift: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    requirements: [{ type: String, trim: true }],
    postcode: { type: String, trim: true, uppercase: true },
    radiusMiles: { type: Number, min: 0, max: 150, default: 25 },
    sourceDocument: sourceDocumentSchema,
    intelligence: intelligenceSchema,
    criteriaReview: criteriaReviewSchema,
    scoreProfile: { type: scoreProfileSchema, default: () => ({}) },
    matchFeedback: [matchFeedbackSchema],
    matchRuns: [matchRunSchema],
    pipeline: [pipelineSchema],
    priority: { type: String, enum: ["High", "Medium", "Low"], default: "Medium" },
    openings: { type: Number, min: 1, max: 1000, default: 1 },
    assignedRecruiters: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", select: false }],
    vacancyStatus: { type: String, enum: ["Open", "Paused", "Closed", "Filled"] },
    publicationStatus: { type: String, enum: ["Draft", "Pending Approval", "Approved", "Rejected"], default: "Pending Approval", index: true },
    approvalNotes: { type: String, trim: true, default: "" },
    approvedAt: Date,
    approvedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true }
    },
    closedAt: Date,
    closedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true }
    },
    isActive: { type: Boolean, default: true },
    closingDate: Date
  },
  { timestamps: true }
);

jobSchema.add({ clientAccount: { type: mongoose.Schema.Types.ObjectId, ref: "ClientAccount", index: true } });

jobSchema.index({ title: "text", location: "text", description: "text" });
jobSchema.index({ organization: 1, title: 1, location: 1, clientName: 1, closingDate: 1 });

jobSchema.pre("validate", function normalizeVacancy() {
  this.title = String(this.title || "").replace(/\s+/g, " ").trim();
  this.location = String(this.location || "").replace(/\s*,\s*/g, ", ").replace(/\s+/g, " ").replace(/\b([a-z])/g, (match) => match.toUpperCase()).trim();
  if (this.postcode) this.postcode = this.postcode.toUpperCase().replace(/\s+/g, " ").replace(/^([A-Z]{1,2}\d[A-Z\d]?)(\d[A-Z]{2})$/, "$1 $2");
  let salary = String(this.salary || "").replace(/\s+/g, " ").trim();
  if (/^\d[\d,]*(?:\.\d+)?$/.test(salary)) salary = `£${salary} per annum`;
  salary = salary.replace(/\bper annum\b/i, "per annum").replace(/\bper hour\b/i, "per hour").replace(/\bpa\b/i, "per annum");
  this.salary = salary;
});

export default mongoose.model("Job", jobSchema);
