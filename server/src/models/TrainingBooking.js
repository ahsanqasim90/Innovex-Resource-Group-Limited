import mongoose from "mongoose";

const selectedCourseSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
    title: { type: String, required: true, trim: true },
    category: { type: String, trim: true },
    duration: { type: String, trim: true }
  },
  { _id: false }
);

const trainerSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    fee: { type: Number, default: 0, min: 0 },
    paymentStatus: { type: String, enum: ["Pending", "Paid"], default: "Pending" },
    notes: { type: String, trim: true }
  },
  { _id: false }
);

const trainingBookingSchema = new mongoose.Schema(
  {
    clientName: { type: String, required: true, trim: true },
    contactPersonName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true },
    address: { type: String, trim: true },
    selectedCourses: { type: [selectedCourseSchema], default: [] },
    trainingDate: { type: Date },
    trainingStartTime: { type: String, trim: true },
    trainingEndTime: { type: String, trim: true },
    numberOfDelegates: { type: Number, default: 1, min: 1 },
    quotedPrice: { type: Number, default: 0, min: 0 },
    actualTrainerCost: { type: Number, default: 0, min: 0 },
    otherExpenses: { type: Number, default: 0, min: 0 },
    profit: { type: Number, default: 0 },
    paymentStatus: {
      type: String,
      enum: ["Pending", "Deposit Paid", "Fully Paid", "Cancelled"],
      default: "Pending"
    },
    bookingStatus: {
      type: String,
      enum: ["Enquiry", "Quoted", "Confirmed", "Completed", "Cancelled"],
      default: "Enquiry"
    },
    notes: { type: String, trim: true },
    trainer: { type: trainerSchema, default: () => ({}) }
  },
  { timestamps: true }
);

trainingBookingSchema.pre("validate", function calculateProfit(next) {
  const quoted = Number(this.quotedPrice || 0);
  const trainerCost = Number(this.actualTrainerCost || 0);
  const expenses = Number(this.otherExpenses || 0);
  this.profit = quoted - trainerCost - expenses;
  next();
});

trainingBookingSchema.index({ clientName: "text", contactPersonName: "text", email: "text", notes: "text" });
trainingBookingSchema.index({ trainingDate: 1, trainingStartTime: 1, bookingStatus: 1 });
trainingBookingSchema.index({ paymentStatus: 1, bookingStatus: 1 });

export default mongoose.model("TrainingBooking", trainingBookingSchema);
