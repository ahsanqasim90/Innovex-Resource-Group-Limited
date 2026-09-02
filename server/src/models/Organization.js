import mongoose from "mongoose";

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, lowercase: true, trim: true, unique: true, index: true },
    legalName: { type: String, trim: true, default: "" },
    companyNumber: { type: String, trim: true, default: "" },
    status: { type: String, enum: ["Trial", "Active", "Suspended", "Cancelled"], default: "Active", index: true },
    branding: {
      logoUrl: { type: String, trim: true, default: "" },
      primaryColor: { type: String, trim: true, default: "#006d70" },
      accentColor: { type: String, trim: true, default: "#f5bd3e" }
    },
    locale: {
      timezone: { type: String, trim: true, default: "Europe/London" },
      currency: { type: String, trim: true, uppercase: true, default: "GBP" },
      dateFormat: { type: String, trim: true, default: "DD/MM/YYYY" }
    },
    contact: {
      email: { type: String, trim: true, lowercase: true, default: "" },
      phone: { type: String, trim: true, default: "" },
      address: { type: String, trim: true, default: "" }
    },
    communication: {
      senderEmails: [{ type: String, trim: true, lowercase: true }],
      callerIds: [{ type: String, trim: true }]
    },
    subscription: {
      plan: { type: String, enum: ["Trial", "Starter", "Growth", "Professional", "Enterprise"], default: "Trial" },
      status: { type: String, enum: ["Trial", "Active", "Past Due", "Cancelled"], default: "Trial" },
      trialEndsAt: Date,
      currentPeriodEndsAt: Date,
      seatLimit: { type: Number, min: 1, default: 5 },
      storageLimitMb: { type: Number, min: 100, default: 2048 }
    },
    features: { type: Map, of: Boolean, default: {} },
    onboarding: {
      status: { type: String, enum: ["Not Started", "In Progress", "Complete"], default: "Not Started" },
      completedSteps: [{ type: String, trim: true }],
      completedAt: Date
    },
    dataRetentionDays: { type: Number, min: 30, max: 3650, default: 730 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true, tenantScoped: false }
);

organizationSchema.pre("validate", function normalizeSlug() {
  this.slug = String(this.slug || this.name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
});

export default mongoose.model("Organization", organizationSchema);

