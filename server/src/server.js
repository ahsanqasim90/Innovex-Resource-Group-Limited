import app from "./app.js";
import { connectDB } from "./config/db.js";
import { startInterviewReminderScheduler } from "./services/interviewReminderScheduler.js";
import { startMeetingReminderScheduler } from "./services/meetingReminderScheduler.js";

const port = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`Innovex API running on port ${port}`);
      startInterviewReminderScheduler();
      startMeetingReminderScheduler();
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
