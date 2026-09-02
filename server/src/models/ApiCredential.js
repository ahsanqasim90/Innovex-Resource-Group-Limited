import mongoose from "mongoose";

const apiCredentialSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 120 },
  prefix: { type: String, required: true, trim: true },
  keyHash: { type: String, required: true, select: false },
  scopes: [{ type: String, enum: ["jobs:read", "candidates:read", "clients:read"] }],
  status: { type: String, enum: ["Active", "Revoked"], default: "Active", index: true },
  expiresAt: Date,
  lastUsedAt: Date,
  lastUsedIp: { type: String, trim: true, default: "" },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  revokedAt: Date,
  revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

apiCredentialSchema.index({ organization: 1, prefix: 1 }, { unique: true });
apiCredentialSchema.index({ organization: 1, status: 1, createdAt: -1 });
export default mongoose.model("ApiCredential", apiCredentialSchema);
