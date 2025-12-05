import { Request, Response } from "express";
import { DailyBonusService } from "../services/DailyBonusService.js";
import { SpinWheelService } from "../services/SpinWheelService.js";
import { ChallengeService } from "../services/ChallengeService.js";
import { LeaderboardService } from "../services/LeaderboardService.js";
import { AchievementService } from "../services/AchievementService.js";
import { ReputationService } from "../services/ReputationService.js";

class GamificationController {
  // Daily Bonus
  async getDailyBonusStatus(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const status = await DailyBonusService.getDailyBonusStatus(userId);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async claimDailyBonus(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const result = await DailyBonusService.claimDailyBonus(userId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async getStreakStats(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const stats = await DailyBonusService.getStreakStats(userId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  // Spin Wheel
  async getSpinStatus(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const status = await SpinWheelService.canSpin(userId);
      res.json(status);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async spin(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const result = await SpinWheelService.spin(userId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async grantExtraSpin(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const result = await SpinWheelService.grantExtraSpin(userId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  async getSpinStats(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const stats = await SpinWheelService.getSpinStats(userId);
      res.json(stats);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  // Challenges
  async getChallenges(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const challenges = await ChallengeService.getActiveChallenges(userId);
      res.json(challenges);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  async claimChallengeReward(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const { challengeId } = req.params;
      const result = await ChallengeService.claimReward(userId, challengeId);
      res.json(result);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }

  // Leaderboard
  async getLeaderboard(req: Request, res: Response) {
    try {
      const { type = "earnings", period = "weekly", limit = 50 } = req.query;
      console.log(
        `📊 Leaderboard request: type=${type}, period=${period}, limit=${limit}`
      );
      const leaderboard = await LeaderboardService.getLeaderboard({
        type: type as any,
        period: period as any,
        limit: Number(limit),
      });
      console.log(`📊 Leaderboard response: ${leaderboard.length} entries`);
      res.json(leaderboard);
    } catch (error: any) {
      console.error(`❌ Leaderboard error:`, error);
      res.status(500).json({ message: error.message });
    }
  }

  // Achievements
  async getAchievements(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const badges = await AchievementService.getUserBadges(userId);
      res.json(badges);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }

  // Reputation
  async getReputation(req: Request, res: Response) {
    try {
      const userId = req.user!.id;
      const reputation = await ReputationService.getUserReputation(userId);
      res.json(reputation);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  }
}

export const gamificationController = new GamificationController();
