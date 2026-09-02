import mongoose from "mongoose";

const applicationSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, required: true, trim: true },
    coverMessage: { type: String, trim: true },
    privacyNoticeVersion: { type: String, trim: true },
    privacyAcknowledgedAt: Date,
    status: { type: String, enum: ["New", "Reviewed", "Shortlisted", "Rejected"], default: "New" },
    attribution: {
      source: { type: String, trim: true, maxlength: 120, default: "Direct", index: true },
      medium: { type: String, trim: true, maxlength: 120, default: "" },
      campaign: { type: String, trim: true, maxlength: 160, default: "" },
      referrer: { type: String, trim: true, maxlength: 500, default: "" }
    },
    cv: {
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
      quarantineReason: String
    }
  },
  { timestamps: true }
);

applicationSchema.index({ name: "text", email: "text", phone: "text" });
applicationSchema.index({ organization: 1, "attribution.source": 1, status: 1, createdAt: -1 });

export default mongoose.model("Application", applicationSchema);
