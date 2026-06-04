import mongoose from "mongoose";

const selectionStatuses = ["Pending", "Yes", "No"];
const placementTypes = ["Flat Fee", "Percentage of Annual Salary"];

const interviewSchema = new mongoose.Schema(
  {
    candidateName: { type: String, required: true, trim: true },
    candidateEmail: { type: String, required: true, lowercase: true, trim: true },
    candidatePhone: { type: String, required: true, trim: true },
    candidatePostcode: { type: String, trim: true },
    visaStatus: { type: String, trim: true },
    jobTitle: { type: String, required: true, trim: true },
    clientName: { type: String, required: true, trim: true },
    interviewDate: { type: Date, required: true },
    interviewTime: { type: String, required: true, trim: true },
    interviewType: { type: String, enum: ["Phone", "Teams", "Zoom", "Face-to-face"], default: "Phone" },
    interviewStatus: { type: String, enum: ["Pending", "Completed", "Cancelled"], default: "Pending" },
    notes: { type: String, trim: true },
    reminderEmailEnabled: { type: Boolean, default: true },
    lastReminderDate: { type: String, trim: true },
    candidateSelected: { type: String, enum: selectionStatuses, default: "Pending" },
    feedback: { type: String, trim: true },
    selectedPayRate: { type: Number, min: 0, default: 0 },
    hoursPerWeek: { type: Number, min: 0, default: 0 },
    shiftType: { type: String, trim: true },
    placementDate: Date,
    placementType: { type: String, enum: placementTypes, default: "Flat Fee" },
    flatFeeAmount: { type: Number, min: 0, default: 0 },
    percentage: { type: Number, min: 0, max: 100, default: 0 },
    annualSalary: { type: Number, min: 0, default: 0 },
    revenue: { type: Number, min: 0, default: 0 }
  },
  { timestamps: true }
);

interviewSchema.index({ candidateName: "text", clientName: "text", jobTitle: "text" });
interviewSchema.index({ interviewDate: 1, interviewStatus: 1 });
interviewSchema.index({ candidateSelected: 1 });

interviewSchema.pre("validate", function calculateRevenue(next) {
  if (this.candidateSelected !== "Yes") {
    this.annualSalary = 0;
    this.revenue = 0;
    return next();
  }

  if (this.placementType === "Percentage of Annual Salary") {
    const annualSalary = Number(this.selectedPayRate || 0) * Number(this.hoursPerWeek || 0) * 52;
    this.annualSalary = Math.round(annualSalary * 100) / 100;
    this.revenue = Math.round((annualSalary * Number(this.percentage || 0)) / 100 * 100) / 100;
    return next();
  }

  this.annualSalary = 0;
  this.revenue = Math.round(Number(this.flatFeeAmount || 0) * 100) / 100;
  next();
});

export default mongoose.model("Interview", interviewSchema);
