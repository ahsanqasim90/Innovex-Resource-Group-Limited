import mongoose from "mongoose";

// Remembers when each admin user last opened a section, so the sidebar can show
// a WhatsApp-style count of items that arrived since then.
const adminSectionSeenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    section: { type: String, required: true, trim: true, maxlength: 60 },
    seenAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

adminSectionSeenSchema.index({ user: 1, section: 1 });

export default mongoose.model("AdminSectionSeen", adminSectionSeenSchema);
