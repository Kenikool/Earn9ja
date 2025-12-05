import { Request, Response } from "express";
import { SponsorPackage } from "../models/SponsorPackage.js";
import { User } from "../models/User.js";
import { EscrowAccount } from "../models/EscrowAccount.js";
import { EmailService } from "../services/EmailService.js";

export class SponsorController {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  getPackages = async (req: Request, res: Response) => {
    try {
      const packages = await SponsorPackage.find({ isActive: true }).sort({
        monthlyPrice: 1,
      });

      res.json({
        success: true,
        packages,
      });
    } catch (error) {
      console.error("Get packages error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch packages",
      });
    }
  };

  getPackageById = async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const packageData = await SponsorPackage.findById(id);

      if (!packageData) {
        return res.status(404).json({
          success: false,
          message: "Package not found",
        });
      }

      res.json({
        success: true,
        package: packageData,
      });
    } catch (error) {
      console.error("Get package error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch package",
      });
    }
  };

  subscribeToPackage = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { packageId, businessInfo } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const packageData = await SponsorPackage.findById(packageId);
      if (!packageData) {
        return res.status(404).json({
          success: false,
          message: "Package not found",
        });
      }

      // Update user with sponsor info
      user.sponsorInfo = {
        companyName: businessInfo.companyName,
        businessType: businessInfo.businessType,
        taxId: businessInfo.taxId,
        businessDescription: businessInfo.businessDescription,
        verificationStatus: "pending",
      };

      // Add sponsor role if not already present
      if (!user.roles.includes("sponsor")) {
        user.roles.push("sponsor");
      }

      // Set sponsor package
      const now = new Date();
      const expiresAt = new Date(now);
      expiresAt.setMonth(expiresAt.getMonth() + 1);

      user.sponsorPackage = {
        packageId: packageData._id,
        packageName: packageData.name,
        subscribedAt: now,
        expiresAt,
        tasksUsed: 0,
        autoRenew: true,
      };

      await user.save();

      // Create escrow account if doesn't exist
      let escrowAccount = await EscrowAccount.findOne({ sponsorId: userId });
      if (!escrowAccount) {
        escrowAccount = await EscrowAccount.create({
          sponsorId: userId,
          balance: 0,
          reservedBalance: 0,
          totalDeposited: 0,
          totalWithdrawn: 0,
          status: "active",
        });
      }

      res.json({
        success: true,
        message: "Successfully subscribed to package",
        user: {
          id: user._id,
          sponsorPackage: user.sponsorPackage,
          sponsorInfo: user.sponsorInfo,
        },
      });
    } catch (error) {
      console.error("Subscribe error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to subscribe to package",
      });
    }
  };

  completeOnboarding = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { firstTaskData } = req.body;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      // Send welcome email
      try {
        await this.emailService.sendEmail(
          user.email,
          "Welcome to Earn9ja Sponsors!",
          `
            <h1>Welcome ${user.profile.firstName}!</h1>
            <p>Your sponsor account has been successfully activated.</p>
            <p>You can now start creating tasks and reaching thousands of workers.</p>
            <p>Package: ${user.sponsorPackage?.packageName}</p>
            <p>Task Limit: ${
              user.sponsorPackage?.packageId
                ? await SponsorPackage.findById(
                    user.sponsorPackage.packageId
                  ).then((pkg) =>
                    pkg?.taskLimit
                      ? `${pkg.taskLimit} tasks/month`
                      : "Unlimited"
                  )
                : "N/A"
            }</p>
            <br>
            <p>Best regards,<br>The Earn9ja Team</p>
          `
        );
      } catch (emailError) {
        console.error("Failed to send welcome email:", emailError);
        // Don't fail the request if email fails
      }

      res.json({
        success: true,
        message: "Onboarding completed successfully",
      });
    } catch (error) {
      console.error("Complete onboarding error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to complete onboarding",
      });
    }
  };

  getOnboardingStatus = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;

      const user = await User.findById(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const hasPackage = !!user.sponsorPackage;
      const hasBusinessInfo = !!user.sponsorInfo?.companyName;
      const hasEscrow = !!(await EscrowAccount.findOne({ sponsorId: userId }));

      res.json({
        success: true,
        status: {
          hasPackage,
          hasBusinessInfo,
          hasEscrow,
          isComplete: hasPackage && hasBusinessInfo && hasEscrow,
        },
      });
    } catch (error) {
      console.error("Get onboarding status error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get onboarding status",
      });
    }
  };

  getAnalytics = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user.id;
      const { range = "30d" } = req.query;

      // Calculate date range
      const now = new Date();
      const startDate = new Date(now);
      switch (range) {
        case "7d":
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "90d":
          startDate.setDate(startDate.getDate() - 90);
          break;
        default: // 30d
          startDate.setDate(startDate.getDate() - 30);
      }

      const { Task } = await import("../models/Task.js");
      const { TaskSubmission } = await import("../models/TaskSubmission.js");

      // Get all tasks created by this sponsor
      const tasks = await Task.find({
        sponsorId: userId,
        createdAt: { $gte: startDate },
      });

      const taskIds = tasks.map((t) => t._id);

      // Get all submissions for these tasks
      const submissions = await TaskSubmission.find({
        taskId: { $in: taskIds },
      });

      // Calculate overview stats
      const totalTasksCreated = tasks.length;
      const totalTasksCompleted = tasks.filter(
        (t) => t.status === "completed"
      ).length;
      const totalSpent = tasks.reduce((sum, t) => sum + (t.reward || 0), 0);
      const completionRate =
        totalTasksCreated > 0
          ? Math.round((totalTasksCompleted / totalTasksCreated) * 100)
          : 0;

      // Calculate average completion time
      const completedTasks = tasks.filter((t) => t.status === "completed");
      const avgCompletionTime =
        completedTasks.length > 0
          ? completedTasks.reduce((sum, t) => {
              const created = new Date(t.createdAt).getTime();
              const completed = new Date(t.updatedAt).getTime();
              return sum + (completed - created) / (1000 * 60 * 60); // hours
            }, 0) / completedTasks.length
          : 0;

      // Task performance breakdown
      const taskPerformance = {
        draft: tasks.filter((t) => t.status === "draft").length,
        active: tasks.filter((t) => t.status === "active").length,
        completed: tasks.filter((t) => t.status === "completed").length,
        rejected: submissions.filter((s) => s.status === "rejected").length,
      };

      // Worker engagement
      const uniqueWorkers = new Set(
        submissions.map((s) => s.workerId.toString())
      );
      const approvedSubmissions = submissions.filter(
        (s) => s.status === "approved"
      );
      const averageRating = 0; // Rating system not implemented yet

      // Count repeat workers (workers who completed more than one task)
      const workerTaskCounts = new Map<string, number>();
      approvedSubmissions.forEach((s) => {
        const workerId = s.workerId.toString();
        workerTaskCounts.set(
          workerId,
          (workerTaskCounts.get(workerId) || 0) + 1
        );
      });
      const repeatWorkers = Array.from(workerTaskCounts.values()).filter(
        (count) => count > 1
      ).length;

      const workerEngagement = {
        totalWorkers: uniqueWorkers.size,
        averageRating,
        repeatWorkers,
      };

      // ROI calculations
      const totalInvestment = totalSpent;
      const estimatedReach = approvedSubmissions.length * 10; // Assume each task reaches 10 people
      const costPerAcquisition =
        approvedSubmissions.length > 0
          ? totalSpent / approvedSubmissions.length
          : 0;
      const roi =
        totalInvestment > 0
          ? ((estimatedReach - totalInvestment) / totalInvestment) * 100
          : 0;

      // Recent tasks performance
      const recentTasks = tasks.slice(0, 5).map((task) => {
        const taskSubmissions = submissions.filter(
          (s) => s.taskId.toString() === task._id.toString()
        );
        const approvedCount = taskSubmissions.filter(
          (s) => s.status === "approved"
        ).length;
        const completionRate =
          taskSubmissions.length > 0
            ? Math.round((approvedCount / taskSubmissions.length) * 100)
            : 0;

        return {
          id: task._id.toString(),
          title: task.title,
          completionRate,
          totalSubmissions: taskSubmissions.length,
          approvedSubmissions: approvedCount,
        };
      });

      res.json({
        success: true,
        analytics: {
          overview: {
            totalTasksCreated,
            totalTasksCompleted,
            totalSpent,
            averageCompletionTime: Math.round(avgCompletionTime * 10) / 10,
            completionRate,
          },
          taskPerformance,
          workerEngagement,
          roi: {
            totalInvestment,
            estimatedReach,
            costPerAcquisition: Math.round(costPerAcquisition * 100) / 100,
            roi: Math.round(roi * 10) / 10,
          },
          recentTasks,
        },
      });
    } catch (error) {
      console.error("Get analytics error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch analytics",
      });
    }
  };
}
