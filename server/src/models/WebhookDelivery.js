import mongoose from "mongoose";

const webhookDeliverySchema = new mongoose.Schema({
  endpoint: { type: mongoose.Schema.Types.ObjectId, ref: "WebhookEndpoint", required: true, index: true },
  eventId: { type: String, required: true, trim: true, index: true },
  event: { type: String, required: true, trim: true, index: true },
  payload: { type: mongoose.Schema.Types.Mixed, required: true },
  status: { type: String, enum: ["Pending", "Delivered", "Retrying", "Failed"], default: "Pending", index: true },
  attempts: { type: Number, default: 0 },
  nextAttemptAt: { type: Date, default: Date.now, index: true },
  deliveredAt: Date,
  responseStatus: Number,
  responseExcerpt: { type: String, trim: true, maxlength: 1000, default: "" },
  lastError: { type: String, trim: true, maxlength: 1000, default: "" }
}, { timestamps: true });

webhookDeliverySchema.index({ organization: 1, status: 1, nextAttemptAt: 1 });
webhookDeliverySchema.index({ organization: 1, eventId: 1, endpoint: 1 }, { unique: true });
export default mongoose.model("WebhookDelivery", webhookDeliverySchema);
