import express from "express";
import Meeting from "../models/Meeting.js";
import { protect, requirePermission } from "../middleware/auth.js";
import { pick, requireFields, validateEmail } from "../utils.js";
import { runMeetingReminders } from "../services/meetingReminderService.js";

const router = express.Router();
const fields = [
  "attendeeName",
  "attendeeEmail",
  "attendeePhone",
  "companyName",
  "meetingTitle",
  "meetingPurpose",
  "meetingDate",
  "meetingTime",
  "meetingType",
  "meetingStatus",
  "notes",
  "reminderEmailEnabled"
];

function toPayload(body) {
  const payload = pick(body, fields);
  if (payload.reminderEmailEnabled !== undefined) {
    payload.reminderEmailEnabled = payload.reminderEmailEnabled === true || payload.reminderEmailEnabled === "true";
  }
  return payload;
}

function escapeRegex(value = "") {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeDateFilter(date) {
  if (!date) return null;
  const start = new Date(date);
  if (Number.isNaN(start.getTime())) return null;
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { $gte: start, $lt: end };
}

async function findConflict(payload, excludeId) {
  const dateFilter = makeDateFilter(payload.meetingDate);
  if (!payload.attendeeName || !payload.meetingTime || !dateFilter) return null;
  const query = {
    attendeeName: new RegExp(`^${escapeRegex(String(payload.attendeeName).trim())}$`, "i"),
    meetingDate: dateFilter,
    meetingTime: payload.meetingTime,
    meetingStatus: { $ne: "Cancelled" }
  };
  if (excludeId) query._id = { $ne: excludeId };
  return Meeting.findOne(query).sort({ createdAt: -1 });
}

async function meetingStats() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [upcomingMeetings, completedMeetings, recentMeetings] = await Promise.all([
    Meeting.countDocuments({ meetingStatus: "Upcoming", meetingDate: { $gte: today } }),
    Meeting.countDocuments({ meetingStatus: "Completed" }),
    Meeting.find().sort({ meetingDate: -1, meetingTime: -1, createdAt: -1 }).limit(6)
  ]);
  return { upcomingMeetings, completedMeetings, recentMeetings };
}

router.get("/reminders/run", async (req, res, next) => {
  try {
    const secret = process.env.CRON_SECRET;
    if (secret && req.headers.authorization !== `Bearer ${secret}` && req.query.secret !== secret) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    res.json(await runMeetingReminders());
  } catch (error) {
    next(error);
  }
});

router.use(protect, requirePermission("meetings.view"));

router.get("/stats/dashboard", async (req, res, next) => {
  try {
    res.json(await meetingStats());
  } catch (error) {
    next(error);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const filter = {};
    const { search, status, date, companyName } = req.query;

    if (status) filter.meetingStatus = status;
    if (companyName) filter.companyName = new RegExp(escapeRegex(companyName), "i");
    const dateFilter = makeDateFilter(date);
    if (dateFilter) filter.meetingDate = dateFilter;
    if (search) {
      const searchRegex = new RegExp(escapeRegex(search), "i");
      filter.$or = [
        { attendeeName: searchRegex },
        { companyName: searchRegex },
        { meetingTitle: searchRegex },
        { meetingPurpose: searchRegex }
      ];
    }

    const meetings = await Meeting.find(filter).sort({ meetingDate: -1, meetingTime: -1, createdAt: -1 });
    res.json(meetings);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    res.json(meeting);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    requireFields(req.body, ["attendeeName", "companyName", "meetingTitle", "meetingPurpose", "meetingDate", "meetingTime"]);
    if (req.body.attendeeEmail) validateEmail(req.body.attendeeEmail);
    const payload = toPayload(req.body);
    const conflict = await findConflict(payload);
    if (conflict && !req.body.allowConflict) {
      return res.status(409).json({
        message: "This attendee already has a meeting booked at this time.",
        conflict
      });
    }
    const meeting = await Meeting.create(payload);
    res.status(201).json(meeting);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    if (req.body.attendeeEmail) validateEmail(req.body.attendeeEmail);
    const meeting = await Meeting.findById(req.params.id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    const payload = toPayload(req.body);
    const conflict = await findConflict(payload, req.params.id);
    if (conflict && !req.body.allowConflict) {
      return res.status(409).json({
        message: "This attendee already has a meeting booked at this time.",
        conflict
      });
    }
    Object.assign(meeting, payload);
    await meeting.save();
    res.json(meeting);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const meeting = await Meeting.findByIdAndDelete(req.params.id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    res.json({ message: "Meeting deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
