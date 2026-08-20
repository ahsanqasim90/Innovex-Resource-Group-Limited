import mongoose from "mongoose";

const actorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    role: { type: String, trim: true }
  },
  { _id: false }
);

const lineItemSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
    title: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, trim: true, maxlength: 500 },
    delegates: { type: Number, default: 1, min: 1, max: 10000 },
    sessions: { type: Number, default: 1, min: 1, max: 1000 },
    unitPrice: { type: Number, required: true, min: 0, max: 10000000 },
    discountPercent: { type: Number, default: 0, min: 0, max: 100 },
    total: { type: Number, default: 0, min: 0 }
  },
  { _id: true }
);

const trainingQuotationSchema = new mongoose.Schema(
  {
    quotationNumber: { type: String, required: true, unique: true, trim: true, index: true },
    status: { type: String, enum: ["Draft", "Sent", "Accepted", "Declined", "Expired"], default: "Draft", index: true },
    issueDate: { type: Date, required: true, default: Date.now, index: true },
    validDays: { type: Number, default: 14, min: 1, max: 365 },
    clientName: { type: String, required: true, trim: true, maxlength: 180 },
    contactName: { type: String, required: true, trim: true, maxlength: 180 },
    contactJobTitle: { type: String, trim: true, maxlength: 220 },
    clientEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    clientPhone: { type: String, trim: true, maxlength: 80 },
    clientAddress: { type: String, trim: true, maxlength: 600 },
    trainingLocations: { type: String, required: true, trim: true, maxlength: 1000 },
    deliverySummary: { type: String, required: true, trim: true, maxlength: 1800 },
    programmeTitle: { type: String, trim: true, maxlength: 160, default: "Training programme" },
    programmeDescription: { type: String, required: true, trim: true, maxlength: 1800 },
    lineItems: { type: [lineItemSchema], default: [] },
    subtotal: { type: Number, default: 0, min: 0 },
    totalDiscount: { type: Number, default: 0, min: 0 },
    total: { type: Number, default: 0, min: 0 },
    inclusions: {
      type: [{ type: String, trim: true, maxlength: 250 }],
      default: ["Qualified trainer", "Training materials", "Certification", "Administrative support", "Trainer travel and expenses"]
    },
    paymentTerms: { type: String, required: true, trim: true, maxlength: 1500 },
    timescaleTerms: { type: String, required: true, trim: true, maxlength: 1500 },
    additionalTerms: { type: String, trim: true, maxlength: 2000 },
    openingMessage: { type: String, required: true, trim: true, maxlength: 2000 },
    closingMessage: { type: String, required: true, trim: true, maxlength: 2000 },
    signatoryName: { type: String, required: true, trim: true, maxlength: 160, default: "Haider Zaman Syed" },
    signatoryTitle: { type: String, required: true, trim: true, maxlength: 160, default: "General Manager" },
    senderEmail: { type: String, trim: true, lowercase: true },
    cc: [{ type: String, trim: true, lowercase: true }],
    customMessage: { type: String, trim: true, maxlength: 3000 },
    sentAt: { type: Date },
    sentFolderSaved: { type: Boolean, default: false },
    sentFolderError: { type: String, trim: true },
    createdBy: actorSchema,
    updatedBy: actorSchema
  },
  { timestamps: true }
);

trainingQuotationSchema.pre("validate", function calculateTotals(next) {
  let subtotal = 0;
  let total = 0;
  this.lineItems.forEach((item) => {
    const sessions = Math.max(1, Number(item.sessions || 1));
    const unitPrice = Math.max(0, Number(item.unitPrice || 0));
    const discountPercent = Math.min(100, Math.max(0, Number(item.discountPercent || 0)));
    const gross = sessions * unitPrice;
    item.total = Math.round(gross * (1 - discountPercent / 100) * 100) / 100;
    subtotal += gross;
    total += item.total;
  });
  this.subtotal = Math.round(subtotal * 100) / 100;
  this.total = Math.round(total * 100) / 100;
  this.totalDiscount = Math.round((this.subtotal - this.total) * 100) / 100;
  next();
});

trainingQuotationSchema.index({ clientName: "text", contactName: "text", clientEmail: "text", quotationNumber: "text" });
trainingQuotationSchema.index({ status: 1, issueDate: -1 });

export default mongoose.model("TrainingQuotation", trainingQuotationSchema);
