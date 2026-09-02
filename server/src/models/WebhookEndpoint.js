import mongoose from "mongoose";

const webhookEndpointSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  url: { type: String, required: true, trim: true, maxlength: 1000 },
  events: [{ type: String, enum: ["candidate.created", "candidate.status_changed", "job.created", "job.approved", "application.created", "compliance.document_expiring"] }],
  secretEncrypted: { type: String, required: true, select: false },
  secretPrefix: { type: String, required: true, trim: true },
  status: { type: String, enum: ["Active", "Paused", "Revoked"], default: "Active", index: true },
  lastDeliveryAt: Date,
  lastSuccessAt: Date,
  failureCount: { type: Number, default: 0 },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

webhookEndpointSchema.index({ organization: 1, status: 1, createdAt: -1 });
export default mongoose.model("WebhookEndpoint", webhookEndpointSchema);
