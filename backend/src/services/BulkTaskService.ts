import { taskService } from "./TaskService.js";
import { parse } from "csv-parse/sync";
import mongoose from "mongoose";

export interface BulkTaskData {
  title: string;
  description: string;
  category: string;
  platform?: string;
  taskType?: string;
  reward: number;
  totalSlots: number;
  estimatedTime?: number;
  targetUrl?: string;
  requirements?: string[];
  expiresAt?: string;
}

export interface BulkValidationError {
  row: number;
  field: string;
  message: string;
  value?: any;
}

export interface BulkCreationResult {
  success: boolean;
  totalRows: number;
  successCount: number;
  failureCount: number;
  createdTasks: any[];
  errors: BulkValidationError[];
}

export class BulkTaskService {
  /**
   * Parse CSV content
   */
  static parseCSV(csvContent: string): any[] {
    try {
      const records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });

      return records;
    } catch (error: any) {
      throw new Error(`CSV parsing error: ${error.message}`);
    }
  }

  /**
   * Validate bulk task data
   */
  static validateBulkData(data: any[]): {
    valid: BulkTaskData[];
    errors: BulkValidationError[];
  } {
    const valid: BulkTaskData[] = [];
    const errors: BulkValidationError[] = [];

    data.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because index starts at 0 and row 1 is header
      const rowErrors: BulkValidationError[] = [];

      // Required fields validation
      if (!row.title || row.title.trim() === "") {
        rowErrors.push({
          row: rowNumber,
          field: "title",
          message: "Title is required",
          value: row.title,
        });
      }

      if (!row.description || row.description.trim() === "") {
        rowErrors.push({
          row: rowNumber,
          field: "description",
          message: "Description is required",
          value: row.description,
        });
      }

      if (!row.category || row.category.trim() === "") {
        rowErrors.push({
          row: rowNumber,
          field: "category",
          message: "Category is required",
          value: row.category,
        });
      }

      if (!row.reward || isNaN(parseFloat(row.reward))) {
        rowErrors.push({
          row: rowNumber,
          field: "reward",
          message: "Reward must be a valid number",
          value: row.reward,
        });
      }

      if (!row.totalSlots || isNaN(parseInt(row.totalSlots))) {
        rowErrors.push({
          row: rowNumber,
          field: "totalSlots",
          message: "Total slots must be a valid number",
          value: row.totalSlots,
        });
      }

      // If there are errors for this row, add them and skip
      if (rowErrors.length > 0) {
        errors.push(...rowErrors);
        return;
      }

      // Parse requirements if present
      let requirements: string[] = [];
      if (row.requirements) {
        requirements = row.requirements
          .split("|")
          .map((r: string) => r.trim())
          .filter((r: string) => r.length > 0);
      }

      // Build valid task data
      const taskData: BulkTaskData = {
        title: row.title.trim(),
        description: row.description.trim(),
        category: row.category.trim(),
        platform: row.platform?.trim(),
        taskType: row.taskType?.trim(),
        reward: parseFloat(row.reward),
        totalSlots: parseInt(row.totalSlots),
        estimatedTime: row.estimatedTime
          ? parseInt(row.estimatedTime)
          : undefined,
        targetUrl: row.targetUrl?.trim(),
        requirements: requirements.length > 0 ? requirements : undefined,
        expiresAt: row.expiresAt?.trim(),
      };

      valid.push(taskData);
    });

    return { valid, errors };
  }

  /**
   * Create tasks in bulk
   */
  static async createBulkTasks(
    tasksData: BulkTaskData[],
    sponsorId: string
  ): Promise<BulkCreationResult> {
    const result: BulkCreationResult = {
      success: true,
      totalRows: tasksData.length,
      successCount: 0,
      failureCount: 0,
      createdTasks: [],
      errors: [],
    };

    // Use transaction for atomicity
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      for (let i = 0; i < tasksData.length; i++) {
        const taskData = tasksData[i];
        const rowNumber = i + 2;

        try {
          // Calculate expiry date
          let expiresAt = new Date();
          if (taskData.expiresAt) {
            expiresAt = new Date(taskData.expiresAt);
          } else {
            expiresAt.setDate(expiresAt.getDate() + 7); // Default 7 days
          }

          // Create task using TaskService
          const task = await taskService.createTask(
            {
              title: taskData.title,
              description: taskData.description,
              category: taskData.category,
              platform: taskData.platform,
              taskType: taskData.taskType,
              reward: taskData.reward,
              totalSlots: taskData.totalSlots,
              estimatedTime: taskData.estimatedTime,
              targetUrl: taskData.targetUrl,
              requirements: taskData.requirements || [],
              expiresAt: expiresAt.toISOString(),
              pricing: {
                minimumPrice: taskData.reward,
                maximumPrice: taskData.reward,
                currentPrice: taskData.reward,
              },
            },
            sponsorId
          );

          result.createdTasks.push({
            row: rowNumber,
            taskId: task._id,
            title: task.title,
          });
          result.successCount++;
        } catch (error: any) {
          result.errors.push({
            row: rowNumber,
            field: "general",
            message: error.message || "Failed to create task",
          });
          result.failureCount++;
        }
      }

      await session.commitTransaction();
    } catch (error: any) {
      await session.abortTransaction();
      result.success = false;
      throw error;
    } finally {
      session.endSession();
    }

    return result;
  }

  /**
   * Generate CSV template
   */
  static generateCSVTemplate(): string {
    const headers = [
      "title",
      "description",
      "category",
      "platform",
      "taskType",
      "reward",
      "totalSlots",
      "estimatedTime",
      "targetUrl",
      "requirements",
      "expiresAt",
    ];

    const exampleRow = [
      "Follow us on Instagram",
      "Follow our Instagram account and provide screenshot proof",
      "SOCIAL_MEDIA",
      "Instagram",
      "Follow",
      "50",
      "100",
      "2",
      "https://instagram.com/example",
      "Must have Instagram account|Follow the account|Take screenshot",
      "2024-12-31",
    ];

    return `${headers.join(",")}\n${exampleRow.join(",")}`;
  }

  /**
   * Apply template variables to bulk data
   */
  static applyTemplateVariables(
    templateData: any,
    variables: Record<string, string>[]
  ): BulkTaskData[] {
    return variables.map((varSet) => {
      let title = templateData.title;
      let description = templateData.description;
      let targetUrl = templateData.targetUrl || "";
      const requirements = [...(templateData.requirements || [])];

      // Replace variables
      Object.entries(varSet).forEach(([key, value]) => {
        const regex = new RegExp(`\\{${key}\\}`, "g");
        title = title.replace(regex, value);
        description = description.replace(regex, value);
        targetUrl = targetUrl.replace(regex, value);

        for (let i = 0; i < requirements.length; i++) {
          requirements[i] = requirements[i].replace(regex, value);
        }
      });

      return {
        title,
        description,
        category: templateData.category,
        platform: templateData.platform,
        taskType: templateData.taskType,
        reward: templateData.reward,
        totalSlots: templateData.totalSlots,
        estimatedTime: templateData.estimatedTime,
        targetUrl: targetUrl || undefined,
        requirements,
      };
    });
  }
}
