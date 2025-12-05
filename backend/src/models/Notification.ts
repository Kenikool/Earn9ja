import mongoose, { Document, Schema } from "mongoose";

export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  body: string;
  type:
    | "task_assigned"
    | "task_accepted"
    | "task_submission"
    | "task_approved"
    | "task_rejected"
    | "task_revision"
    | "task_completed"
    | "task_expiring"
    | "task_deadline"
    | "task_paused"
    | "task_cancelled"
    | "payment_received"
    | "topup_confirmed"
    | "withdrawal_processed"
    | "low_escrow_balance"
    | "dispute_filed"
    | "referral_joined"
    | "referral_bonus"
    | "achievement_unlocked"
    | "challenge_completed"
    | "challenge_progress"
    | "daily_bonus"
    | "daily_bonus_available"
    | "new_task_available"
    | "system_announcement"
    | "budget_alert"
    | "support";
  data?: Record<string, any>;
  read: boolean;
  actionUrl?: string;
  createdAt: Date;
  readAt?: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        "task_assigned",
        "task_accepted",
        "task_submission",
        "task_approved",
        "task_rejected",
        "task_revision",
        "task_completed",
        "task_expiring",
        "task_deadline",
        "task_paused",
        "task_cancelled",
        "payment_received",
        "topup_confirmed",
        "withdrawal_processed",
        "low_escrow_balance",
        "dispute_filed",
        "referral_joined",
        "referral_bonus",
        "achievement_unlocked",
        "challenge_completed",
        "challenge_progress",
        "daily_bonus",
        "daily_bonus_available",
        "new_task_available",
        "system_announcement",
        "budget_alert",
        "support",
      ],
      index: true,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    actionUrl: {
      type: String,
      trim: true,
    },
    readAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, read: 1 });

export default mongoose.model<INotification>(
  "Notification",
  notificationSchema
);
