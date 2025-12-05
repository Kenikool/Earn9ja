import cron from "node-cron";
import { currencyService } from "../services/CurrencyConversionService.js";
import { logger } from "../config/logger.js";

/**
 * Background job to update exchange rates every 6 hours
 * Runs at: 00:00, 06:00, 12:00, 18:00 daily
 */
export function startExchangeRateUpdateJob() {
  // Run every 6 hours
  cron.schedule("0 */6 * * *", async () => {
    try {
      logger.info("Starting scheduled exchange rate update");
      await currencyService.updateExchangeRates();
      logger.info("Exchange rate update completed successfully");
    } catch (error) {
      logger.error("Failed to update exchange rates in scheduled job:", error);
    }
  });

  logger.info("Exchange rate update job scheduled (every 6 hours)");

  // Run immediately on startup if rates are stale
  setTimeout(async () => {
    try {
      const status = currencyService.getCacheStatus();
      if (status.isStale) {
        logger.info("Exchange rates are stale, updating now");
        await currencyService.updateExchangeRates();
      }
    } catch (error) {
      logger.error("Failed to update exchange rates on startup:", error);
    }
  }, 5000); // Wait 5 seconds after startup
}
