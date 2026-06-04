import Interview from "../models/Interview.js";
import { sendInterviewReminderEmail } from "./emailService.js";

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

export async function runInterviewReminders(date = new Date()) {
  const today = isoDateOnly(date);
  const { start, end } = dayRange(date);
  const interviews = await Interview.find({
    reminderEmailEnabled: true,
    interviewStatus: "Pending",
    interviewDate: { $gte: start, $lt: end },
    $or: [{ lastReminderDate: { $ne: today } }, { lastReminderDate: { $exists: false } }]
  });

  const results = [];
  for (const interview of interviews) {
    try {
      const email = await sendInterviewReminderEmail(interview);
      if (email.sent) {
        interview.lastReminderDate = today;
        await interview.save();
      }
      results.push({ id: interview._id, candidateName: interview.candidateName, ...email });
    } catch (error) {
      results.push({ id: interview._id, candidateName: interview.candidateName, sent: false, reason: error.message });
    }
  }

  return { checkedDate: today, count: interviews.length, results };
}
