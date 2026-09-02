import express from "express";
import mongoose from "mongoose";
import Attendance from "../models/Attendance.js";
import User from "../models/User.js";
import { hasPermission } from "../config/permissions.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { logActivity } from "../services/activityLogService.js";
import { generateAttendanceReportPdf } from "../services/attendancePdfService.js";

const router = express.Router();
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const REPORT_LIMIT_DAYS = 366;

router.use(protect, requirePermission("attendance.view"));

function londonDate(value = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(value);
}

function integerCount(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0 || number > 10000) {
    const error = new Error(`${label} must be a whole number between 0 and 10,000`);
    error.statusCode = 400;
    throw error;
  }
  return number;
}

function reportDate(value, fallback) {
  const result = String(value || fallback);
  const parsed = new Date(`${result}T00:00:00Z`);
  if (!DATE_PATTERN.test(result) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result) {
    const error = new Error("Use a valid report date in YYYY-MM-DD format");
    error.statusCode = 400;
    throw error;
  }
  return result;
}

function daysBetween(from, to) {
  return Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000);
}

function cleanLocation(value) {
  const location = String(value || "Office");
  if (!["Office", "Remote", "Field"].includes(location)) {
    const error = new Error("Choose Office, Remote or Field as the work location");
    error.statusCode = 400;
    throw error;
  }
  return location;
}

function reportError(message) {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
}

async function attendanceReport(req) {
  const today = londonDate();
  const defaultFrom = new Date();
  defaultFrom.setDate(defaultFrom.getDate() - 29);
  const from = reportDate(req.query.from, londonDate(defaultFrom));
  const to = reportDate(req.query.to, today);
  if (from > to) throw reportError("The from date must be before the to date");
  if (daysBetween(from, to) > REPORT_LIMIT_DAYS) throw reportError("Reports can cover a maximum of 366 days");

  const query = { attendanceDate: { $gte: from, $lte: to } };
  if (req.query.userId) {
    if (!mongoose.isValidObjectId(req.query.userId)) throw reportError("Invalid employee filter");
    query.user = req.query.userId;
  }

  const [records, activeEmployees, markedTodayIds] = await Promise.all([
    Attendance.find(query).sort({ attendanceDate: -1, checkInAt: -1 }).lean(),
    User.find({ isActive: true }).select("name email role").sort({ name: 1 }).lean(),
    Attendance.distinct("user", { attendanceDate: today })
  ]);

  const summaries = new Map();
  records.forEach((record) => {
    const id = String(record.user);
    const current = summaries.get(id) || {
      userId: id,
      employeeName: record.employeeName,
      employeeEmail: record.employeeEmail,
      daysPresent: 0,
      cvsDownloaded: 0,
      cvsSubmitted: 0,
      totalMinutes: 0
    };
    current.daysPresent += 1;
    current.cvsDownloaded += Number(record.cvsDownloaded || 0);
    current.cvsSubmitted += Number(record.cvsSubmitted || 0);
    if (record.checkInAt && record.checkOutAt) {
      current.totalMinutes += Math.max(0, Math.round((new Date(record.checkOutAt) - new Date(record.checkInAt)) / 60000));
    }
    summaries.set(id, current);
  });

  const scopedEmployees = req.query.userId
    ? activeEmployees.filter((employee) => String(employee._id) === String(req.query.userId))
    : activeEmployees;
  const activeEmployeeIds = new Set(scopedEmployees.map((employee) => String(employee._id)));
  const markedToday = new Set(markedTodayIds.map(String).filter((id) => activeEmployeeIds.has(id)));
  return {
    filters: { from, to, userId: req.query.userId || "" },
    records,
    summaries: Array.from(summaries.values()).sort((a, b) => a.employeeName.localeCompare(b.employeeName)),
    employees: activeEmployees.map((employee) => ({ id: employee._id, name: employee.name, email: employee.email, role: employee.role })),
    overview: {
      activeEmployees: scopedEmployees.length,
      presentToday: markedToday.size,
      notMarkedToday: Math.max(0, scopedEmployees.length - markedToday.size),
      totalCvsDownloaded: records.reduce((sum, record) => sum + Number(record.cvsDownloaded || 0), 0),
      totalCvsSubmitted: records.reduce((sum, record) => sum + Number(record.cvsSubmitted || 0), 0)
    }
  };
}

router.get("/today", async (req, res, next) => {
  try {
    const today = londonDate();
    const attendance = await Attendance.findOne({ user: req.user._id, attendanceDate: today }).lean();
    res.json({ today, attendance });
  } catch (error) {
    next(error);
  }
});

router.post("/check-in", async (req, res, next) => {
  try {
    const attendanceDate = londonDate();
    const existing = await Attendance.findOne({ user: req.user._id, attendanceDate });
    if (existing) return res.status(409).json({ message: "Your attendance is already marked for today", attendance: existing });

    const attendance = await Attendance.create({
      user: req.user._id,
      employeeName: req.user.name,
      employeeEmail: req.user.email,
      attendanceDate,
      workLocation: cleanLocation(req.body.workLocation),
      checkInAt: new Date()
    });
    await logActivity(req, {
      module: "Attendance",
      action: "Checked in",
      entityType: "Attendance",
      entityId: attendance._id,
      summary: `${req.user.name} marked attendance for ${attendanceDate}`
    });
    res.status(201).json(attendance);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Your attendance is already marked for today" });
    }
    next(error);
  }
});

router.put("/today", async (req, res, next) => {
  try {
    const attendance = await Attendance.findOne({ user: req.user._id, attendanceDate: londonDate() });
    if (!attendance) return res.status(400).json({ message: "Please mark your attendance before saving today's report" });
    if (attendance.checkOutAt) return res.status(409).json({ message: "Today's report is locked because you have already checked out" });

    if (req.body.cvsDownloaded !== undefined) attendance.cvsDownloaded = integerCount(req.body.cvsDownloaded, "CVs downloaded");
    if (req.body.cvsSubmitted !== undefined) attendance.cvsSubmitted = integerCount(req.body.cvsSubmitted, "CVs submitted");
    if (req.body.workLocation !== undefined) attendance.workLocation = cleanLocation(req.body.workLocation);
    if (req.body.notes !== undefined) attendance.notes = String(req.body.notes || "").trim().slice(0, 1000);
    await attendance.save();
    res.json(attendance);
  } catch (error) {
    next(error);
  }
});

router.post("/check-out", async (req, res, next) => {
  try {
    const attendance = await Attendance.findOne({ user: req.user._id, attendanceDate: londonDate() });
    if (!attendance) return res.status(400).json({ message: "Please mark your attendance before checking out" });
    if (attendance.checkOutAt) return res.status(409).json({ message: "You have already checked out today", attendance });

    attendance.cvsDownloaded = integerCount(req.body.cvsDownloaded ?? attendance.cvsDownloaded, "CVs downloaded");
    attendance.cvsSubmitted = integerCount(req.body.cvsSubmitted ?? attendance.cvsSubmitted, "CVs submitted");
    attendance.workLocation = cleanLocation(req.body.workLocation ?? attendance.workLocation);
    attendance.notes = String(req.body.notes ?? attendance.notes ?? "").trim().slice(0, 1000);
    attendance.checkOutAt = new Date();
    await attendance.save();
    await logActivity(req, {
      module: "Attendance",
      action: "Checked out",
      entityType: "Attendance",
      entityId: attendance._id,
      summary: `${req.user.name} checked out for ${attendance.attendanceDate}`
    });
    res.json(attendance);
  } catch (error) {
    next(error);
  }
});

router.get("/report", requirePermission("attendance.manage"), async (req, res, next) => {
  try {
    res.json(await attendanceReport(req));
  } catch (error) {
    next(error);
  }
});

router.get("/report.pdf", requirePermission("attendance.manage"), async (req, res, next) => {
  try {
    const report = await attendanceReport(req);
    const selectedEmployee = report.employees.find((employee) => String(employee.id) === String(report.filters.userId));
    const employeeLabel = selectedEmployee?.name || report.records[0]?.employeeName || "All employees";
    const safeEmployee = employeeLabel.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "All-Employees";
    const pdf = await generateAttendanceReportPdf(report, {
      employeeLabel,
      downloadedBy: { name: "Muhammad Ahsan Qasim", title: "Co-Founder and Director" }
    });
    await logActivity(req, {
      module: "Attendance",
      action: "Downloaded PDF report",
      entityType: "AttendanceReport",
      summary: `${req.user.name} downloaded the ${employeeLabel} attendance report for ${report.filters.from} to ${report.filters.to}`
    });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Innovex-Attendance-${safeEmployee}-${report.filters.from}-to-${report.filters.to}.pdf"`);
    res.send(pdf);
  } catch (error) {
    next(error);
  }
});

export default router;
