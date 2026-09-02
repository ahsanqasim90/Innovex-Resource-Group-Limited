import mongoose from "mongoose";

const backupDrillSchema = new mongoose.Schema(
  {
    status: { type: String, enum: ["Running", "Passed", "Failed"], default: "Running", index: true },
    startedAt: { type: Date, default: Date.now },
    completedAt: Date,
    durationMs: Number,
    collectionsChecked: { type: Number, default: 0 },
    recordsSampled: { type: Number, default: 0 },
    databasePingMs: Number,
    notes: { type: String, trim: true, default: "" },
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    initiatedByName: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

export default mongoose.model("BackupDrill", backupDrillSchema);

