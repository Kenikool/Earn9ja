import { Request, Response } from "express";
import { DraftService } from "../services/DraftService.js";

export class DraftController {
  /**
   * Save or update draft
   * POST /api/tasks/drafts
   */
  static async saveDraft(req: Request, res: Response) {
    try {
      const userId = req.user?._id.toString();
      const { formData } = req.body;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      if (!formData) {
        return res.status(400).json({
          success: false,
          message: "Form data is required",
        });
      }

      // Validate draft data
      if (!DraftService.validateDraftData(formData)) {
        return res.status(400).json({
          success: false,
          message: "Invalid form data",
        });
      }

      const draft = await DraftService.saveDraft(userId, formData);

      res.status(200).json({
        success: true,
        message: "Draft saved successfully",
        data: {
          id: draft._id,
          lastSaved: draft.lastSaved,
          expiresAt: draft.expiresAt,
        },
      });
    } catch (error: any) {
      console.error("Error saving draft:", error);
      res.status(500).json({
        success: false,
        message: "Failed to save draft",
        error: error.message,
      });
    }
  }

  /**
   * Get user's draft
   * GET /api/tasks/drafts
   */
  static async getDraft(req: Request, res: Response) {
    try {
      const userId = req.user?._id.toString();

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const draft = await DraftService.getDraft(userId);

      if (!draft) {
        return res.status(404).json({
          success: false,
          message: "No draft found",
        });
      }

      const age = DraftService.getDraftAge(draft);

      res.status(200).json({
        success: true,
        data: {
          id: draft._id,
          formData: draft.formData,
          lastSaved: draft.lastSaved,
          expiresAt: draft.expiresAt,
          ageInHours: age,
        },
      });
    } catch (error: any) {
      console.error("Error getting draft:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get draft",
        error: error.message,
      });
    }
  }

  /**
   * Delete user's draft
   * DELETE /api/tasks/drafts
   */
  static async deleteDraft(req: Request, res: Response) {
    try {
      const userId = req.user?._id.toString();

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized",
        });
      }

      const deleted = await DraftService.deleteDraft(userId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: "No draft found to delete",
        });
      }

      res.status(200).json({
        success: true,
        message: "Draft deleted successfully",
      });
    } catch (error: any) {
      console.error("Error deleting draft:", error);
      res.status(500).json({
        success: false,
        message: "Failed to delete draft",
        error: error.message,
      });
    }
  }

  /**
   * Cleanup expired drafts (admin/cron only)
   * POST /api/tasks/drafts/cleanup
   */
  static async cleanupExpiredDrafts(req: Request, res: Response) {
    try {
      const deletedCount = await DraftService.cleanupExpiredDrafts();

      res.status(200).json({
        success: true,
        message: `Cleaned up ${deletedCount} expired drafts`,
        data: { deletedCount },
      });
    } catch (error: any) {
      console.error("Error cleaning up drafts:", error);
      res.status(500).json({
        success: false,
        message: "Failed to cleanup drafts",
        error: error.message,
      });
    }
  }
}
