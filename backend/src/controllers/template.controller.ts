import { Request, Response } from "express";
import { TemplateService } from "../services/TemplateService.js";

export class TemplateController {
  /**
   * Create template
   * POST /api/templates
   */
  static async createTemplate(req: Request, res: Response) {
    try {
      const userId = req.user?._id.toString();
      const templateData = req.body;

      const template = await TemplateService.createTemplate(
        templateData,
        userId
      );

      res.status(201).json({
        success: true,
        message: "Template created successfully",
        data: template,
      });
    } catch (error: any) {
      console.error("Create template error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create template",
        error: error.message,
      });
    }
  }

  /**
   * Get templates with filtering
   * GET /api/templates
   */
  static async getTemplates(req: Request, res: Response) {
    try {
      const { category, platform, isOfficial, search, limit, skip } = req.query;

      const filters = {
        category: category as string,
        platform: platform as string,
        isOfficial:
          isOfficial === "true"
            ? true
            : isOfficial === "false"
            ? false
            : undefined,
        search: search as string,
        limit: limit ? parseInt(limit as string) : undefined,
        skip: skip ? parseInt(skip as string) : undefined,
      };

      const result = await TemplateService.getTemplates(filters);

      res.status(200).json({
        success: true,
        data: result.templates,
        total: result.total,
      });
    } catch (error: any) {
      console.error("Get templates error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get templates",
        error: error.message,
      });
    }
  }

  /**
   * Get template by ID
   * GET /api/templates/:id
   */
  static async getTemplateById(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const template = await TemplateService.getTemplateById(id);

      if (!template) {
        return res.status(404).json({
          success: false,
          message: "Template not found",
        });
      }

      res.status(200).json({
        success: true,
        data: template,
      });
    } catch (error: any) {
      console.error("Get template error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get template",
        error: error.message,
      });
    }
  }

  /**
   * Apply template with variables
   * POST /api/templates/:id/apply
   */
  static async applyTemplate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const { variables } = req.body;

      const template = await TemplateService.getTemplateById(id);

      if (!template) {
        return res.status(404).json({
          success: false,
          message: "Template not found",
        });
      }

      const appliedData = TemplateService.applyTemplate(
        template,
        variables || {}
      );

      // Increment usage count
      await TemplateService.incrementUsage(id);

      res.status(200).json({
        success: true,
        data: appliedData,
      });
    } catch (error: any) {
      console.error("Apply template error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to apply template",
        error: error.message,
      });
    }
  }

  /**
   * Update template
   * PUT /api/templates/:id
   */
  static async updateTemplate(req: Request, res: Response) {
    try {
      const { id } = req.params;
      const updates = req.body;

      const template = await TemplateService.updateTemplate(id, updates);

      if (!template) {
        return res.status(404).json({
          success: false,
          message: "Template not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Template updated successfully",
        data: template,
      });
    } catch (error: any) {
      console.error("Update template error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update template",
        error: error.message,
      });
    }
  }

  /**
   * Delete template
   * DELETE /api/templates/:id
   */
  static async deleteTemplate(req: Request, res: Response) {
    try {
      const { id } = req.params;

      const deleted = await TemplateService.deleteTemplate(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: "Template not found",
        });
      }

      res.status(200).json({
        success: true,
        message: "Template deleted successfully",
      });
    } catch (error: any) {
      console.error("Delete template error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete template",
        error: error.message,
      });
    }
  }

  /**
   * Get popular templates
   * GET /api/templates/popular
   */
  static async getPopularTemplates(req: Request, res: Response) {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;

      const templates = await TemplateService.getPopularTemplates(limit);

      res.status(200).json({
        success: true,
        data: templates,
      });
    } catch (error: any) {
      console.error("Get popular templates error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get popular templates",
        error: error.message,
      });
    }
  }
}
