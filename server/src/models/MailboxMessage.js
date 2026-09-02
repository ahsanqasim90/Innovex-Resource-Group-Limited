import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    address: { type: String, trim: true, lowercase: true, default: "" }
  },
  { _id: false }
);

const mailboxMessageSchema = new mongoose.Schema(
  {
    mailbox: { type: String, required: true, trim: true, lowercase: true, index: true },
    mailboxUid: { type: String, required: true, index: true },
    uid: { type: Number, required: true },
    messageId: { type: String, trim: true, default: "" },
    threadKey: { type: String, trim: true, index: true },
    folder: { type: String, trim: true, default: "INBOX" },
    direction: { type: String, enum: ["Inbound", "Outbound"], default: "Inbound", index: true },
    from: addressSchema,
    to: [addressSchema],
    cc: [addressSchema],
    replyTo: [addressSchema],
    subject: { type: String, trim: true, default: "(No subject)" },
    text: { type: String, maxlength: 100000, default: "" },
    snippet: { type: String, maxlength: 500, default: "" },
    attachmentCount: { type: Number, default: 0 },
    attachmentNames: [{ type: String, trim: true }],
    receivedAt: { type: Date, index: true },
    isRead: { type: Boolean, default: false, index: true },
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: "Candidate", index: true },
    candidateName: { type: String, trim: true, default: "" },
    syncedAt: { type: Date, default: Date.now },
    retentionReviewAt: Date
  },
  { timestamps: true }
);

mailboxMessageSchema.index({ mailbox: 1, receivedAt: -1 });
mailboxMessageSchema.index({ candidate: 1, receivedAt: -1 });
mailboxMessageSchema.index({ subject: "text", text: "text", "from.address": "text", candidateName: "text" });
mailboxMessageSchema.index({ organization: 1, mailbox: 1, mailboxUid: 1 }, { unique: true });

export default mongoose.model("MailboxMessage", mailboxMessageSchema);
