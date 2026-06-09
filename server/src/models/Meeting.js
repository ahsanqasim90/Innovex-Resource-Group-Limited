import mongoose from "mongoose";

const meetingSchema = new mongoose.Schema(
  {
    attendeeName: { type: String, required: true, trim: true },
    attendeeEmail: { type: String, trim: true, lowercase: true },
    attendeePhone: { type: String, trim: true },
    companyName: { type: String, required: true, trim: true },
    meetingTitle: { type: String, required: true, trim: true },
    meetingPurpose: { type: String, required: true, trim: true },
    meetingDate: { type: Date, required: true },
    meetingTime: { type: String, required: true, trim: true },
    meetingType: { type: String, enum: ["Phone", "Teams", "Zoom", "Face-to-face", "Other"], default: "Phone" },
    meetingStatus: { type: String, enum: ["Upcoming", "Completed", "Cancelled"], default: "Upcoming" },
    notes: { type: String, trim: true },
    reminderEmailEnabled: { type: Boolean, default: true },
    lastReminderDate: { type: String, trim: true }
  },
  { timestamps: true }
);

meetingSchema.index({ attendeeName: "text", companyName: "text", meetingTitle: "text", meetingPurpose: "text" });
meetingSchema.index({ meetingDate: 1, meetingTime: 1, meetingStatus: 1 });
meetingSchema.index({ attendeeName: 1, meetingDate: 1, meetingTime: 1 });

export default mongoose.model("Meeting", meetingSchema);
