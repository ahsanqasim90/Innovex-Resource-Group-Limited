import mongoose from "mongoose";

const businessLeadEmailSchema = new mongoose.Schema(
  {
    email: { type: String, trim: true, lowercase: true },
    label: { type: String, trim: true },
    primary: { type: Boolean, default: false }
  },
  { _id: false }
);

const businessLeadOutreachSchema = new mongoose.Schema(
  {
    service: { type: String, trim: true },
    subject: { type: String, trim: true },
    message: { type: String, trim: true },
    sentTo: [{ type: String, trim: true, lowercase: true }],
    status: {
      type: String,
      enum: ["Emailed", "Follow-up", "Interested", "Converted", "Not Interested"],
      default: "Emailed"
    },
    sentAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const businessLeadSchema = new mongoose.Schema(
  {
    companyName: { type: String, required: true, trim: true },
    companyKey: { type: String, trim: true, index: true },
    category: {
      type: String,
      enum: [
        "Care Home",
        "Children Home",
        "Supported Living",
        "Healthcare Company",
        "Website Lead",
        "SEO Lead",
        "Training Lead",
        "Compliance Lead",
        "Other"
      ],
      default: "Care Home",
      index: true
    },
    contactName: { type: String, trim: true },
    emails: [businessLeadEmailSchema],
    phone: { type: String, trim: true },
    postcode: { type: String, trim: true, uppercase: true, index: true },
    postcodePrefix: { type: String, trim: true, uppercase: true, index: true },
    city: { type: String, trim: true },
    website: { type: String, trim: true },
    serviceInterests: [{ type: String, trim: true }],
    status: {
      type: String,
      enum: ["New", "Contacted", "Interested", "Follow-up", "Converted", "Not Interested", "Do Not Contact"],
      default: "New",
      index: true
    },
    source: { type: String, trim: true, default: "Business Leads" },
    notes: { type: String, trim: true },
    lastContactedAt: Date,
    outreachHistory: [businessLeadOutreachSchema]
  },
  { timestamps: true }
);

businessLeadSchema.index({
  companyName: "text",
  contactName: "text",
  phone: "text",
  postcode: "text",
  city: "text",
  website: "text",
  serviceInterests: "text",
  notes: "text"
});
businessLeadSchema.index({ category: 1, status: 1, postcodePrefix: 1 });
businessLeadSchema.index({ companyKey: 1, postcodePrefix: 1 });

businessLeadSchema.pre("save", function normalizeBusinessLead(next) {
  if (this.companyName) {
    this.companyKey = this.companyName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  if (this.postcode) {
    this.postcode = this.postcode.toUpperCase().replace(/\s+/g, " ").trim();
    this.postcodePrefix = this.postcode.replace(/\s+/g, "").slice(0, 4);
  }
  next();
});

export default mongoose.model("BusinessLead", businessLeadSchema);
