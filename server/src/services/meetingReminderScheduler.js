import { runMeetingReminders } from "./meetingReminderService.js";
import { forEachActiveOrganization } from "../tenancy/tenantJobs.js";
import SystemEvent from "../models/SystemEvent.js";

const dayMs = 24 * 60 * 60 * 1000;

function msUntilNextRun(hour = 8) {
  const now = new Date();
  const next = new Date(now);
  next.setHours(hour, 15, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next.getTime() - now.getTime();
}

export function startMeetingReminderScheduler() {
  if (process.env.DISABLE_MEETING_REMINDERS === "true") return;

  const runHour = Number(process.env.MEETING_REMINDER_HOUR || process.env.INTERVIEW_REMINDER_HOUR || 8);
  const run = async () => {
    try {
      const results = await forEachActiveOrganization(async (organization) => {
        const result = await runMeetingReminders();
        await SystemEvent.create({ type: "Queue", severity: "Info", status: "Resolved", title: "Meeting reminder run completed", message: `${result.count} meetings checked for ${organization.name}`, lastSeenAt: new Date(), resolvedAt: new Date(), metadata: { count: result.count } });
        return result;
      });
      console.log(`Meeting reminders completed for ${results.length} workspaces`);
    } catch (error) {
      console.error("Meeting reminder check failed", error);
    }
  };

  setTimeout(() => {
    run();
    setInterval(run, dayMs);
  }, msUntilNextRun(runHour));
}
