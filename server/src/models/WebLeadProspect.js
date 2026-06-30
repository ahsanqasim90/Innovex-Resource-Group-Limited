import mongoose from "mongoose";

const actorSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  name: { type: String, default: "System" },
  role: { type: String, default: "" }
}, { _id: false });

const timelineSchema = new mongoose.Schema({
  type: { type: String, required: true },
  details: { type: String, required: true, trim: true },
  actor: actorSchema,
  private: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

const interactionSchema = new mongoose.Schema({
  interactionAt: { type: Date, required: true },
  contactMethod: { type: String, enum: ["Telephone", "Email", "WhatsApp", "Other"], required: true },
  personSpokenTo: { type: String, trim: true },
  prospectResponse: { type: String, trim: true },
  servicesDiscussed: [{ type: String, trim: true }],
  interestLevel: { type: String, enum: ["Low", "Medium", "High", "Qualified"], default: "Medium" },
  followUpRequired: { type: Boolean, default: false },
  followUpAt: Date,
  notes: { type: String, trim: true },
  createdBy: actorSchema
}, { timestamps: true });

const followUpSchema = new mongoose.Schema({
  dueAt: { type: Date, required: true },
  contactMethod: { type: String, enum: ["Telephone", "Email", "WhatsApp", "Other"], default: "Telephone" },
  priority: { type: String, enum: ["Low", "Normal", "High", "Urgent"], default: "Normal" },
  notes: { type: String, trim: true },
  completed: { type: Boolean, default: false },
  completedAt: Date,
  createdBy: actorSchema
}, { timestamps: true });

const emailSchema = new mongoose.Schema({
  sender: { type: String, trim: true, lowercase: true },
  recipient: { type: String, trim: true, lowercase: true },
  cc: [{ type: String, trim: true, lowercase: true }],
  subject: { type: String, trim: true },
  content: { type: String },
  template: { type: mongoose.Schema.Types.ObjectId, ref: "WebLeadTemplate" },
  status: { type: String, enum: ["Draft", "Sent", "Failed"], default: "Draft" },
  deliveryMessage: { type: String, default: "" },
  sentAt: Date,
  createdBy: actorSchema
}, { timestamps: true });

const meetingSchema = new mongoose.Schema({
  preferredAt: { type: Date, required: true },
  meetingType: { type: String, enum: ["Telephone", "Google Meet", "Microsoft Teams", "In person"], required: true },
  prospectEmail: { type: String, trim: true, lowercase: true },
  prospectPhone: { type: String, trim: true },
  notes: { type: String, trim: true },
  status: { type: String, enum: ["Requested", "Approved", "Rejected", "Confirmed"], default: "Requested" },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  createdBy: actorSchema
}, { timestamps: true });

const qualificationSchema = new mongoose.Schema({
  decisionMakerName: { type: String, trim: true },
  decisionMakerRole: { type: String, trim: true },
  directPhone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true },
  websiteUrl: { type: String, trim: true },
  mainBusinessProblem: { type: String, trim: true },
  requiredServices: [{ type: String, trim: true }],
  websiteCondition: { type: String, trim: true },
  budgetIndication: { type: String, trim: true },
  expectedTimeline: { type: String, trim: true },
  preferredMeetingAt: Date,
  preferredContactMethod: { type: String, trim: true },
  detailedNotes: { type: String, trim: true },
  locked: { type: Boolean, default: false },
  submittedAt: Date
}, { _id: false });

const webLeadProspectSchema = new mongoose.Schema({
  businessName: { type: String, required: true, trim: true, index: true },
  businessCategory: { type: String, required: true, trim: true, index: true },
  contactPerson: { type: String, required: true, trim: true },
  contactJobTitle: { type: String, trim: true },
  telephone: { type: String, required: true, trim: true, index: true },
  secondaryPhone: { type: String, trim: true },
  email: { type: String, trim: true, lowercase: true, index: true },
  secondaryEmail: { type: String, trim: true, lowercase: true },
  websiteUrl: { type: String, trim: true, lowercase: true, index: true },
  townCity: { type: String, trim: true },
  postcode: { type: String, required: true, trim: true, uppercase: true, index: true },
  fullAddress: { type: String, trim: true },
  region: { type: String, trim: true },
  decisionMakerName: { type: String, trim: true },
  decisionMakerPosition: { type: String, trim: true },
  existingSupplier: { type: String, trim: true },
  websiteCondition: { type: String, trim: true },
  budgetIndication: { type: String, trim: true },
  expectedTimeline: { type: String, trim: true },
  preferredContactMethod: { type: String, trim: true },
  initialResponse: { type: String, required: true, trim: true },
  status: { type: String, required: true, default: "New Prospect", index: true },
  interestedServices: [{ type: String, trim: true }],
  notes: { type: String, trim: true },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: "User", index: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  createdByName: { type: String, required: true },
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  lastUpdatedByName: { type: String, default: "" },
  interactions: [interactionSchema],
  followUps: [followUpSchema],
  emails: [emailSchema],
  meetingRequests: [meetingSchema],
  qualification: qualificationSchema,
  internalNotes: [{ note: String, actor: actorSchema, createdAt: { type: Date, default: Date.now } }],
  timeline: [timelineSchema]
}, { timestamps: true });

webLeadProspectSchema.index({ createdBy: 1, status: 1, updatedAt: -1 });
webLeadProspectSchema.index({ businessCategory: 1, status: 1, createdAt: -1 });
webLeadProspectSchema.index({ businessName: "text", contactPerson: "text", email: "text", telephone: "text", websiteUrl: "text", postcode: "text" });

export default mongoose.model("WebLeadProspect", webLeadProspectSchema);
