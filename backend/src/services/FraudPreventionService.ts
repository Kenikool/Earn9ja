import { OfferWallTransaction } from "../models/OfferWallTransaction.js";
import { User } from "../models/User.js";
import { logger } from "../config/logger.js";
import { redis } from "../config/redis-wrapper.js";

interface FraudCheckResult {
  isFraudulent: boolean;
  reasons: string[];
  riskScore: number;
  action: "allow" | "flag" | "block";
}

interface UserActivityPattern {
  userId: string;
  completionsLast24h: number;
  completionsLastHour: number;
  avgCompletionTime: number;
  uniqueProviders: number;
  suspiciousPatterns: string[];
}

export class FraudPreventionService {
  private readonly RATE_LIMIT_HOUR = 20; // Max completions per hour
  private readonly RATE_LIMIT_DAY = 100; // Max completions per day
  private readonly MIN_COMPLETION_TIME = 30; // Minimum seconds between completions
  private readonly HIGH_RISK_THRESHOLD = 70;
  private readonly MEDIUM_RISK_THRESHOLD = 40;

  /**
   * Check if transaction is duplicate
   */
  async checkDuplicate(
    externalTransactionId: string,
    userId: string,
    amount: number,
    providerId: string
  ): Promise<{ isDuplicate: boolean; reason?: string }> {
    // Check by external transaction ID
    const existingById = await OfferWallTransaction.findByExternalId(
      externalTransactionId
    );
    if (existingById) {
      return {
        isDuplicate: true,
        reason: "Transaction ID already exists",
      };
    }

    // Check for same user, amount, provider within 1 minute
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentSimilar = await OfferWallTransaction.findOne({
      userId,
      providerId,
      convertedAmount: amount,
      createdAt: { $gte: oneMinuteAgo },
    });

    if (recentSimilar) {
      return {
        isDuplicate: true,
        reason: "Similar transaction within 1 minute",
      };
    }

    return { isDuplicate: false };
  }

  /**
   * Check rate limiting for user
   */
  async checkRateLimit(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  }> {
    const now = Date.now();
    const hourAgo = new Date(now - 60 * 60 * 1000);
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);

    // Check hourly limit
    const hourlyCount = await OfferWallTransaction.countDocuments({
      userId,
      status: "completed",
      createdAt: { $gte: hourAgo },
    });

    if (hourlyCount >= this.RATE_LIMIT_HOUR) {
      return {
        allowed: false,
        reason: `Rate limit exceeded: ${hourlyCount}/${this.RATE_LIMIT_HOUR} per hour`,
        retryAfter: 3600,
      };
    }

    // Check daily limit
    const dailyCount = await OfferWallTransaction.countDocuments({
      userId,
      status: "completed",
      createdAt: { $gte: dayAgo },
    });

    if (dailyCount >= this.RATE_LIMIT_DAY) {
      return {
        allowed: false,
        reason: `Daily limit exceeded: ${dailyCount}/${this.RATE_LIMIT_DAY} per day`,
        retryAfter: 86400,
      };
    }

    return { allowed: true };
  }

  /**
   * Check minimum time between completions
   */
  async checkCompletionCooldown(userId: string): Promise<{
    allowed: boolean;
    reason?: string;
    retryAfter?: number;
  }> {
    const lastCompletion = await OfferWallTransaction.findOne({
      userId,
      status: "completed",
    })
      .sort({ createdAt: -1 })
      .select("createdAt");

    if (lastCompletion) {
      const timeSinceLastCompletion =
        (Date.now() - lastCompletion.createdAt.getTime()) / 1000;

      if (timeSinceLastCompletion < this.MIN_COMPLETION_TIME) {
        return {
          allowed: false,
          reason: `Cooldown period: ${this.MIN_COMPLETION_TIME}s between completions`,
          retryAfter: Math.ceil(
            this.MIN_COMPLETION_TIME - timeSinceLastCompletion
          ),
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Analyze user activity patterns for fraud
   */
  async analyzeUserActivity(userId: string): Promise<UserActivityPattern> {
    const now = Date.now();
    const hourAgo = new Date(now - 60 * 60 * 1000);
    const dayAgo = new Date(now - 24 * 60 * 60 * 1000);

    // Get recent transactions
    const recentTransactions = await OfferWallTransaction.find({
      userId,
      createdAt: { $gte: dayAgo },
    }).sort({ createdAt: -1 });

    const completionsLast24h = recentTransactions.length;
    const completionsLastHour = recentTransactions.filter(
      (t) => t.createdAt >= hourAgo
    ).length;

    // Calculate average completion time
    let totalTimeBetween = 0;
    let completionPairs = 0;
    for (let i = 0; i < recentTransactions.length - 1; i++) {
      const timeDiff =
        recentTransactions[i].createdAt.getTime() -
        recentTransactions[i + 1].createdAt.getTime();
      totalTimeBetween += timeDiff;
      completionPairs++;
    }
    const avgCompletionTime =
      completionPairs > 0 ? totalTimeBetween / completionPairs / 1000 : 0;

    // Count unique providers
    const uniqueProviders = new Set(recentTransactions.map((t) => t.providerId))
      .size;

    // Detect suspicious patterns
    const suspiciousPatterns: string[] = [];

    // Pattern 1: Too many completions in short time
    if (completionsLastHour > 10) {
      suspiciousPatterns.push("High completion rate (>10/hour)");
    }

    // Pattern 2: Very fast completions
    if (avgCompletionTime < 60 && completionPairs > 5) {
      suspiciousPatterns.push("Unusually fast completions (<60s avg)");
    }

    // Pattern 3: Same provider repeatedly
    if (uniqueProviders === 1 && completionsLast24h > 20) {
      suspiciousPatterns.push("Single provider focus (>20 completions)");
    }

    // Pattern 4: Round amounts (possible testing)
    const roundAmounts = recentTransactions.filter(
      (t) => t.convertedAmount % 100 === 0
    ).length;
    if (roundAmounts > completionsLast24h * 0.8 && completionsLast24h > 10) {
      suspiciousPatterns.push("Mostly round amounts (possible testing)");
    }

    return {
      userId,
      completionsLast24h,
      completionsLastHour,
      avgCompletionTime,
      uniqueProviders,
      suspiciousPatterns,
    };
  }

  /**
   * Calculate fraud risk score
   */
  async calculateRiskScore(userId: string): Promise<number> {
    const activity = await this.analyzeUserActivity(userId);
    let riskScore = 0;

    // High completion rate
    if (activity.completionsLastHour > 15) {
      riskScore += 30;
    } else if (activity.completionsLastHour > 10) {
      riskScore += 15;
    }

    // Very fast completions
    if (activity.avgCompletionTime < 30) {
      riskScore += 40;
    } else if (activity.avgCompletionTime < 60) {
      riskScore += 20;
    }

    // Single provider focus
    if (activity.uniqueProviders === 1 && activity.completionsLast24h > 20) {
      riskScore += 25;
    }

    // Multiple suspicious patterns
    riskScore += activity.suspiciousPatterns.length * 10;

    // Check user account age
    const user = await User.findById(userId);
    if (user) {
      const accountAge = Date.now() - user.createdAt.getTime();
      const daysSinceCreation = accountAge / (1000 * 60 * 60 * 24);

      // New account with high activity
      if (daysSinceCreation < 7 && activity.completionsLast24h > 30) {
        riskScore += 20;
      }
    }

    return Math.min(riskScore, 100);
  }

  /**
   * Comprehensive fraud check
   */
  async checkForFraud(
    userId: string,
    externalTransactionId: string,
    amount: number,
    providerId: string
  ): Promise<FraudCheckResult> {
    const reasons: string[] = [];
    let riskScore = 0;

    // Check duplicate
    const duplicateCheck = await this.checkDuplicate(
      externalTransactionId,
      userId,
      amount,
      providerId
    );
    if (duplicateCheck.isDuplicate) {
      reasons.push(duplicateCheck.reason!);
      riskScore += 100; // Instant block
    }

    // Check rate limiting
    const rateLimitCheck = await this.checkRateLimit(userId);
    if (!rateLimitCheck.allowed) {
      reasons.push(rateLimitCheck.reason!);
      riskScore += 50;
    }

    // Check cooldown
    const cooldownCheck = await this.checkCompletionCooldown(userId);
    if (!cooldownCheck.allowed) {
      reasons.push(cooldownCheck.reason!);
      riskScore += 30;
    }

    // Calculate overall risk score
    const userRiskScore = await this.calculateRiskScore(userId);
    riskScore = Math.max(riskScore, userRiskScore);

    // Analyze patterns
    const activity = await this.analyzeUserActivity(userId);
    if (activity.suspiciousPatterns.length > 0) {
      reasons.push(...activity.suspiciousPatterns);
    }

    // Determine action
    let action: "allow" | "flag" | "block" = "allow";
    if (riskScore >= this.HIGH_RISK_THRESHOLD) {
      action = "block";
    } else if (riskScore >= this.MEDIUM_RISK_THRESHOLD) {
      action = "flag";
    }

    const isFraudulent = action === "block";

    // Log fraud check
    logger.info("Fraud check completed", {
      userId,
      externalTransactionId,
      riskScore,
      action,
      reasons,
    });

    // Store in Redis for quick access
    if (action === "block") {
      await this.flagUserForReview(userId, reasons.join(", "));
    }

    return {
      isFraudulent,
      reasons,
      riskScore,
      action,
    };
  }

  /**
   * Flag user for admin review
   */
  async flagUserForReview(userId: string, reason: string): Promise<void> {
    try {
      const key = `fraud:flagged:${userId}`;
      await redis.setex(
        key,
        86400 * 7, // 7 days
        JSON.stringify({
          userId,
          reason,
          flaggedAt: new Date().toISOString(),
        })
      );

      logger.warn("User flagged for fraud review", { userId, reason });
    } catch (error) {
      logger.error("Error flagging user:", error);
    }
  }

  /**
   * Check if user is flagged
   */
  async isUserFlagged(userId: string): Promise<boolean> {
    try {
      const key = `fraud:flagged:${userId}`;
      const flagged = await redis.get(key);
      return !!flagged;
    } catch (error) {
      logger.error("Error checking user flag:", error);
      return false;
    }
  }

  /**
   * Get flagged users for admin review
   */
  async getFlaggedUsers(): Promise<any[]> {
    try {
      const keys = await redis.keys("fraud:flagged:*");
      const flaggedUsers = [];

      for (const key of keys) {
        const data = await redis.get(key);
        if (data) {
          flaggedUsers.push(JSON.parse(data));
        }
      }

      return flaggedUsers;
    } catch (error) {
      logger.error("Error getting flagged users:", error);
      return [];
    }
  }

  /**
   * Clear user flag
   */
  async clearUserFlag(userId: string): Promise<void> {
    try {
      const key = `fraud:flagged:${userId}`;
      await redis.del(key);
      logger.info("User flag cleared", { userId });
    } catch (error) {
      logger.error("Error clearing user flag:", error);
    }
  }

  /**
   * Track IP address for abuse detection
   */
  async trackIPAddress(
    ipAddress: string,
    userId: string
  ): Promise<{ suspicious: boolean; reason?: string }> {
    try {
      const key = `fraud:ip:${ipAddress}`;
      const data = await redis.get(key);

      let ipData: any = data ? JSON.parse(data) : { users: [], count: 0 };

      // Add user if not already tracked
      if (!ipData.users.includes(userId)) {
        ipData.users.push(userId);
      }

      ipData.count++;
      ipData.lastSeen = new Date().toISOString();

      await redis.setex(key, 86400, JSON.stringify(ipData)); // 24 hours

      // Check for suspicious activity
      if (ipData.users.length > 5) {
        return {
          suspicious: true,
          reason: `Multiple users (${ipData.users.length}) from same IP`,
        };
      }

      if (ipData.count > 100) {
        return {
          suspicious: true,
          reason: `High request count (${ipData.count}) from IP`,
        };
      }

      return { suspicious: false };
    } catch (error) {
      logger.error("Error tracking IP:", error);
      return { suspicious: false };
    }
  }

  /**
   * Generate fraud report for admin
   */
  async generateFraudReport(startDate?: Date, endDate?: Date): Promise<any> {
    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const end = endDate || new Date();

    // Get all transactions in period
    const transactions = await OfferWallTransaction.find({
      createdAt: { $gte: start, $lte: end },
    });

    // Analyze patterns
    const userActivity = new Map<string, number>();
    const providerActivity = new Map<string, number>();
    const failedTransactions: any[] = [];

    transactions.forEach((t) => {
      userActivity.set(
        t.userId.toString(),
        (userActivity.get(t.userId.toString()) || 0) + 1
      );
      providerActivity.set(
        t.providerId,
        (providerActivity.get(t.providerId) || 0) + 1
      );

      if (t.status === "failed") {
        failedTransactions.push(t);
      }
    });

    // Find suspicious users
    const suspiciousUsers = Array.from(userActivity.entries())
      .filter(([_, count]) => count > 50)
      .map(([userId, count]) => ({ userId, completions: count }));

    // Get flagged users
    const flaggedUsers = await this.getFlaggedUsers();

    return {
      period: { start, end },
      totalTransactions: transactions.length,
      failedTransactions: failedTransactions.length,
      suspiciousUsers,
      flaggedUsers,
      topUsers: Array.from(userActivity.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([userId, count]) => ({ userId, completions: count })),
      providerBreakdown: Array.from(providerActivity.entries()).map(
        ([providerId, count]) => ({ providerId, completions: count })
      ),
    };
  }
}

export const fraudPreventionService = new FraudPreventionService();
