import mongoose from "mongoose";

const organizationInvitationSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, trim: true, lowercase: true, index: true },
    name: { type: String, trim: true, default: "" },
    role: {
      type: String,
      enum: ["admin", "recruitment", "sales", "training", "marketing", "sales_manager", "external_agent", "viewer"],
      default: "viewer"
    },
    permissions: [{ type: String, trim: true }],
    tokenHash: { type: String, required: true, unique: true, index: true },
    status: { type: String, enum: ["Pending", "Accepted", "Expired", "Cancelled"], default: "Pending", index: true },
    expiresAt: { type: Date, required: true, index: true },
    acceptedAt: Date,
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    invitedByName: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

organizationInvitationSchema.index({ organization: 1, email: 1, status: 1 });

export default mongoose.model("OrganizationInvitation", organizationInvitationSchema);

