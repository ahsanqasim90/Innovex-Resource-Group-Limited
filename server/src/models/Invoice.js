import mongoose from "mongoose";
import { financialYearFor } from "../utils/financialYear.js";

const actorSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  name: { type: String, default: "" },
  email: { type: String, default: "" }
}, { _id: false });

const lineItemSchema = new mongoose.Schema({
  description: { type: String, required: true, trim: true },
  details: { type: String, trim: true },
  client: { type: String, trim: true },
  candidate: { type: String, trim: true },
  hourlyRate: { type: Number, min: 0, default: 0 },
  hoursPerWeek: { type: Number, min: 0, default: 0 },
  weeksPerYear: { type: Number, min: 0, default: 52 },
  annualGrossSalary: { type: Number, min: 0, default: 0 },
  serviceFeePercent: { type: Number, min: 0, max: 100, default: 0 },
  quantity: { type: Number, min: 0, default: 1 },
  unitPrice: { type: Number, min: 0, default: 0 },
  netAmount: { type: Number, min: 0, default: 0 }
}, { _id: true });

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: { type: String, required: true, unique: true, trim: true, index: true },
  invoiceType: { type: String, enum: ["Recruitment", "Training", "Website", "SEO", "Compliance", "Other"], default: "Recruitment" },
  issueDate: { type: Date, required: true, default: Date.now },
  dueDate: { type: Date, required: true },
  financialYear: { type: String, required: true, index: true, default: () => financialYearFor() },
  status: { type: String, enum: ["Draft", "Sent", "Partially Paid", "Paid", "Overdue", "Cancelled"], default: "Draft", index: true },
  clientName: { type: String, required: true, trim: true },
  contactName: { type: String, trim: true },
  billingEmail: { type: String, required: true, trim: true, lowercase: true },
  billingAddress: { type: String, required: true, trim: true },
  salesPerson: { type: String, trim: true },
  orderNumber: { type: String, trim: true },
  currency: { type: String, default: "GBP", trim: true },
  lineItems: { type: [lineItemSchema], default: [] },
  subtotal: { type: Number, min: 0, default: 0 },
  vatRate: { type: Number, min: 0, max: 100, default: 0 },
  vatAmount: { type: Number, min: 0, default: 0 },
  total: { type: Number, min: 0, default: 0 },
  amountPaid: { type: Number, min: 0, default: 0 },
  balanceDue: { type: Number, min: 0, default: 0 },
  notes: { type: String, trim: true },
  paymentTerms: { type: String, trim: true, default: "Payment is due by the due date shown on this invoice." },
  bankDetails: {
    accountTitle: { type: String, default: () => process.env.FINANCE_BANK_ACCOUNT_TITLE || "Innovex Resource Group Limited" },
    bankName: { type: String, default: () => process.env.FINANCE_BANK_NAME || "" },
    sortCode: { type: String, default: () => process.env.FINANCE_BANK_SORT_CODE || "" },
    accountNumber: { type: String, default: () => process.env.FINANCE_BANK_ACCOUNT_NUMBER || "" },
    bic: { type: String, default: () => process.env.FINANCE_BANK_BIC || "" }
  },
  senderEmail: { type: String, trim: true, lowercase: true, default: "info@innovexresourcegroup.co.uk" },
  reminderEnabled: { type: Boolean, default: true },
  reminderFrequencyDays: { type: Number, min: 1, max: 90, default: 7 },
  nextReminderAt: { type: Date },
  lastReminderAt: { type: Date },
  reminderCount: { type: Number, min: 0, default: 0 },
  sentAt: { type: Date },
  paidAt: { type: Date },
  createdBy: actorSchema,
  updatedBy: actorSchema
}, { timestamps: true });

invoiceSchema.pre("validate", function calculateTotals(next) {
  this.financialYear = financialYearFor(this.issueDate);
  this.lineItems = (this.lineItems || []).map((item) => {
    const hourlyRate = Number(item.hourlyRate || 0);
    const hours = Number(item.hoursPerWeek || 0);
    const weeks = Number(item.weeksPerYear || 52);
    const annual = hourlyRate && hours ? hourlyRate * hours * weeks : Number(item.annualGrossSalary || 0);
    const fee = Number(item.serviceFeePercent || 0);
    const amount = fee > 0 && annual > 0 ? annual * fee / 100 : Number(item.quantity || 1) * Number(item.unitPrice || 0);
    item.annualGrossSalary = Math.round(annual * 100) / 100;
    item.netAmount = Math.round(amount * 100) / 100;
    return item;
  });
  this.subtotal = Math.round(this.lineItems.reduce((sum, item) => sum + Number(item.netAmount || 0), 0) * 100) / 100;
  this.vatAmount = Math.round((this.subtotal * Number(this.vatRate || 0) / 100) * 100) / 100;
  this.total = Math.round((this.subtotal + this.vatAmount) * 100) / 100;
  this.balanceDue = Math.max(0, Math.round((this.total - Number(this.amountPaid || 0)) * 100) / 100);
  if (this.status !== "Cancelled") {
    if (this.balanceDue <= 0 && this.total > 0) {
      this.status = "Paid";
      this.paidAt ||= new Date();
    } else if (Number(this.amountPaid || 0) > 0) {
      this.status = "Partially Paid";
    }
  }
  next();
});

invoiceSchema.index({ clientName: "text", billingEmail: "text", invoiceNumber: "text", orderNumber: "text" });
invoiceSchema.index({ dueDate: 1, status: 1, reminderEnabled: 1 });
invoiceSchema.index({ issueDate: -1, financialYear: 1 });

export default mongoose.model("Invoice", invoiceSchema);
