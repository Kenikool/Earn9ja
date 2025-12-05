import { OfferWallTransaction } from "../models/OfferWallTransaction.js";
import { ExternalProvider } from "../models/ExternalProvider.js";
import { User } from "../models/User.js";
import { logger } from "../config/logger.js";
import { redis } from "../config/redis-wrapper.js";

interface UserPreferences {
  userId: string;
  preferredCategories: Array<{ category: string; score: number }>;
  preferredProviders: Array<{ providerId: string; score: number }>;
  avgCompletionValue: number;
  completionHistory: number;
}

interface RecommendedOffer {
  providerId: string;
  providerName: string;
  category: string;
  estimatedReward: number;
  matchScore: number;
  reason: string;
}

export class TaskRecommendationService {
  /**
   * Get personalized recommendations for user
   */
  async getRecommendations(
    userId: string,
    limit: number = 10
  ): Promise<RecommendedOffer[]> {
    try {
      // Get user preferences
      const preferences = await this.getUserPreferences(userId);

      // Get active providers
      const providers = await ExternalProvider.find({ status: "active" });

      // Score each provider
      const scoredProviders = providers.map((provider) => {
        const matchScore = this.calculateMatchScore(provider, preferences);

        return {
          providerId: provider.providerId,
          providerName: provider.name,
          category: provider.category,
          estimatedReward: this.estimateReward(provider, preferences),
          matchScore,
          reason: this.generateReason(provider, preferences, matchScore),
        };
      });

      // Sort by match score and return top recommendations
      return scoredProviders
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, limit);
    } catch (error) {
      logger.error("Error getting recommendations:", error);
      return [];
    }
  }

  /**
   * Analyze user preferences based on history
   */
  async getUserPreferences(userId: string): Promise<UserPreferences> {
    // Check cache first
    const cacheKey = `user:preferences:${userId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get user's transaction history
    const transactions = await OfferWallTransaction.find({
      userId,
      status: "completed",
    })
      .sort({ createdAt: -1 })
      .limit(100);

    if (transactions.length === 0) {
      // Return default preferences for new users
      return {
        userId,
        preferredCategories: [],
        preferredProviders: [],
        avgCompletionValue: 0,
        completionHistory: 0,
      };
    }

    // Calculate category preferences
    const categoryMap = new Map<
      string,
      { count: number; totalEarnings: number }
    >();
    const providerMap = new Map<
      string,
      { count: number; totalEarnings: number }
    >();

    let totalEarnings = 0;

    for (const transaction of transactions) {
      const category = transaction.offerCategory || "general";
      const providerId = transaction.providerId;

      // Update category stats
      if (!categoryMap.has(category)) {
        categoryMap.set(category, { count: 0, totalEarnings: 0 });
      }
      const catStats = categoryMap.get(category)!;
      catStats.count += 1;
      catStats.totalEarnings += transaction.userEarnings;

      // Update provider stats
      if (!providerMap.has(providerId)) {
        providerMap.set(providerId, { count: 0, totalEarnings: 0 });
      }
      const provStats = providerMap.get(providerId)!;
      provStats.count += 1;
      provStats.totalEarnings += transaction.userEarnings;

      totalEarnings += transaction.userEarnings;
    }

    // Calculate preference scores
    const preferredCategories = Array.from(categoryMap.entries())
      .map(([category, stats]) => ({
        category,
        score:
          (stats.count / transactions.length) * 0.5 +
          (stats.totalEarnings / totalEarnings) * 0.5,
      }))
      .sort((a, b) => b.score - a.score);

    const preferredProviders = Array.from(providerMap.entries())
      .map(([providerId, stats]) => ({
        providerId,
        score:
          (stats.count / transactions.length) * 0.5 +
          (stats.totalEarnings / totalEarnings) * 0.5,
      }))
      .sort((a, b) => b.score - a.score);

    const preferences: UserPreferences = {
      userId,
      preferredCategories,
      preferredProviders,
      avgCompletionValue: totalEarnings / transactions.length,
      completionHistory: transactions.length,
    };

    // Cache for 1 hour
    await redis.setex(cacheKey, 3600, JSON.stringify(preferences));

    return preferences;
  }

  /**
   * Calculate match score between provider and user preferences
   */
  private calculateMatchScore(
    provider: any,
    preferences: UserPreferences
  ): number {
    let score = 50; // Base score

    // Category match
    const categoryPref = preferences.preferredCategories.find(
      (c) => c.category === provider.category
    );
    if (categoryPref) {
      score += categoryPref.score * 30;
    }

    // Provider history match
    const providerPref = preferences.preferredProviders.find(
      (p) => p.providerId === provider.providerId
    );
    if (providerPref) {
      score += providerPref.score * 20;
    }

    // Commission rate (lower is better for user)
    score += (1 - provider.commissionRate) * 10;

    // Provider metrics
    if (provider.metrics.avgCompletionRate > 0.8) {
      score += 10;
    }

    return Math.min(score, 100);
  }

  /**
   * Estimate reward for user from provider
   */
  private estimateReward(provider: any, preferences: UserPreferences): number {
    if (preferences.avgCompletionValue > 0) {
      return preferences.avgCompletionValue * (1 - provider.commissionRate);
    }

    // Default estimate based on provider metrics
    return provider.metrics.totalRevenue > 0
      ? (provider.metrics.totalRevenue / provider.metrics.totalCompletions) *
          (1 - provider.commissionRate)
      : 500; // Default ₦500
  }

  /**
   * Generate recommendation reason
   */
  private generateReason(
    provider: any,
    preferences: UserPreferences,
    matchScore: number
  ): string {
    const reasons: string[] = [];

    const categoryPref = preferences.preferredCategories.find(
      (c) => c.category === provider.category
    );
    if (categoryPref && categoryPref.score > 0.3) {
      reasons.push(`You frequently complete ${provider.category} offers`);
    }

    const providerPref = preferences.preferredProviders.find(
      (p) => p.providerId === provider.providerId
    );
    if (providerPref && providerPref.score > 0.2) {
      reasons.push(`You've had success with ${provider.name} before`);
    }

    if (provider.commissionRate < 0.15) {
      reasons.push("Low commission rate means higher earnings");
    }

    if (provider.metrics.avgCompletionRate > 0.8) {
      reasons.push("High success rate");
    }

    if (matchScore > 80) {
      reasons.push("Highly recommended for you");
    }

    return reasons.length > 0 ? reasons.join(". ") : "Popular offer wall";
  }

  /**
   * Track user interaction with recommendation
   */
  async trackRecommendationClick(
    userId: string,
    providerId: string
  ): Promise<void> {
    try {
      const key = `recommendation:click:${userId}:${providerId}`;
      await redis.incr(key);
      await redis.expire(key, 86400 * 30); // 30 days
    } catch (error) {
      logger.error("Error tracking recommendation click:", error);
    }
  }

  /**
   * Get trending offers (high completion rate)
   */
  async getTrendingOffers(limit: number = 5): Promise<any[]> {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const trending = await OfferWallTransaction.aggregate([
        {
          $match: {
            status: "completed",
            createdAt: { $gte: sevenDaysAgo },
          },
        },
        {
          $group: {
            _id: "$providerId",
            providerName: { $first: "$providerName" },
            completions: { $sum: 1 },
            totalEarnings: { $sum: "$userEarnings" },
            avgEarnings: { $avg: "$userEarnings" },
          },
        },
        {
          $sort: { completions: -1 },
        },
        {
          $limit: limit,
        },
      ]);

      return trending.map((t) => ({
        providerId: t._id,
        providerName: t.providerName,
        completions: t.completions,
        avgEarnings: t.avgEarnings,
        trending: true,
      }));
    } catch (error) {
      logger.error("Error getting trending offers:", error);
      return [];
    }
  }

  /**
   * Clear user preferences cache
   */
  async clearUserPreferences(userId: string): Promise<void> {
    const cacheKey = `user:preferences:${userId}`;
    await redis.del(cacheKey);
  }
}

export const taskRecommendationService = new TaskRecommendationService();
