import mongoose from "mongoose";

const actorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    role: { type: String, default: "" }
  },
  { _id: false }
);

const moneyField = { type: Number, default: 0, min: 0 };

const salarySlipSchema = new mongoose.Schema(
  {
    slipNumber: { type: String, required: true, unique: true, index: true },
    employeeName: { type: String, required: true, trim: true, index: true },
    employeeEmail: { type: String, required: true, trim: true, lowercase: true, index: true },
    employeePhone: { type: String, trim: true },
    employeeId: { type: String, trim: true },
    jobTitle: { type: String, trim: true },
    department: { type: String, trim: true },
    payPeriodStart: { type: Date, required: true },
    payPeriodEnd: { type: Date, required: true },
    paymentDate: { type: Date, required: true },
    paymentMethod: { type: String, trim: true, default: "Bank transfer" },
    currency: { type: String, trim: true, default: "GBP" },
    exchangeRateLabel: { type: String, trim: true, default: "GBP exchange rate at issue" },
    exchangeRateValue: { type: String, trim: true },
    basicSalary: moneyField,
    overtime: moneyField,
    bonus: moneyField,
    commission: moneyField,
    otherAllowance: moneyField,
    internetCommunicationAllowance: moneyField,
    remoteWorkingAllowance: moneyField,
    tax: moneyField,
    nationalInsurance: moneyField,
    pension: moneyField,
    otherDeduction: moneyField,
    grossPay: moneyField,
    totalDeductions: moneyField,
    netPay: moneyField,
    paymentNotice: {
      type: String,
      trim: true,
      default: "Full payment may take additional time to be received because payment is processed through a broker. Payments may also be received partially before the remaining balance is completed."
    },
    directorName: { type: String, trim: true, default: "Fawad Khan" },
    directorTitle: { type: String, trim: true, default: "Director" },
    attestationText: {
      type: String,
      trim: true,
      default: "This salary slip has been issued by Innovex Resource Group Limited and is attested as a true record of the payment details shown above."
    },
    notes: { type: String, trim: true },
    status: { type: String, enum: ["Draft", "Sent", "Cancelled"], default: "Draft", index: true },
    senderEmail: { type: String, trim: true, lowercase: true },
    cc: [{ type: String, trim: true, lowercase: true }],
    customMessage: { type: String, trim: true },
    sentAt: { type: Date },
    sentFolderSaved: { type: Boolean, default: false },
    sentFolderError: { type: String, trim: true },
    createdBy: actorSchema,
    updatedBy: actorSchema
  },
  { timestamps: true }
);

salarySlipSchema.pre("validate", function calculateSalarySlipTotals(next) {
  const earnings = ["basicSalary", "overtime", "bonus", "commission", "internetCommunicationAllowance", "remoteWorkingAllowance", "otherAllowance"].reduce((sum, field) => sum + Number(this[field] || 0), 0);
  const deductions = ["tax", "otherDeduction"].reduce((sum, field) => sum + Number(this[field] || 0), 0);
  this.grossPay = Number(earnings.toFixed(2));
  this.totalDeductions = Number(deductions.toFixed(2));
  this.netPay = Number(Math.max(earnings - deductions, 0).toFixed(2));
  next();
});

salarySlipSchema.index({ employeeName: "text", employeeEmail: "text", jobTitle: "text", department: "text", slipNumber: "text" });
salarySlipSchema.index({ createdAt: -1 });

export default mongoose.model("SalarySlip", salarySlipSchema);
