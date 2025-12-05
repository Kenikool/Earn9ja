import { Request, Response } from "express";
import { ImageService } from "../services/ImageService.js";

export class UploadController {
  static async uploadImages(req: Request, res: Response) {
    try {
      const files = req.files as Express.Multer.File[];
      const { taskId } = req.body;

      if (!files || files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }

      if (files.length > 5) {
        return res.status(400).json({ error: "Maximum 5 images allowed" });
      }

      const uploadedImages = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Compress image
        const compressedBuffer = await ImageService.compressImage(file.buffer);

        // Upload to Cloudinary
        const { url } = await ImageService.uploadToCloudinary(
          compressedBuffer,
          file.originalname
        );

        // Save to database if taskId provided
        let savedImage = null;
        if (taskId) {
          savedImage = await ImageService.saveTaskImage(
            taskId,
            url,
            file.originalname,
            compressedBuffer.length,
            i
          );
        }

        uploadedImages.push({
          id: savedImage?._id,
          url,
          filename: file.originalname,
          size: compressedBuffer.length,
          order: i,
        });
      }

      res.status(200).json({
        success: true,
        images: uploadedImages,
      });
    } catch (error: any) {
      console.error("Image upload error:", error);
      res.status(500).json({
        error: "Failed to upload images",
        message: error.message,
      });
    }
  }

  static async getTaskImages(req: Request, res: Response) {
    try {
      const { taskId } = req.params;

      const images = await ImageService.getTaskImages(taskId);

      res.status(200).json({
        success: true,
        images,
      });
    } catch (error: any) {
      console.error("Get images error:", error);
      res.status(500).json({
        error: "Failed to retrieve images",
        message: error.message,
      });
    }
  }

  static async deleteImage(req: Request, res: Response) {
    try {
      const { imageId } = req.params;

      await ImageService.deleteTaskImage(imageId);

      res.status(200).json({
        success: true,
        message: "Image deleted successfully",
      });
    } catch (error: any) {
      console.error("Delete image error:", error);
      res.status(500).json({
        error: "Failed to delete image",
        message: error.message,
      });
    }
  }
}
