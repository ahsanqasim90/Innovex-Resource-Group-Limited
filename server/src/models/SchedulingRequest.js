import mongoose from "mongoose";

const slotSchema = new mongoose.Schema({
  startsAt: { type: Date, required: true },
  status: { type: String, enum: ["Available", "Booked", "Unavailable"], default: "Available" }
}, { _id: true });

const schedulingRequestSchema = new mongoose.Schema({
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", index: true },
  candidateName: { type: String, required: true, trim: true },
  candidateEmail: { type: String, required: true, trim: true, lowercase: true, index: true },
  candidatePhone: { type: String, required: true, trim: true },
  jobTitle: { type: String, required: true, trim: true },
  clientName: { type: String, required: true, trim: true },
  interviewType: { type: String, enum: ["Phone", "Teams", "Zoom", "Face-to-face"], default: "Teams" },
  location: { type: String, trim: true, default: "" },
  instructions: { type: String, trim: true, maxlength: 2000, default: "" },
  timezone: { type: String, trim: true, default: "Europe/London" },
  slots: { type: [slotSchema], validate: [(value) => value.length >= 1 && value.length <= 12, "Provide between one and twelve slots"] },
  status: { type: String, enum: ["Sent", "Booked", "Expired", "Cancelled"], default: "Sent", index: true },
  expiresAt: { type: Date, required: true, index: true },
  selectedSlot: mongoose.Schema.Types.ObjectId,
  interview: { type: mongoose.Schema.Types.ObjectId, ref: "Interview" },
  sentAt: { type: Date, default: Date.now },
  bookedAt: Date,
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true, optimisticConcurrency: true });

schedulingRequestSchema.index({ organization: 1, candidateEmail: 1, status: 1, expiresAt: 1 });
export default mongoose.model("SchedulingRequest", schedulingRequestSchema);
