import mongoose from "mongoose";

const clientContactSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    jobTitle: { type: String, trim: true, default: "" },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    primary: { type: Boolean, default: false },
    decisionMaker: { type: Boolean, default: false },
    consentToContact: { type: Boolean, default: true },
    notes: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

const clientAccountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, index: true },
    normalizedName: { type: String, required: true, trim: true, index: true },
    tradingName: { type: String, trim: true, default: "" },
    accountType: { type: String, enum: ["Prospect", "Client", "Partner", "Supplier", "Former Client"], default: "Prospect", index: true },
    status: { type: String, enum: ["New", "Qualified", "Active", "At Risk", "Dormant", "Closed"], default: "New", index: true },
    industry: { type: String, trim: true, default: "" },
    companyNumber: { type: String, trim: true, uppercase: true, default: "", index: true },
    vatNumber: { type: String, trim: true, uppercase: true, default: "" },
    website: { type: String, trim: true, lowercase: true, default: "" },
    websiteDomain: { type: String, trim: true, lowercase: true, default: "", index: true },
    email: { type: String, trim: true, lowercase: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    address: {
      line1: { type: String, trim: true, default: "" },
      line2: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
      county: { type: String, trim: true, default: "" },
      postcode: { type: String, trim: true, uppercase: true, default: "" },
      country: { type: String, trim: true, default: "United Kingdom" }
    },
    contacts: { type: [clientContactSchema], default: [] },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
    tags: [{ type: String, trim: true }],
    source: { type: String, trim: true, default: "CRM" },
    notes: { type: String, trim: true, default: "" },
    potentialDuplicateOf: [{ type: mongoose.Schema.Types.ObjectId, ref: "ClientAccount" }],
    mergedInto: { type: mongoose.Schema.Types.ObjectId, ref: "ClientAccount" },
    lastActivityAt: { type: Date, default: Date.now, index: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

function normaliseName(value = "") {
  return String(value).toLowerCase().replace(/\b(limited|ltd|plc|llp|inc|company|co)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();
}

function domainFromWebsite(value = "") {
  try {
    return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

clientAccountSchema.pre("validate", function normalizeAccount() {
  this.normalizedName = normaliseName(this.name);
  this.websiteDomain = domainFromWebsite(this.website);
  if (this.address?.postcode) this.address.postcode = this.address.postcode.toUpperCase().replace(/\s+/g, " ").trim();
  if (this.contacts?.length && !this.contacts.some((contact) => contact.primary)) this.contacts[0].primary = true;
});

clientAccountSchema.index({ name: "text", tradingName: "text", industry: "text", email: "text", phone: "text", "contacts.name": "text", "contacts.email": "text" });
clientAccountSchema.index({ organization: 1, normalizedName: 1, status: 1 });
clientAccountSchema.index({ organization: 1, websiteDomain: 1 });

export { normaliseName, domainFromWebsite };
export default mongoose.model("ClientAccount", clientAccountSchema);

