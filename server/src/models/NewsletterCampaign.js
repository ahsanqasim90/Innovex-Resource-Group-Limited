import mongoose from "mongoose";

const actorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, default: "System" },
    email: { type: String, default: "" },
    role: { type: String, default: "" }
  },
  { _id: false }
);

const deliverySchema = new mongoose.Schema(
  {
    subscriber: { type: mongoose.Schema.Types.ObjectId, ref: "NewsletterSubscriber" },
    email: { type: String, trim: true, lowercase: true },
    status: { type: String, enum: ["Sent", "Failed", "Suppressed"], required: true },
    reason: { type: String, trim: true },
    sentAt: Date
  },
  { _id: false }
);

const newsletterCampaignSchema = new mongoose.Schema(
  {
    campaignId: { type: String, required: true, index: true },
    internalName: { type: String, required: true, trim: true, maxlength: 140 },
    subject: { type: String, required: true, trim: true, maxlength: 180 },
    preheader: { type: String, trim: true, maxlength: 220 },
    headline: { type: String, required: true, trim: true, maxlength: 180 },
    introduction: { type: String, required: true, trim: true, maxlength: 1200 },
    insightTitle: { type: String, trim: true, maxlength: 180 },
    insightBody: { type: String, trim: true, maxlength: 2600 },
    ctaLabel: { type: String, trim: true, maxlength: 60 },
    ctaUrl: { type: String, trim: true, maxlength: 500 },
    serviceFocus: [{
      type: String,
      enum: ["Recruitment", "Training", "Website Development", "SEO", "Reg 44", "Business Growth"]
    }],
    senderEmail: { type: String, required: true, trim: true, lowercase: true },
    audience: {
      subscriberTypes: [{ type: String, enum: ["Corporate", "Individual", "Sole trader", "Ordinary partnership"] }],
      interests: [{ type: String, enum: ["Recruitment", "Training", "Website Development", "SEO", "Reg 44", "Business Growth", "General"] }]
    },
    status: { type: String, enum: ["Draft", "Sending", "Sent", "Partially sent"], default: "Draft", index: true },
    slug: { type: String, required: true, trim: true, index: true },
    archivePublished: { type: Boolean, default: false, index: true },
    publishedAt: Date,
    sentAt: Date,
    totals: {
      eligible: { type: Number, default: 0 },
      sent: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
      suppressed: { type: Number, default: 0 }
    },
    deliveries: [deliverySchema],
    createdBy: actorSchema,
    sentBy: actorSchema
  },
  { timestamps: true }
);

newsletterCampaignSchema.index({ archivePublished: 1, publishedAt: -1 });
newsletterCampaignSchema.index({ status: 1, createdAt: -1 });
newsletterCampaignSchema.index({ organization: 1, campaignId: 1 }, { unique: true });
newsletterCampaignSchema.index({ organization: 1, slug: 1 }, { unique: true });

export default mongoose.model("NewsletterCampaign", newsletterCampaignSchema);
