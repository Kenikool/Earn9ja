import { TaskTargeting, ITaskTargeting } from "../models/TaskTargeting";
import { User } from "../models/User";
import mongoose from "mongoose";

export class TargetingService {
  /**
   * Create targeting for a task
   */
  static async createTargeting(
    taskId: string,
    targetingData: Partial<ITaskTargeting>
  ): Promise<ITaskTargeting> {
    // Calculate estimated audience and pricing multiplier
    const estimatedAudience = await this.estimateAudience(targetingData);
    const pricingMultiplier = this.calculatePricingMultiplier(targetingData);

    const targeting = new TaskTargeting({
      taskId: new mongoose.Types.ObjectId(taskId),
      ...targetingData,
      estimatedAudience,
      pricingMultiplier,
    });

    return targeting.save();
  }

  /**
   * Get targeting for a task
   */
  static async getTargeting(taskId: string): Promise<ITaskTargeting | null> {
    return TaskTargeting.findOne({
      taskId: new mongoose.Types.ObjectId(taskId),
    });
  }

  /**
   * Update targeting
   */
  static async updateTargeting(
    taskId: string,
    updates: Partial<ITaskTargeting>
  ): Promise<ITaskTargeting | null> {
    // Recalculate estimates
    const estimatedAudience = await this.estimateAudience(updates);
    const pricingMultiplier = this.calculatePricingMultiplier(updates);

    return TaskTargeting.findOneAndUpdate(
      { taskId: new mongoose.Types.ObjectId(taskId) },
      {
        ...updates,
        estimatedAudience,
        pricingMultiplier,
      },
      { new: true, runValidators: true }
    );
  }

  /**
   * Delete targeting
   */
  static async deleteTargeting(taskId: string): Promise<boolean> {
    const result = await TaskTargeting.deleteOne({
      taskId: new mongoose.Types.ObjectId(taskId),
    });
    return result.deletedCount > 0;
  }

  /**
   * Estimate audience size based on targeting criteria
   */
  static async estimateAudience(
    targetingData: Partial<ITaskTargeting>
  ): Promise<number> {
    const query: any = { role: "worker", isActive: true };

    // Geographic filtering
    if (targetingData.geographic) {
      const { countries, states, cities } = targetingData.geographic;

      if (countries && countries.length > 0) {
        query["profile.country"] = { $in: countries };
      }

      if (states && states.length > 0) {
        query["profile.state"] = { $in: states };
      }

      if (cities && cities.length > 0) {
        query["profile.city"] = { $in: cities };
      }
    }

    // Demographic filtering
    if (targetingData.demographic) {
      const { ageRange, gender } = targetingData.demographic;

      if (ageRange) {
        const currentYear = new Date().getFullYear();
        const maxBirthYear = currentYear - ageRange.min;
        const minBirthYear = currentYear - ageRange.max;

        query["profile.dateOfBirth"] = {
          $gte: new Date(`${minBirthYear}-01-01`),
          $lte: new Date(`${maxBirthYear}-12-31`),
        };
      }

      if (gender && gender !== "all") {
        query["profile.gender"] = gender;
      }
    }

    // User criteria filtering
    if (targetingData.userCriteria) {
      const { minReputationLevel, minCompletionRate, minTasksCompleted } =
        targetingData.userCriteria;

      if (minReputationLevel !== undefined) {
        query["reputation.level"] = { $gte: minReputationLevel };
      }

      if (minCompletionRate !== undefined) {
        query["stats.completionRate"] = { $gte: minCompletionRate };
      }

      if (minTasksCompleted !== undefined) {
        query["stats.tasksCompleted"] = { $gte: minTasksCompleted };
      }
    }

    const count = await User.countDocuments(query);
    return count;
  }

  /**
   * Calculate pricing multiplier based on targeting specificity
   */
  static calculatePricingMultiplier(
    targetingData: Partial<ITaskTargeting>
  ): number {
    let multiplier = 1.0;

    // Geographic targeting adds cost
    if (targetingData.geographic) {
      const { countries, states, cities, radius } = targetingData.geographic;

      if (countries && countries.length > 0 && countries.length <= 3) {
        multiplier += 0.1;
      }

      if (states && states.length > 0) {
        multiplier += 0.15;
      }

      if (cities && cities.length > 0) {
        multiplier += 0.2;
      }

      if (radius) {
        multiplier += 0.25;
      }
    }

    // Demographic targeting adds cost
    if (targetingData.demographic) {
      const { ageRange, gender } = targetingData.demographic;

      if (ageRange) {
        const range = ageRange.max - ageRange.min;
        if (range < 20) {
          multiplier += 0.15;
        }
      }

      if (gender && gender !== "all") {
        multiplier += 0.1;
      }
    }

    // User criteria targeting adds cost
    if (targetingData.userCriteria) {
      const { minReputationLevel, minCompletionRate, minTasksCompleted } =
        targetingData.userCriteria;

      if (minReputationLevel && minReputationLevel >= 3) {
        multiplier += 0.2;
      }

      if (minCompletionRate && minCompletionRate >= 80) {
        multiplier += 0.15;
      }

      if (minTasksCompleted && minTasksCompleted >= 50) {
        multiplier += 0.1;
      }
    }

    // Cap multiplier at 3.0x
    return Math.min(multiplier, 3.0);
  }

  /**
   * Check if a user matches targeting criteria
   */
  static async userMatchesTargeting(
    userId: string,
    targeting: ITaskTargeting
  ): Promise<boolean> {
    const user = await User.findById(userId);
    if (!user) return false;

    // Check geographic targeting
    if (targeting.geographic) {
      const { countries, states, cities } = targeting.geographic;

      // Note: country targeting not implemented in user profile yet
      // if (countries && countries.length > 0) {
      //   return false;
      // }

      if (
        states &&
        states.length > 0 &&
        !states.includes(user.profile?.location?.state || "")
      ) {
        return false;
      }

      if (
        cities &&
        cities.length > 0 &&
        !cities.includes(user.profile?.location?.city || "")
      ) {
        return false;
      }
    }

    // Check demographic targeting
    if (targeting.demographic) {
      const { ageRange, gender } = targeting.demographic;

      if (ageRange && user.profile?.dateOfBirth) {
        const age = this.calculateAge(user.profile.dateOfBirth);
        if (age < ageRange.min || age > ageRange.max) {
          return false;
        }
      }

      if (gender && gender !== "all" && user.profile?.gender !== gender) {
        return false;
      }
    }

    // Check user criteria
    if (targeting.userCriteria) {
      const { minReputationLevel, minCompletionRate, minTasksCompleted } =
        targeting.userCriteria;

      if (
        minReputationLevel !== undefined &&
        (user.reputation?.level || 0) < minReputationLevel
      ) {
        return false;
      }

      if (
        minCompletionRate !== undefined &&
        (user.reputation?.approvalRate || 0) < minCompletionRate
      ) {
        return false;
      }

      if (
        minTasksCompleted !== undefined &&
        (user.reputation?.totalTasksCompleted || 0) < minTasksCompleted
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate age from date of birth
   */
  private static calculateAge(dateOfBirth: Date): number {
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    return age;
  }

  /**
   * Get Nigerian states
   */
  static getNigerianStates(): string[] {
    return [
      "Abia",
      "Adamawa",
      "Akwa Ibom",
      "Anambra",
      "Bauchi",
      "Bayelsa",
      "Benue",
      "Borno",
      "Cross River",
      "Delta",
      "Ebonyi",
      "Edo",
      "Ekiti",
      "Enugu",
      "FCT",
      "Gombe",
      "Imo",
      "Jigawa",
      "Kaduna",
      "Kano",
      "Katsina",
      "Kebbi",
      "Kogi",
      "Kwara",
      "Lagos",
      "Nasarawa",
      "Niger",
      "Ogun",
      "Ondo",
      "Osun",
      "Oyo",
      "Plateau",
      "Rivers",
      "Sokoto",
      "Taraba",
      "Yobe",
      "Zamfara",
    ];
  }

  /**
   * Get major Nigerian cities
   */
  static getMajorCities(): string[] {
    return [
      "Lagos",
      "Kano",
      "Ibadan",
      "Abuja",
      "Port Harcourt",
      "Benin City",
      "Kaduna",
      "Enugu",
      "Aba",
      "Ilorin",
      "Jos",
      "Warri",
      "Calabar",
      "Onitsha",
      "Maiduguri",
      "Zaria",
      "Owerri",
      "Uyo",
      "Abeokuta",
      "Akure",
    ];
  }
}
