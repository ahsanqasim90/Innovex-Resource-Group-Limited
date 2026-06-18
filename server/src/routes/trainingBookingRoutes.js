import express from "express";
import Course from "../models/Course.js";
import TrainingBooking from "../models/TrainingBooking.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { canViewFinance } from "../config/permissions.js";
import { logActivity } from "../services/activityLogService.js";
import { pick, requireFields, validateEmail } from "../utils.js";
import { sendTrainingEnquiryEmail } from "../services/emailService.js";

const router = express.Router();
const fields = [
  "clientName",
  "contactPersonName",
  "email",
  "phone",
  "address",
  "selectedCourses",
  "trainingDate",
  "trainingStartTime",
  "trainingEndTime",
  "numberOfDelegates",
  "quotedPrice",
  "actualTrainerCost",
  "otherExpenses",
  "paymentStatus",
  "bookingStatus",
  "notes",
  "trainer"
];
const financeFields = ["quotedPrice", "actualTrainerCost", "otherExpenses", "paymentStatus"];

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function numberValue(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

function makeDateRange(from, to) {
  const range = {};
  if (from) {
    const start = new Date(from);
    if (!Number.isNaN(start.getTime())) {
      start.setHours(0, 0, 0, 0);
      range.$gte = start;
    }
  }
  if (to) {
    const end = new Date(to);
    if (!Number.isNaN(end.getTime())) {
      end.setHours(23, 59, 59, 999);
      range.$lte = end;
    }
  }
  return Object.keys(range).length ? range : null;
}

async function normalizeSelectedCourses(selectedCourses = []) {
  const ids = Array.isArray(selectedCourses) ? selectedCourses.filter(Boolean) : [selectedCourses].filter(Boolean);
  if (!ids.length) return [];
  const courses = await Course.find({ _id: { $in: ids } });
  const courseMap = new Map(courses.map((course) => [String(course._id), course]));
  return ids.map((id) => {
    const course = courseMap.get(String(id));
    if (!course) return null;
    return {
      course: course._id,
      title: course.title,
      category: course.category,
      duration: course.duration
    };
  }).filter(Boolean);
}

async function toPayload(body, user) {
  const payload = pick(body, fields);
  if (payload.selectedCourses !== undefined) {
    payload.selectedCourses = await normalizeSelectedCourses(payload.selectedCourses);
  }
  ["trainingDate", "trainingStartTime", "trainingEndTime"].forEach((field) => {
    if (payload[field] === "") delete payload[field];
  });
  ["numberOfDelegates", "quotedPrice", "actualTrainerCost", "otherExpenses"].forEach((field) => {
    if (payload[field] !== undefined) payload[field] = numberValue(payload[field], field === "numberOfDelegates" ? 1 : 0);
  });
  if (payload.trainer) {
    payload.trainer = {
      ...payload.trainer,
      fee: numberValue(payload.trainer.fee, 0)
    };
  }
  if (user && !canViewFinance(user)) {
    financeFields.forEach((field) => delete payload[field]);
    if (payload.trainer) {
      delete payload.trainer.fee;
      delete payload.trainer.paymentStatus;
    }
  }
  return payload;
}

function sanitizeBooking(booking, user) {
  if (canViewFinance(user)) return booking;
  const item = booking?.toObject ? booking.toObject() : { ...booking };
  [...financeFields, "profit"].forEach((field) => delete item[field]);
  if (item.trainer) {
    delete item.trainer.fee;
    delete item.trainer.paymentStatus;
  }
  return item;
}

async function dashboardStats() {
  const now = new Date();
  const inTwoDays = new Date(now);
  inTwoDays.setHours(inTwoDays.getHours() + 48);

  const [totalTrainingBookings, upcomingTrainingSessions, finance, reminders, recentTrainingBookings] = await Promise.all([
    TrainingBooking.countDocuments(),
    TrainingBooking.countDocuments({ trainingDate: { $gte: now }, bookingStatus: { $nin: ["Cancelled", "Completed"] } }),
    TrainingBooking.aggregate([
      {
        $group: {
          _id: null,
          totalQuotedRevenue: { $sum: "$quotedPrice" },
          totalTrainerCosts: { $sum: "$actualTrainerCost" },
          totalProfit: { $sum: "$profit" }
        }
      }
    ]),
    TrainingBooking.find({
      trainingDate: { $gte: now, $lte: inTwoDays },
      bookingStatus: { $nin: ["Cancelled", "Completed"] }
    }).sort({ trainingDate: 1, trainingStartTime: 1 }).limit(8),
    TrainingBooking.find().sort({ trainingDate: -1, trainingStartTime: -1, createdAt: -1 }).limit(6)
  ]);

  return {
    totalTrainingBookings,
    upcomingTrainingSessions,
    totalQuotedRevenue: finance[0]?.totalQuotedRevenue || 0,
    totalTrainerCosts: finance[0]?.totalTrainerCosts || 0,
    totalTrainingProfit: finance[0]?.totalProfit || 0,
    trainingReminders: reminders,
    recentTrainingBookings
  };
}

router.post("/enquiry", async (req, res, next) => {
  try {
    requireFields(req.body, ["clientName", "contactPersonName", "email", "phone", "address", "numberOfDelegates"]);
    validateEmail(req.body.email);
    if (!req.body.selectedCourses?.length) {
      return res.status(400).json({ message: "Please select at least one course" });
    }

    const booking = await TrainingBooking.create(await toPayload({
      ...req.body,
      bookingStatus: "Enquiry",
      paymentStatus: "Pending",
      quotedPrice: 0,
      actualTrainerCost: 0,
      otherExpenses: 0
    }));

    const emailResult = await sendTrainingEnquiryEmail(booking).catch((error) => ({
      sent: false,
      reason: error.message
    }));

    res.status(201).json({
      message: "Training enquiry received. Our team will contact you with course options and a quotation.",
      booking,
      emailSent: emailResult.sent
    });
  } catch (error) {
    next(error);
  }
});

router.use(protect, requirePermission("trainingBookings.view"));

router.get("/stats/dashboard", async (req, res, next) => {
  try {
    const stats = await dashboardStats();
    if (!canViewFinance(req.user)) {
      delete stats.totalQuotedRevenue;
      delete stats.totalTrainerCosts;
      delete stats.totalTrainingProfit;
      stats.trainingReminders = stats.trainingReminders.map((item) => sanitizeBooking(item, req.user));
      stats.recentTrainingBookings = stats.recentTrainingBookings.map((item) => sanitizeBooking(item, req.user));
    }
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

router.get("/reminders/upcoming", async (req, res, next) => {
  try {
    const stats = await dashboardStats();
    res.json(canViewFinance(req.user) ? stats.trainingReminders : stats.trainingReminders.map((item) => sanitizeBooking(item, req.user)));
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    const { search, bookingStatus, paymentStatus, course, dateFrom, dateTo } = req.query;
    if (bookingStatus) filter.bookingStatus = bookingStatus;
    if (paymentStatus) filter.paymentStatus = paymentStatus;
    if (course) filter["selectedCourses.course"] = course;
    const dateRange = makeDateRange(dateFrom, dateTo);
    if (dateRange) filter.trainingDate = dateRange;
    if (search) {
      const regex = new RegExp(escapeRegex(search), "i");
      filter.$or = [
        { clientName: regex },
        { contactPersonName: regex },
        { email: regex },
        { phone: regex },
        { "selectedCourses.title": regex },
        { "trainer.name": regex }
      ];
    }
    const bookings = await TrainingBooking.find(filter).sort({ trainingDate: -1, trainingStartTime: -1, createdAt: -1 });
    res.json(bookings.map((item) => sanitizeBooking(item, req.user)));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const booking = await TrainingBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Training booking not found" });
    res.json(sanitizeBooking(booking, req.user));
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    requireFields(req.body, ["clientName", "contactPersonName", "email", "trainingDate", "trainingStartTime"]);
    validateEmail(req.body.email);
    if (!req.body.selectedCourses?.length) {
      return res.status(400).json({ message: "At least one course is required" });
    }
    const booking = await TrainingBooking.create(await toPayload(req.body, req.user));
    await logActivity(req, {
      module: "Training Bookings",
      action: "Created",
      entityType: "TrainingBooking",
      entityId: booking._id,
      summary: `Created training booking for ${booking.clientName}`,
      metadata: { courses: booking.selectedCourses?.map((course) => course.title), trainingDate: booking.trainingDate }
    });
    res.status(201).json(sanitizeBooking(booking, req.user));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (req.body.email) validateEmail(req.body.email);
    const booking = await TrainingBooking.findById(req.params.id);
    if (!booking) return res.status(404).json({ message: "Training booking not found" });
    const payload = await toPayload(req.body, req.user);
    if (!canViewFinance(req.user) && payload.trainer) {
      payload.trainer = {
        ...payload.trainer,
        fee: booking.trainer?.fee || 0,
        paymentStatus: booking.trainer?.paymentStatus || "Pending"
      };
    }
    Object.assign(booking, payload);
    await booking.save();
    await logActivity(req, {
      module: "Training Bookings",
      action: "Updated",
      entityType: "TrainingBooking",
      entityId: booking._id,
      summary: `Updated training booking for ${booking.clientName}`,
      metadata: { bookingStatus: booking.bookingStatus, courses: booking.selectedCourses?.map((course) => course.title) }
    });
    res.json(sanitizeBooking(booking, req.user));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const booking = await TrainingBooking.findByIdAndDelete(req.params.id);
    if (!booking) return res.status(404).json({ message: "Training booking not found" });
    await logActivity(req, {
      module: "Training Bookings",
      action: "Deleted",
      entityType: "TrainingBooking",
      entityId: booking._id,
      summary: `Deleted training booking for ${booking.clientName}`,
      metadata: { bookingStatus: booking.bookingStatus, trainingDate: booking.trainingDate }
    });
    res.json({ message: "Training booking deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
