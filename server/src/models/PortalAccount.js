import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const portalAccountSchema = new mongoose.Schema({
  type: { type: String, enum: ["Candidate", "Client"], required: true, index: true },
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true, lowercase: true, index: true },
  password: { type: String, select: false, default: "" },
  candidate: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate" },
  clientAccount: { type: mongoose.Schema.Types.ObjectId, ref: "ClientAccount" },
  status: { type: String, enum: ["Invited", "Active", "Suspended"], default: "Invited", index: true },
  invitationTokenHash: { type: String, select: false },
  invitationExpiresAt: Date,
  activatedAt: Date,
  lastLoginAt: Date,
  sessionVersion: { type: Number, default: 1 },
  invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });

portalAccountSchema.index({ organization: 1, type: 1, email: 1 }, { unique: true });
portalAccountSchema.pre("save", async function hashPassword() { if (this.isModified("password") && this.password && !this.password.startsWith("$2")) this.password = await bcrypt.hash(this.password, 12); });
portalAccountSchema.methods.matchPassword = function matchPassword(value) { return bcrypt.compare(value, this.password); };
export default mongoose.model("PortalAccount", portalAccountSchema);
