import mongoose from "mongoose";

const newsletterSubscriberSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    firstName: { type: String, trim: true, maxlength: 80 },
    lastName: { type: String, trim: true, maxlength: 80 },
    companyName: { type: String, trim: true, maxlength: 160 },
    subscriberType: {
      type: String,
      enum: ["Corporate", "Individual", "Sole trader", "Ordinary partnership", "Unknown"],
      default: "Unknown",
      index: true
    },
    interests: [{
      type: String,
      enum: ["Recruitment", "Training", "Website Development", "SEO", "Reg 44", "Business Growth", "General"]
    }],
    status: {
      type: String,
      enum: ["Subscribed", "Unsubscribed", "Suppressed", "Bounced"],
      default: "Subscribed",
      index: true
    },
    lawfulBasis: {
      type: String,
      enum: ["Consent", "Soft opt-in", "Legitimate interests", "Not recorded"],
      default: "Not recorded",
      index: true
    },
    basisEvidence: { type: String, trim: true, maxlength: 1200 },
    liaReference: { type: String, trim: true, maxlength: 300 },
    consentWordingVersion: { type: String, trim: true, maxlength: 80 },
    consentObtainedAt: Date,
    privacyNoticeSentAt: Date,
    source: { type: String, trim: true, default: "Admin entry", maxlength: 160 },
    sourceIp: { type: String, trim: true, maxlength: 100 },
    lastSentAt: Date,
    unsubscribedAt: Date,
    unsubscribeReason: { type: String, trim: true, maxlength: 500 },
    suppressionReason: { type: String, trim: true, maxlength: 500 },
    createdBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, trim: true },
      email: { type: String, trim: true, lowercase: true }
    }
  },
  { timestamps: true }
);

newsletterSubscriberSchema.index({ status: 1, subscriberType: 1, lawfulBasis: 1 });
newsletterSubscriberSchema.index({ interests: 1, status: 1 });
newsletterSubscriberSchema.index({ companyName: "text", firstName: "text", lastName: "text", email: "text" });
newsletterSubscriberSchema.index({ organization: 1, email: 1 }, { unique: true });

export default mongoose.model("NewsletterSubscriber", newsletterSubscriberSchema);
