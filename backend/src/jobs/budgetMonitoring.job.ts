import cron from "node-cron";
import { TaskBudget } from "../models/TaskBudget.js";
import { Task } from "../models/Task.js";
import notificationService from "../services/NotificationService.js";

/**
 * Cron job to monitor budgets and auto-pause tasks
 * Runs every hour to check budget status
 */
export const startBudgetMonitoringJob = () => {
  // Run every hour
  cron.schedule("0 * * * *", async () => {
    try {
      console.log("🕐 Running budget monitoring check...");

      // Find all active budgets that are not paused
      const activeBudgets = await TaskBudget.find({
        isPaused: false,
      }).populate("taskId");

      let pausedCount = 0;
      let alertsTriggered = 0;

      for (const budget of activeBudgets) {
        const spendingPercentage =
          (budget.spentBudget / budget.totalBudget) * 100;

        // Check if budget should be auto-paused
        if (
          budget.autoPauseEnabled &&
          spendingPercentage >= budget.autoPauseThreshold
        ) {
          budget.isPaused = true;
          budget.pausedAt = new Date();
          budget.pauseReason = `Budget threshold reached (${budget.autoPauseThreshold}%)`;
          await budget.save();

          // Pause the task
          await Task.findByIdAndUpdate(budget.taskId, {
            status: "paused",
            pausedAt: new Date(),
          });

          // Send notification
          await notificationService.createNotification({
            userId: budget.sponsorId.toString(),
            type: "task_paused",
            title: "Task Auto-Paused",
            body: `Your task has been automatically paused because the budget threshold (${budget.autoPauseThreshold}%) was reached.`,
            data: {
              taskId: budget.taskId.toString(),
              spentBudget: budget.spentBudget,
              totalBudget: budget.totalBudget,
              threshold: budget.autoPauseThreshold,
            },
          });

          pausedCount++;
          console.log(
            `⏸️  Auto-paused task ${budget.taskId} due to budget threshold`
          );
        }

        // Check alert thresholds
        for (const threshold of budget.alertThresholds) {
          if (
            !threshold.triggered &&
            spendingPercentage >= threshold.percentage
          ) {
            threshold.triggered = true;
            threshold.triggeredAt = new Date();

            // Send notification
            await notificationService.createNotification({
              userId: budget.sponsorId.toString(),
              type: "budget_alert",
              title: "Budget Alert",
              body: `Your task budget has reached ${
                threshold.percentage
              }% (₦${budget.spentBudget.toLocaleString()} of ₦${budget.totalBudget.toLocaleString()})`,
              data: {
                taskId: budget.taskId.toString(),
                percentage: threshold.percentage,
                spentBudget: budget.spentBudget,
                totalBudget: budget.totalBudget,
              },
            });

            alertsTriggered++;
            console.log(
              `🔔 Budget alert triggered for task ${budget.taskId} at ${threshold.percentage}%`
            );
          }
        }

        // Save any threshold updates
        if (alertsTriggered > 0) {
          await budget.save();
        }

        // Check daily limit
        if (budget.dailyLimit && (budget as any).isDailyLimitReached?.()) {
          console.log(`📊 Daily limit reached for task ${budget.taskId}`);

          // Send notification
          await notificationService.createNotification({
            userId: budget.sponsorId.toString(),
            type: "budget_alert",
            title: "Daily Budget Limit Reached",
            body: `Your task has reached its daily spending limit of ₦${budget.dailyLimit.toLocaleString()}`,
            data: {
              taskId: budget.taskId.toString(),
              dailyLimit: budget.dailyLimit,
            },
          });
        }
      }

      console.log(
        `✅ Budget monitoring completed. Paused: ${pausedCount}, Alerts: ${alertsTriggered}`
      );
    } catch (error) {
      console.error("❌ Error in budget monitoring job:", error);
    }
  });

  console.log("✅ Budget monitoring job started (runs every hour)");
};
