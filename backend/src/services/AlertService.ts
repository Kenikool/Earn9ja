import { financialSummaryService } from "./FinancialSummaryService";
import { EmailService } from "./EmailService";
import notificationService from "./NotificationService";
import { User } from "../models/User";

interface Alert {
  type: "loss" | "profit" | "milestone" | "exchange_rate_fluctuation" | string;
  severity: "low" | "medium" | "high" | "critical" | "warning";
  title: string;
  message: string;
  amount?: number;
  date?: Date;
  metadata?: any;
  data?: any;
}

export class AlertService {
  private readonly LOSS_THRESHOLD = 5000; // ₦5,000
  private readonly emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Check daily financial status and send alerts if needed
   */
  async checkDailyFinancials(): Promise<void> {
    try {
      const profitability = await financialSummaryService.checkProfitability();

      // Check for significant loss
      if (
        !profitability.isProfitable &&
        Math.abs(profitability.netProfit) > this.LOSS_THRESHOLD
      ) {
        await this.sendLossAlert(profitability.netProfit);
      }

      // Check for profitability milestone
      if (profitability.isProfitable) {
        const consecutiveDays =
          await financialSummaryService.getConsecutiveProfitableDays();

        // Alert on milestone days (7, 14, 30, etc.)
        if ([7, 14, 30, 60, 90].includes(consecutiveDays)) {
          await this.sendMilestoneAlert(
            consecutiveDays,
            profitability.netProfit
          );
        }
      }
    } catch (error) {
      console.error("Error checking daily financials:", error);
    }
  }

  /**
   * Send loss alert to admins
   */
  private async sendLossAlert(lossAmount: number): Promise<void> {
    try {
      const alert: Alert = {
        type: "loss",
        severity: "critical",
        title: "⚠️ Significant Daily Loss Detected",
        message: `The platform has incurred a loss of ₦${Math.abs(
          lossAmount
        ).toLocaleString()} today. Immediate attention required.`,
        amount: lossAmount,
        date: new Date(),
      };

      // Get all admin users
      const admins = await User.find({ roles: "admin" });

      // Send email alerts
      for (const admin of admins) {
        try {
          await this.emailService.sendEmail({
            to: admin.email,
            subject: alert.title,
            html: `
              <h2>${alert.title}</h2>
              <p>${alert.message}</p>
              <p><strong>Loss Amount:</strong> ₦${Math.abs(
                lossAmount
              ).toLocaleString()}</p>
              <p><strong>Date:</strong> ${alert.date.toLocaleDateString()}</p>
              <p>Please review the financial dashboard for detailed breakdown.</p>
            `,
          });
        } catch (emailError) {
          console.error(`Failed to send email to ${admin.email}:`, emailError);
        }
      }

      // Send push notifications
      for (const admin of admins) {
        try {
          await notificationService.sendNotification(
            admin._id.toString(),
            alert.title,
            alert.message,
            {
              type: "financial_alert",
              severity: alert.severity,
              amount: lossAmount.toString(),
            }
          );
        } catch (notifError) {
          console.error(
            `Failed to send notification to ${admin._id}:`,
            notifError
          );
        }
      }

      console.log(`🚨 Loss alert sent to ${admins.length} admins`);
    } catch (error) {
      console.error("Error sending loss alert:", error);
    }
  }

  /**
   * Send milestone alert to admins
   */
  private async sendMilestoneAlert(
    consecutiveDays: number,
    profit: number
  ): Promise<void> {
    try {
      const alert: Alert = {
        type: "milestone",
        severity: "low",
        title: `🎉 ${consecutiveDays} Consecutive Profitable Days!`,
        message: `The platform has been profitable for ${consecutiveDays} consecutive days. Today's profit: ₦${profit.toLocaleString()}`,
        amount: profit,
        date: new Date(),
      };

      // Get all admin users
      const admins = await User.find({ roles: "admin" });

      // Send email alerts
      for (const admin of admins) {
        try {
          await this.emailService.sendEmail({
            to: admin.email,
            subject: alert.title,
            html: `
              <h2>${alert.title}</h2>
              <p>${alert.message}</p>
              <p><strong>Consecutive Profitable Days:</strong> ${consecutiveDays}</p>
              <p><strong>Today's Profit:</strong> ₦${profit.toLocaleString()}</p>
              <p>Great work! Keep it up!</p>
            `,
          });
        } catch (emailError) {
          console.error(`Failed to send email to ${admin.email}:`, emailError);
        }
      }

      // Send push notifications
      for (const admin of admins) {
        try {
          await notificationService.sendNotification(
            admin._id.toString(),
            alert.title,
            alert.message,
            {
              type: "financial_milestone",
              consecutiveDays: consecutiveDays.toString(),
              profit: profit.toString(),
            }
          );
        } catch (notifError) {
          console.error(
            `Failed to send notification to ${admin._id}:`,
            notifError
          );
        }
      }

      console.log(`🎉 Milestone alert sent to ${admins.length} admins`);
    } catch (error) {
      console.error("Error sending milestone alert:", error);
    }
  }

  /**
   * Schedule daily financial check (call this from a cron job)
   */
  async scheduleDailyCheck(): Promise<void> {
    try {
      // Calculate and save today's summary
      await financialSummaryService.saveDailySummary(new Date());

      // Check and send alerts
      await this.checkDailyFinancials();

      console.log("✅ Daily financial check completed");
    } catch (error) {
      console.error("Error in scheduled daily check:", error);
    }
  }

  /**
   * Send generic alert to admins
   */
  async sendAlert(alert: Alert): Promise<void> {
    try {
      // Get all admin users
      const admins = await User.find({ roles: "admin" });

      // Send push notifications
      for (const admin of admins) {
        try {
          await notificationService.sendPushNotification(
            admin._id.toString(),
            alert.title,
            alert.message,
            {
              type: alert.type,
              severity: alert.severity,
              ...alert.metadata,
            }
          );
        } catch (notifError) {
          console.error(
            `Failed to send notification to ${admin._id}:`,
            notifError
          );
        }
      }

      console.log(`📢 Alert sent to ${admins.length} admins: ${alert.title}`);
    } catch (error) {
      console.error("Error sending alert:", error);
    }
  }
}

export const alertService = new AlertService();
