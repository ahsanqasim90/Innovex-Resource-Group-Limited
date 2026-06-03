import mongoose from "mongoose";

const partnerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    serviceProvided: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    logo: {
      filename: String,
      originalName: String,
      mimetype: String,
      size: Number,
      url: String
    },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.model("Partner", partnerSchema);
