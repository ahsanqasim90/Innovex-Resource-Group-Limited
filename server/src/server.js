import app from "./app.js";
import { connectDB } from "./config/db.js";
import { startInterviewReminderScheduler } from "./services/interviewReminderScheduler.js";

const port = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`Innovex API running on port ${port}`);
      startInterviewReminderScheduler();
    });
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
