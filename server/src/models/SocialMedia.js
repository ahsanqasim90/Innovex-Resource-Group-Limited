import mongoose from "mongoose";

// Branded job images created in the admin panel. Instagram and Facebook fetch them from a public URL.
const socialMediaSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, index: true },
    job: { type: mongoose.Schema.Types.ObjectId, ref: "Job", index: true },
    contentType: { type: String, default: "image/jpeg" },
    size: Number,
    data: { type: Buffer, required: true, select: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

export default mongoose.model("SocialMedia", socialMediaSchema);
