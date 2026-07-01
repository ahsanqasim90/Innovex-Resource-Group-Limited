import mongoose from "mongoose";

const financeCounterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

export default mongoose.model("FinanceCounter", financeCounterSchema);
