import mongoose from "mongoose";

export const RECRUITMENT_STAGES = [
  "Pending admin review",
  "Changes requested",
  "Admin rejected",
  "Client review",
  "Interview requested",
  "Interview scheduled",
  "Client rejected",
  "Offer stage",
  "Hired",
  "Withdrawn"
];

const actorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    role: { type: String, trim: true }
  },
  { _id: false }
);

const cvSchema = new mongoose.Schema(
  {
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    data: { type: Buffer, select: false },
    extractedText: { type: String, select: false },
    indexedAt: Date,
    contentHash: String,
    verifiedType: String,
    scanStatus: String,
    scanEngine: String,
    scannedAt: Date,
    quarantineReason: String,
    uploadedAt: Date,
    uploadedBy: actorSchema
  },
  { _id: false }
);

const timelineSchema = new mongoose.Schema(
  {
    type: { type: String, trim: true },
    fromStage: { type: String, trim: true },
    toStage: { type: String, trim: true },
    note: { type: String, trim: true, maxlength: 2000 },
    actor: actorSchema,
    createdAt: { type: Date, default: Date.now }
  },
  { _id: true }
);

const recruitmentSubmissionSchema = new mongoose.Schema(
  {
    reference: { type: String, required: true, index: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate" },
    candidateName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    phone: { type: String, required: true, trim: true, index: true },
    location: { type: String, trim: true },
    currentRole: { type: String, trim: true },
    experienceYears: { type: Number, min: 0, max: 60 },
    currentSalary: { type: String, trim: true },
    expectedSalary: { type: String, trim: true },
    noticePeriod: { type: String, trim: true },
    rightToWork: { type: String, trim: true },
    linkedinUrl: { type: String, trim: true },
    recruiterSummary: { type: String, required: true, trim: true, maxlength: 5000 },
    consentConfirmed: { type: Boolean, required: true },
    consentConfirmedAt: Date,
    stage: { type: String, enum: RECRUITMENT_STAGES, default: "Pending admin review", index: true },
    submittedBy: { type: actorSchema, required: true },
    assignedRecruiter: actorSchema,
    adminReviewedBy: actorSchema,
    adminReviewedAt: Date,
    clientSubmittedAt: Date,
    interview: {
      date: Date,
      time: { type: String, trim: true },
      format: { type: String, enum: ["", "Video", "Telephone", "In person"], default: "" },
      locationOrLink: { type: String, trim: true },
      contactName: { type: String, trim: true }
    },
    outcomeReason: { type: String, trim: true, maxlength: 2000 },
    cv: cvSchema,
    timeline: [timelineSchema]
  },
  { timestamps: true }
);

recruitmentSubmissionSchema.index({ job: 1, email: 1 });
recruitmentSubmissionSchema.index({ candidateName: "text", email: "text", phone: "text", recruiterSummary: "text", reference: "text" });
recruitmentSubmissionSchema.index({ "submittedBy.user": 1, stage: 1, createdAt: -1 });
recruitmentSubmissionSchema.index({ organization: 1, reference: 1 }, { unique: true });

export default mongoose.model("RecruitmentSubmission", recruitmentSubmissionSchema);
