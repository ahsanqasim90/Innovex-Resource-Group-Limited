import mongoose from "mongoose";
import { financialYearFor } from "../utils/financialYear.js";

const expenseSchema = new mongoose.Schema({
  expenseNumber: { type: String, required: true, unique: true, trim: true, index: true },
  expenseDate: { type: Date, required: true, default: Date.now },
  financialYear: { type: String, required: true, index: true, default: () => financialYearFor() },
  supplier: { type: String, required: true, trim: true },
  category: {
    type: String,
    enum: ["Advertising & Marketing", "Bank Charges", "Insurance", "Office & Equipment", "Payroll & Contractors", "Professional Fees", "Recruitment", "Software & Subscriptions", "Telecoms", "Training", "Travel & Mileage", "Website & Hosting", "Other"],
    default: "Other",
    index: true
  },
  description: { type: String, required: true, trim: true },
  reference: { type: String, trim: true },
  netAmount: { type: Number, min: 0, default: 0 },
  vatRate: { type: Number, min: 0, max: 100, default: 0 },
  vatAmount: { type: Number, min: 0, default: 0 },
  totalAmount: { type: Number, min: 0, default: 0 },
  paymentStatus: { type: String, enum: ["Unpaid", "Paid", "Reimbursable", "Reimbursed"], default: "Paid", index: true },
  paymentMethod: { type: String, enum: ["Bank Transfer", "Business Card", "Cash", "Direct Debit", "Personal Card", "Other"], default: "Business Card" },
  notes: { type: String, trim: true },
  receipt: {
    originalName: String,
    mimetype: String,
    size: Number,
    hasFile: { type: Boolean, default: false },
    data: Buffer
  },
  createdBy: { user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, name: String, email: String },
  updatedBy: { user: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, name: String, email: String }
}, { timestamps: true });

expenseSchema.pre("validate", function calculateExpense(next) {
  this.financialYear = financialYearFor(this.expenseDate);
  this.vatAmount = Math.round((Number(this.netAmount || 0) * Number(this.vatRate || 0) / 100) * 100) / 100;
  this.totalAmount = Math.round((Number(this.netAmount || 0) + this.vatAmount) * 100) / 100;
  next();
});

expenseSchema.index({ supplier: "text", description: "text", reference: "text" });
expenseSchema.index({ expenseDate: -1, category: 1 });

export default mongoose.model("Expense", expenseSchema);
