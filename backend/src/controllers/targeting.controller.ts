import { Request, Response } from "express";
import { TargetingService } from "../services/TargetingService.js";

export class TargetingController {
  /**
   * Create targeting for a task
   * POST /api/tasks/:taskId/targeting
   */
  static async createTargeting(req: Request, res: Response) {
    try {
      const { taskId } = req.params;
      const targetingData = req.body;

      const targeting = await TargetingService.createTargeting(
        taskId,
        targetingData
      );

      res.status(201).json({
        success: true,
        message: "Targeting created successfully",
        data: targeting,
      });
    } catch (error: any) {
      console.error("Create targeting error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create targeting",
        error: error.message,
      });
    }
  }

  /**
   * Get targeting for a task
   * GET /api/tasks/:taskId/targeting
   */
  static async getTargeting(req: Request, res: Response) {
    try {
      const { taskId } = req.params;

      const targeting = await TargetingService.getTargeting(taskId);

      if (!targeting) {
        return res.status(404).json({
          success: false,
          message: "Targeting not found",
        });
      }

      res.status(200).json({
        success: true,
        data: targeting,
      });
    } catch (error: any) {
      console.error("Get targeting error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get targeting",
        error: error.message,
      });
    }
  }

  /**
   * Update targeting
   * PUT /api/tasks/:taskId/targeting
   */
  static async updateTargeting(req: Request, res: Response) {
    try {
      const { taskId } = req.params;
      const updates = req.body;

      const targeting = await TargetingService.updateTargeting(taskId, updates);

      if (!targeting) {
        return res.status(404).json({
          success: false,
          message: "Targeting not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Targeting updated successfully",
        data: targeting,
      });
    } catch (error: any) {
      console.error("Update targeting error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update targeting",
        error: error.message,
      });
    }
  }

  /**
   * Delete targeting
   * DELETE /api/tasks/:taskId/targeting
   */
  static async deleteTargeting(req: Request, res: Response) {
    try {
      const { taskId } = req.params;

      const deleted = await TargetingService.deleteTargeting(taskId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: "Targeting not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Targeting deleted successfully",
      });
    } catch (error: any) {
      console.error("Delete targeting error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete targeting",
        error: error.message,
      });
    }
  }

  /**
   * Estimate audience size
   * POST /api/targeting/estimate
   */
  static async estimateAudience(req: Request, res: Response) {
    try {
      const targetingData = req.body;

      const estimatedAudience = await TargetingService.estimateAudience(
        targetingData
      );
      const pricingMultiplier =
        TargetingService.calculatePricingMultiplier(targetingData);

      res.status(200).json({
        success: true,
        data: {
          estimatedAudience,
          pricingMultiplier,
        },
      });
    } catch (error: any) {
      console.error("Estimate audience error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to estimate audience",
        error: error.message,
      });
    }
  }

  /**
   * Get Nigerian states
   * GET /api/targeting/states
   */
  static async getStates(req: Request, res: Response) {
    try {
      const states = TargetingService.getNigerianStates();

      res.status(200).json({
        success: true,
        data: states,
      });
    } catch (error: any) {
      console.error("Get states error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get states",
        error: error.message,
      });
    }
  }

  /**
   * Get major cities
   * GET /api/targeting/cities
   */
  static async getCities(req: Request, res: Response) {
    try {
      const cities = TargetingService.getMajorCities();

      res.status(200).json({
        success: true,
        data: cities,
      });
    } catch (error: any) {
      console.error("Get cities error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get cities",
        error: error.message,
      });
    }
  }
}
