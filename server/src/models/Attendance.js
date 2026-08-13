import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    employeeName: { type: String, required: true, trim: true },
    employeeEmail: { type: String, required: true, trim: true, lowercase: true },
    attendanceDate: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/, index: true },
    status: { type: String, enum: ["Present"], default: "Present" },
    workLocation: { type: String, enum: ["Office", "Remote", "Field"], default: "Office" },
    checkInAt: { type: Date, required: true },
    checkOutAt: { type: Date, default: null },
    cvsDownloaded: { type: Number, min: 0, max: 10000, default: 0 },
    cvsSubmitted: { type: Number, min: 0, max: 10000, default: 0 },
    notes: { type: String, trim: true, maxlength: 1000, default: "" }
  },
  { timestamps: true }
);

attendanceSchema.index({ user: 1, attendanceDate: 1 }, { unique: true });
attendanceSchema.index({ attendanceDate: -1, employeeName: 1 });

export default mongoose.model("Attendance", attendanceSchema);
