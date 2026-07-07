import mongoose from "mongoose";

const actorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    role: { type: String, trim: true, default: "" }
  },
  { _id: false }
);

const roleRateSchema = new mongoose.Schema(
  {
    roleTitle: { type: String, required: true, trim: true },
    feeType: {
      type: String,
      enum: ["Percentage", "Flat Fee", "Hourly Margin", "Custom"],
      default: "Percentage"
    },
    rateValue: { type: Number, default: 0 },
    rateUnit: { type: String, trim: true, default: "% of annual salary" },
    paymentTrigger: { type: String, trim: true, default: "Payable on candidate start date" },
    notes: { type: String, trim: true, default: "" }
  },
  { _id: true }
);

const clauseSchema = new mongoose.Schema(
  {
    heading: { type: String, required: true, trim: true },
    body: { type: String, required: true, trim: true },
    order: { type: Number, default: 0 }
  },
  { _id: true }
);

const defaultClauses = [
  {
    heading: "Scope of services",
    body:
      "Innovex Resource Group Limited will introduce suitable candidates and/or provide recruitment support to the client in line with the commercial schedule agreed in this document.",
    order: 1
  },
  {
    heading: "Candidate introductions",
    body:
      "An introduction is considered active where Innovex provides a candidate profile, CV, contact details, interview arrangement, or any other candidate information to the client.",
    order: 2
  },
  {
    heading: "Fees and payment",
    body:
      "Fees are payable in accordance with the role rates, payment cycle, invoice due date, and payment trigger stated in the commercial schedule. Late payment may delay future candidate support.",
    order: 3
  },
  {
    heading: "Rebate and replacement terms",
    body:
      "Any rebate or replacement support only applies where the client has paid the relevant invoice within the agreed payment terms and has notified Innovex in writing within the agreed rebate period.",
    order: 4
  },
  {
    heading: "Confidentiality",
    body:
      "Candidate information, rates, commercial terms, and recruitment documentation shared by Innovex are confidential and must not be disclosed to third parties without written permission.",
    order: 5
  },
  {
    heading: "Acceptance",
    body:
      "By signing or confirming acceptance of these terms, the client agrees that the commercial schedule and terms of business apply to introductions and services provided by Innovex Resource Group Limited.",
    order: 6
  }
];

const clientTermsSchema = new mongoose.Schema(
  {
    documentNumber: { type: String, required: true, unique: true, trim: true, index: true },
    title: { type: String, trim: true, default: "Terms of Business" },
    agreementType: {
      type: String,
      enum: ["Recruitment", "Healthcare Staffing", "Training", "Website", "SEO", "Compliance", "Other"],
      default: "Recruitment",
      index: true
    },
    status: {
      type: String,
      enum: ["Draft", "Sent", "Signed", "Expired", "Cancelled"],
      default: "Draft",
      index: true
    },
    clientName: { type: String, required: true, trim: true, index: true },
    contactName: { type: String, trim: true, default: "" },
    clientEmail: { type: String, required: true, trim: true, lowercase: true, index: true },
    clientAddress: { type: String, trim: true, default: "" },
    clientCompanyNumber: { type: String, trim: true, default: "" },
    effectiveDate: { type: Date, default: Date.now },
    validUntil: { type: Date },
    paymentDueDays: { type: Number, default: 14, min: 0 },
    invoiceCycle: { type: String, trim: true, default: "Invoice issued on candidate start date or as agreed." },
    rebatePeriodDays: { type: Number, default: 28, min: 0 },
    rebateTerms: {
      type: String,
      trim: true,
      default:
        "Rebate or replacement support is subject to the invoice being paid within agreed terms and written notice being received within the rebate period."
    },
    roleRates: { type: [roleRateSchema], default: [] },
    clauses: { type: [clauseSchema], default: () => defaultClauses.map((clause) => ({ ...clause })) },
    specialTerms: { type: String, trim: true, default: "" },
    internalNotes: { type: String, trim: true, default: "" },
    senderEmail: { type: String, trim: true, lowercase: true, default: "info@innovexresourcegroup.co.uk" },
    cc: [{ type: String, trim: true, lowercase: true }],
    sentAt: { type: Date },
    sentFolderSaved: { type: Boolean, default: false },
    sentFolderError: { type: String, trim: true, default: "" },
    signedAt: { type: Date },
    signedBy: { type: String, trim: true, default: "" },
    signatureNotes: { type: String, trim: true, default: "" },
    cancelledAt: { type: Date },
    cancellationReason: { type: String, trim: true, default: "" },
    createdBy: actorSchema,
    updatedBy: actorSchema
  },
  { timestamps: true }
);

clientTermsSchema.index({
  clientName: "text",
  clientEmail: "text",
  contactName: "text",
  documentNumber: "text",
  "roleRates.roleTitle": "text"
});

export default mongoose.model("ClientTerms", clientTermsSchema);
