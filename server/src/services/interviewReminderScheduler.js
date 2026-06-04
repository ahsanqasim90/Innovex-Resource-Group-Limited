import { runInterviewReminders } from "./interviewReminderService.js";

const dayMs = 24 * 60 * 60 * 1000;

function msUntilNextRun(hour = 8) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 0, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function startInterviewReminderScheduler() {
  if (process.env.DISABLE_INTERVIEW_REMINDERS === "true") return;

  const runHour = Number(process.env.INTERVIEW_REMINDER_HOUR || 8);
  const run = async () => {
    try {
      const result = await runInterviewReminders();
      console.log(`Interview reminders checked: ${result.count}`);
    } catch (error) {
      console.error("Interview reminder check failed", error);
    }
  };

  setTimeout(() => {
    run();
    setInterval(run, dayMs);
  }, msUntilNextRun(runHour));
}
