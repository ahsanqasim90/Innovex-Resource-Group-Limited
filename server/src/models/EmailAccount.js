import mongoose from "mongoose";
import { decryptSecret, encryptSecret } from "../utils/authSecurity.js";

// Lets each organisation connect its own mailbox (any SMTP/IMAP provider - Gmail,
// Outlook/Microsoft 365, Hostinger, Zoho, GoDaddy, etc.) instead of relying on a
// single set of credentials shared by the whole platform. The stored password is
// encrypted at rest with the same AES-256-GCM helper used for other secrets.
const emailAccountSchema = new mongoose.Schema(
  {
    address: { type: String, required: true, trim: true, lowercase: true },
    label: { type: String, trim: true, default: "" },
    name: { type: String, trim: true, default: "" },
    host: { type: String, required: true, trim: true },
    port: { type: Number, required: true, default: 587 },
    secure: { type: Boolean, default: false },
    user: { type: String, required: true, trim: true },
    passEncrypted: { type: String, required: true, select: false },
    imapHost: { type: String, trim: true, default: "" },
    imapPort: { type: Number, default: 993 },
    imapSecure: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
    verifiedAt: { type: Date, default: null },
    lastError: { type: String, trim: true, default: "" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

emailAccountSchema.index({ organization: 1, address: 1 }, { unique: true });

emailAccountSchema.methods.setPassword = function setPassword(rawPassword) {
  this.passEncrypted = encryptSecret(rawPassword);
};

emailAccountSchema.methods.getPassword = function getPassword() {
  return decryptSecret(this.passEncrypted);
};

// Shapes a stored document into the plain config object the mail-sending code
// (nodemailer / ImapFlow) expects, with the password decrypted in memory only.
emailAccountSchema.methods.toRuntimeAccount = function toRuntimeAccount() {
  return {
    key: this.address,
    address: this.address,
    label: this.label || this.address,
    name: this.name || this.label || this.address,
    host: this.host,
    port: this.port,
    secure: this.secure,
    user: this.user,
    pass: this.getPassword(),
    imapHost: this.imapHost || this.host,
    imapPort: this.imapPort || 993,
    imapSecure: this.imapSecure !== false,
    isDefault: Boolean(this.isDefault),
    source: "organization"
  };
};

export default mongoose.model("EmailAccount", emailAccountSchema);
