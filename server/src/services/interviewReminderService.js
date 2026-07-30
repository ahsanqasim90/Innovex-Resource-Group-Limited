import Interview from "../models/Interview.js";
import { sendCandidateInterviewReminderEmail, sendInterviewReminderEmail } from "./emailService.js";

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

export function candidateReminderWindow(date = new Date()) {
  const reminderRunDate = isoDateOnly(date);
  const interviewDay = new Date(date);
  interviewDay.setDate(interviewDay.getDate() + 1);
  return {
    reminderRunDate,
    interviewDate: isoDateOnly(interviewDay),
    ...dayRange(interviewDay)
  };
}

export async function runInterviewReminders(date = new Date()) {
  const today = isoDateOnly(date);
  const { start, end } = dayRange(date);
  const internalInterviews = await Interview.find({
    reminderEmailEnabled: true,
    interviewStatus: "Pending",
    interviewDate: { $gte: start, $lt: end },
    $or: [{ lastReminderDate: { $ne: today } }, { lastReminderDate: { $exists: false } }]
  });
  const candidateWindow = candidateReminderWindow(date);
  const candidateInterviews = await Interview.find({
    reminderEmailEnabled: true,
    interviewStatus: "Pending",
    interviewDate: { $gte: candidateWindow.start, $lt: candidateWindow.end },
    $or: [
      { lastCandidateReminderDate: { $ne: candidateWindow.reminderRunDate } },
      { lastCandidateReminderDate: { $exists: false } }
    ]
  });

  const internalResults = [];
  for (const interview of internalInterviews) {
    try {
      const email = await sendInterviewReminderEmail(interview);
      if (email.sent) {
        interview.lastReminderDate = today;
        await interview.save();
      }
      internalResults.push({ id: interview._id, candidateName: interview.candidateName, ...email });
    } catch (error) {
      internalResults.push({ id: interview._id, candidateName: interview.candidateName, sent: false, reason: error.message });
    }
  }

  const candidateResults = [];
  for (const interview of candidateInterviews) {
    try {
      const email = await sendCandidateInterviewReminderEmail(interview);
      interview.candidateReminderEmailStatus = email.sent ? "Sent" : "Failed";
      interview.candidateReminderEmailSentAt = email.sent ? new Date() : undefined;
      interview.candidateReminderEmailError = email.sent ? "" : email.reason || "Email delivery failed";
      if (email.sent) interview.lastCandidateReminderDate = candidateWindow.reminderRunDate;
      await interview.save();
      candidateResults.push({ id: interview._id, candidateName: interview.candidateName, ...email });
    } catch (error) {
      interview.candidateReminderEmailStatus = "Failed";
      interview.candidateReminderEmailError = error.message || "Email delivery failed";
      await interview.save().catch(() => undefined);
      candidateResults.push({ id: interview._id, candidateName: interview.candidateName, sent: false, reason: error.message });
    }
  }

  return {
    checkedDate: today,
    count: internalInterviews.length + candidateInterviews.length,
    results: internalResults,
    internalReminders: { count: internalInterviews.length, results: internalResults },
    candidateReminders: {
      interviewDate: candidateWindow.interviewDate,
      count: candidateInterviews.length,
      results: candidateResults
    }
  };
}
