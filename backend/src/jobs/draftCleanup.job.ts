import { DraftService } from "../services/DraftService.js";

/**
 * Cron job to cleanup expired drafts
 * Should run daily at midnight
 */
export async function cleanupExpiredDrafts() {
  try {
    console.log("[CRON] Starting draft cleanup job...");

    const deletedCount = await DraftService.cleanupExpiredDrafts();

    console.log(
      `[CRON] Draft cleanup completed. Deleted ${deletedCount} expired drafts.`
    );

    return { success: true, deletedCount };
  } catch (error: any) {
    console.error("[CRON] Error in draft cleanup job:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Setup cron job (call this from server.ts)
 * Runs daily at midnight
 */
export function setupDraftCleanupJob() {
  // Run cleanup every 24 hours (at midnight)
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  // Calculate time until next midnight
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  const timeUntilMidnight = tomorrow.getTime() - now.getTime();

  // Run at midnight, then every 24 hours
  setTimeout(() => {
    cleanupExpiredDrafts();
    setInterval(cleanupExpiredDrafts, TWENTY_FOUR_HOURS);
  }, timeUntilMidnight);

  console.log("[CRON] Draft cleanup job scheduled to run daily at midnight");
}
