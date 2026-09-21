import mongoose from "mongoose";

const socialPostSchema = new mongoose.Schema(
  {
    job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", required: true, index: true },
    jobTitle: { type: String, trim: true },
    platform: { type: String, enum: ["Facebook", "Instagram"], required: true },
    status: { type: String, enum: ["Posted", "Failed"], required: true },
    externalId: { type: String, trim: true },
    url: { type: String, trim: true },
    caption: { type: String, trim: true, maxlength: 2500 },
    error: { type: String, trim: true, maxlength: 400 },
    postedBy: {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      name: { type: String, trim: true }
    }
  },
  { timestamps: true }
);

socialPostSchema.index({ job: 1, platform: 1, createdAt: -1 });

export default mongoose.model("SocialPost", socialPostSchema);
