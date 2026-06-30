import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 8 },
    role: {
      type: String,
      enum: ["super_admin", "admin", "recruitment", "sales", "training", "marketing", "sales_manager", "external_agent", "viewer"],
      default: "viewer"
    },
    permissions: [{ type: String, trim: true }],
    outboundCallerIds: [{ type: String, trim: true }],
    assignedSenderEmails: [{ type: String, trim: true, lowercase: true }],
    canCopyData: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.matchPassword = function matchPassword(password) {
  return bcrypt.compare(password, this.password);
};

export default mongoose.model("User", userSchema);
