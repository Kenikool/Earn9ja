import cron from "node-cron";
import { ScheduleService } from "../services/ScheduleService.js";

/**
 * Cron job to execute pending schedules
 * Runs every 5 minutes to check for schedules ready for execution
 */
export const startScheduleExecutionJob = () => {
  // Run every 5 minutes
  cron.schedule("*/5 * * * *", async () => {
    try {
      console.log("🕐 Running schedule execution check...");

      const pendingSchedules = await ScheduleService.getPendingSchedules();

      if (pendingSchedules.length === 0) {
        console.log("✅ No pending schedules to execute");
        return;
      }

      console.log(`📋 Found ${pendingSchedules.length} schedules to execute`);

      // Execute each schedule
      for (const schedule of pendingSchedules) {
        try {
          await ScheduleService.executeSchedule(schedule._id.toString());
          console.log(`✅ Executed schedule: ${schedule._id}`);
        } catch (error: any) {
          console.error(
            `❌ Failed to execute schedule ${schedule._id}:`,
            error.message
          );
        }
      }

      console.log(
        `✅ Schedule execution completed. Executed ${pendingSchedules.length} schedules`
      );
    } catch (error) {
      console.error("❌ Error in schedule execution job:", error);
    }
  });

  console.log("✅ Schedule execution job started (runs every 5 minutes)");
};
