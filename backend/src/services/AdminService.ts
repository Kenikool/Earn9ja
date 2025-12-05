import { User } from "../models/User.js";
import { Task } from "../models/Task.js";
import { Transaction } from "../models/Transaction.js";
import { Wallet } from "../models/Wallet.js";
import { TaskSubmission } from "../models/TaskSubmission.js";
import { Withdrawal } from "../models/Withdrawal.js";
import { Dispute } from "../models/Dispute.js";
import mongoose from "mongoose";

class AdminService {
  // User Management
  async getAllUsers(filters: any = {}, page: number = 1, limit: number = 20) {
    try {
      const query: any = {};

      if (filters.status) query.status = filters.status;
      if (filters.role) query.roles = filters.role;
      if (filters.isKYCVerified !== undefined)
        query.isKYCVerified = filters.isKYCVerified;
      if (filters.search) {
        query.$or = [
          { email: { $regex: filters.search, $options: "i" } },
          { phoneNumber: { $regex: filters.search, $options: "i" } },
          { "profile.firstName": { $regex: filters.search, $options: "i" } },
          { "profile.lastName": { $regex: filters.search, $options: "i" } },
        ];
      }

      const skip = (page - 1) * limit;
      const users = await User.find(query)
        .select("-passwordHash")
        .populate("walletId", "availableBalance lifetimeEarnings")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await User.countDocuments(query);

      return {
        success: true,
        data: {
          users,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      console.error("Get all users error:", error);
      return {
        success: false,
        message: "Failed to fetch users",
      };
    }
  }

  async getUserDetails(userId: string) {
    try {
      const user = await User.findById(userId)
        .select("-passwordHash")
        .populate("walletId")
        .lean();

      if (!user) {
        return {
          success: false,
          message: "User not found",
        };
      }

      // Get user statistics
      const tasksCompleted = await TaskSubmission.countDocuments({
        workerId: userId,
        status: "approved",
      });

      const tasksCreated = await Task.countDocuments({ sponsorId: userId });

      const totalEarnings = await Transaction.aggregate([
        { $match: { userId: userId, type: "earning" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);

      const totalSpent = await Transaction.aggregate([
        { $match: { userId: userId, type: "task_payment" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);

      return {
        success: true,
        data: {
          user,
          statistics: {
            tasksCompleted,
            tasksCreated,
            totalEarnings: totalEarnings[0]?.total || 0,
            totalSpent: totalSpent[0]?.total || 0,
          },
        },
      };
    } catch (error) {
      console.error("Get user details error:", error);
      return {
        success: false,
        message: "Failed to fetch user details",
      };
    }
  }

  async suspendUser(userId: string, reason: string, adminId: string) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          status: "suspended",
          $push: {
            activityLog: {
              action: "suspended",
              reason,
              performedBy: adminId,
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      );

      if (!user) {
        return {
          success: false,
          message: "User not found",
        };
      }

      return {
        success: true,
        message: "User suspended successfully",
        data: user,
      };
    } catch (error) {
      console.error("Suspend user error:", error);
      return {
        success: false,
        message: "Failed to suspend user",
      };
    }
  }

  async banUser(userId: string, reason: string, adminId: string) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          status: "banned",
          $push: {
            activityLog: {
              action: "banned",
              reason,
              performedBy: adminId,
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      );

      if (!user) {
        return {
          success: false,
          message: "User not found",
        };
      }

      return {
        success: true,
        message: "User banned successfully",
        data: user,
      };
    } catch (error) {
      console.error("Ban user error:", error);
      return {
        success: false,
        message: "Failed to ban user",
      };
    }
  }

  async reactivateUser(userId: string, adminId: string) {
    try {
      const user = await User.findByIdAndUpdate(
        userId,
        {
          status: "active",
          $push: {
            activityLog: {
              action: "reactivated",
              performedBy: adminId,
              timestamp: new Date(),
            },
          },
        },
        { new: true }
      );

      if (!user) {
        return {
          success: false,
          message: "User not found",
        };
      }

      return {
        success: true,
        message: "User reactivated successfully",
        data: user,
      };
    } catch (error) {
      console.error("Reactivate user error:", error);
      return {
        success: false,
        message: "Failed to reactivate user",
      };
    }
  }

  // Task Moderation
  async getPendingTasks(page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit;
      const tasks = await Task.find({ status: "pending_approval" })
        .populate("sponsorId", "profile.firstName profile.lastName email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Task.countDocuments({ status: "pending_approval" });

      return {
        success: true,
        data: {
          tasks,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      console.error("Get pending tasks error:", error);
      return {
        success: false,
        message: "Failed to fetch pending tasks",
      };
    }
  }

  async approveTask(taskId: string, adminId: string) {
    try {
      const task = await Task.findByIdAndUpdate(
        taskId,
        {
          status: "active",
          moderationStatus: "approved",
          moderatedBy: adminId,
          moderatedAt: new Date(),
        },
        { new: true }
      );

      if (!task) {
        return {
          success: false,
          message: "Task not found",
        };
      }

      return {
        success: true,
        message: "Task approved successfully",
        data: task,
      };
    } catch (error) {
      console.error("Approve task error:", error);
      return {
        success: false,
        message: "Failed to approve task",
      };
    }
  }

  async rejectTask(taskId: string, reason: string, adminId: string) {
    try {
      const task = await Task.findByIdAndUpdate(
        taskId,
        {
          status: "rejected",
          moderationStatus: "rejected",
          moderationReason: reason,
          moderatedBy: adminId,
          moderatedAt: new Date(),
        },
        { new: true }
      );

      if (!task) {
        return {
          success: false,
          message: "Task not found",
        };
      }

      return {
        success: true,
        message: "Task rejected successfully",
        data: task,
      };
    } catch (error) {
      console.error("Reject task error:", error);
      return {
        success: false,
        message: "Failed to reject task",
      };
    }
  }

  // Withdrawal Management
  async getPendingWithdrawals(page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit;
      const withdrawals = await Withdrawal.find({ status: "pending" })
        .populate(
          "userId",
          "profile.firstName profile.lastName email phoneNumber"
        )
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Withdrawal.countDocuments({ status: "pending" });

      return {
        success: true,
        data: {
          withdrawals,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      console.error("Get pending withdrawals error:", error);
      return {
        success: false,
        message: "Failed to fetch pending withdrawals",
      };
    }
  }

  async approveWithdrawal(withdrawalId: string, adminId: string) {
    try {
      const withdrawal = await Withdrawal.findByIdAndUpdate(
        withdrawalId,
        {
          status: "approved",
          processedBy: adminId,
          processedAt: new Date(),
        },
        { new: true }
      );

      if (!withdrawal) {
        return {
          success: false,
          message: "Withdrawal not found",
        };
      }

      return {
        success: true,
        message: "Withdrawal approved successfully",
        data: withdrawal,
      };
    } catch (error) {
      console.error("Approve withdrawal error:", error);
      return {
        success: false,
        message: "Failed to approve withdrawal",
      };
    }
  }

  async rejectWithdrawal(
    withdrawalId: string,
    reason: string,
    adminId: string
  ) {
    try {
      const withdrawal = await Withdrawal.findByIdAndUpdate(
        withdrawalId,
        {
          status: "rejected",
          rejectionReason: reason,
          processedBy: adminId,
          processedAt: new Date(),
        },
        { new: true }
      );

      if (!withdrawal) {
        return {
          success: false,
          message: "Withdrawal not found",
        };
      }

      // Refund amount to user wallet
      await Wallet.findOneAndUpdate(
        { userId: withdrawal.userId },
        {
          $inc: {
            availableBalance: withdrawal.amount,
            pendingBalance: -withdrawal.amount,
          },
        }
      );

      return {
        success: true,
        message: "Withdrawal rejected and amount refunded",
        data: withdrawal,
      };
    } catch (error) {
      console.error("Reject withdrawal error:", error);
      return {
        success: false,
        message: "Failed to reject withdrawal",
      };
    }
  }

  // Platform Analytics
  async getPlatformStats() {
    try {
      const totalUsers = await User.countDocuments();
      const activeUsers = await User.countDocuments({ status: "active" });
      const totalTasks = await Task.countDocuments();
      const activeTasks = await Task.countDocuments({ status: "active" });
      const completedTasks = await TaskSubmission.countDocuments({
        status: "approved",
      });

      const totalRevenue = await Transaction.aggregate([
        { $match: { type: "platform_fee" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);

      const totalPayouts = await Withdrawal.aggregate([
        { $match: { status: "completed" } },
        { $group: { _id: null, total: { $sum: "$amount" } } },
      ]);

      const pendingWithdrawals = await Withdrawal.countDocuments({
        status: "pending",
      });

      return {
        success: true,
        data: {
          users: {
            total: totalUsers,
            active: activeUsers,
          },
          tasks: {
            total: totalTasks,
            active: activeTasks,
            completed: completedTasks,
          },
          financials: {
            totalRevenue: totalRevenue[0]?.total || 0,
            totalPayouts: totalPayouts[0]?.total || 0,
            pendingWithdrawals,
          },
        },
      };
    } catch (error) {
      console.error("Get platform stats error:", error);
      return {
        success: false,
        message: "Failed to fetch platform statistics",
      };
    }
  }

  async getRevenueReport(startDate: Date, endDate: Date) {
    try {
      const revenue = await Transaction.aggregate([
        {
          $match: {
            type: "platform_fee",
            createdAt: { $gte: startDate, $lte: endDate },
          },
        },
        {
          $group: {
            _id: {
              year: { $year: "$createdAt" },
              month: { $month: "$createdAt" },
              day: { $dayOfMonth: "$createdAt" },
            },
            total: { $sum: "$amount" },
            count: { $sum: 1 },
          },
        },
        { $sort: { "_id.year": 1, "_id.month": 1, "_id.day": 1 } },
      ]);

      return {
        success: true,
        data: revenue,
      };
    } catch (error) {
      console.error("Get revenue report error:", error);
      return {
        success: false,
        message: "Failed to generate revenue report",
      };
    }
  }

  // Dispute Resolution
  async getPendingDisputes(page: number = 1, limit: number = 20) {
    try {
      const skip = (page - 1) * limit;
      const disputes = await Dispute.find({
        status: { $in: ["pending", "under_review"] },
      })
        .populate("reportedBy", "profile.firstName profile.lastName email")
        .populate("reportedAgainst", "profile.firstName profile.lastName email")
        .populate("taskId", "title category reward")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

      const total = await Dispute.countDocuments({
        status: { $in: ["pending", "under_review"] },
      });

      return {
        success: true,
        data: {
          disputes,
          pagination: {
            page,
            limit,
            total,
            pages: Math.ceil(total / limit),
          },
        },
      };
    } catch (error) {
      console.error("Get pending disputes error:", error);
      return {
        success: false,
        message: "Failed to fetch pending disputes",
      };
    }
  }

  async getDisputeDetails(disputeId: string) {
    try {
      const dispute = await Dispute.findById(disputeId)
        .populate("reportedBy", "profile email phoneNumber")
        .populate("reportedAgainst", "profile email phoneNumber")
        .populate("taskId")
        .populate("submissionId")
        .lean();

      if (!dispute) {
        return {
          success: false,
          message: "Dispute not found",
        };
      }

      return {
        success: true,
        data: dispute,
      };
    } catch (error) {
      console.error("Get dispute details error:", error);
      return {
        success: false,
        message: "Failed to fetch dispute details",
      };
    }
  }

  async resolveDispute(
    disputeId: string,
    resolution: {
      decision: string;
      action: "refund_worker" | "refund_sponsor" | "no_action" | "ban_user";
      notes: string;
    },
    adminId: string
  ) {
    try {
      const dispute = await Dispute.findById(disputeId);

      if (!dispute) {
        return {
          success: false,
          message: "Dispute not found",
        };
      }

      // Update dispute status
      dispute.status = "resolved";
      dispute.resolution = {
        ...resolution,
        resolvedBy: new mongoose.Types.ObjectId(adminId),
        resolvedAt: new Date(),
      };

      await dispute.save();

      // Execute resolution action
      if (resolution.action === "refund_worker") {
        const submission = await TaskSubmission.findById(dispute.submissionId);
        if (submission) {
          await Wallet.findOneAndUpdate(
            { userId: submission.workerId },
            { $inc: { availableBalance: submission.reward } }
          );
        }
      } else if (resolution.action === "refund_sponsor") {
        const task = await Task.findById(dispute.taskId);
        if (task) {
          await Wallet.findOneAndUpdate(
            { userId: task.sponsorId },
            { $inc: { availableBalance: task.reward } }
          );
        }
      } else if (resolution.action === "ban_user") {
        await User.findByIdAndUpdate(dispute.reportedAgainst, {
          status: "banned",
        });
      }

      return {
        success: true,
        message: "Dispute resolved successfully",
        data: dispute,
      };
    } catch (error) {
      console.error("Resolve dispute error:", error);
      return {
        success: false,
        message: "Failed to resolve dispute",
      };
    }
  }

  async updateDisputeStatus(
    disputeId: string,
    status: "under_review" | "rejected"
  ) {
    try {
      const dispute = await Dispute.findByIdAndUpdate(
        disputeId,
        { status },
        { new: true }
      );

      if (!dispute) {
        return {
          success: false,
          message: "Dispute not found",
        };
      }

      return {
        success: true,
        message: `Dispute ${status} successfully`,
        data: dispute,
      };
    } catch (error) {
      console.error("Update dispute status error:", error);
      return {
        success: false,
        message: "Failed to update dispute status",
      };
    }
  }
}

export const adminService = new AdminService();
