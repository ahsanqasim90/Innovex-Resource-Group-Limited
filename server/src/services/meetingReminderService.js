import Meeting from "../models/Meeting.js";
import { sendMeetingReminderEmail } from "./emailService.js";

function isoDateOnly(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function dayRange(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export async function runMeetingReminders(date = new Date()) {
  const today = isoDateOnly(date);
  const { start, end } = dayRange(date);
  const meetings = await Meeting.find({
    reminderEmailEnabled: true,
    meetingStatus: "Upcoming",
    meetingDate: { $gte: start, $lt: end },
    $or: [{ lastReminderDate: { $ne: today } }, { lastReminderDate: { $exists: false } }]
  });

  const results = [];
  for (const meeting of meetings) {
    try {
      const email = await sendMeetingReminderEmail(meeting);
      if (email.sent) {
        meeting.lastReminderDate = today;
        await meeting.save();
      }
      results.push({ id: meeting._id, attendeeName: meeting.attendeeName, ...email });
    } catch (error) {
      results.push({ id: meeting._id, attendeeName: meeting.attendeeName, sent: false, reason: error.message });
    }
  }

  return { checkedDate: today, count: meetings.length, results };
}
