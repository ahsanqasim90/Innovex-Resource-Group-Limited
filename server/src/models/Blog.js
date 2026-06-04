import mongoose from "mongoose";

const imageSchema = new mongoose.Schema(
  {
    filename: String,
    originalName: String,
    mimetype: String,
    size: Number,
    data: Buffer
  },
  { _id: false }
);

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    category: { type: String, default: "Healthcare Recruitment", trim: true },
    excerpt: { type: String, required: true, trim: true, maxlength: 320 },
    content: { type: String, required: true },
    metaTitle: { type: String, trim: true, maxlength: 70 },
    metaDescription: { type: String, trim: true, maxlength: 170 },
    author: { type: String, default: "Innovex Resource Group Limited", trim: true },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },
    featuredImage: imageSchema
  },
  { timestamps: true }
);

blogSchema.index({ title: "text", excerpt: "text", content: "text", category: "text" });
blogSchema.index({ isPublished: 1, publishedAt: -1 });

export default mongoose.model("Blog", blogSchema);
