import { Router } from "express";
import { SupportController } from "../controllers/support.controller.js";
import { authenticate, requireRole } from "../middleware/auth.middleware.js";
import { body, param, query } from "express-validator";

const router = Router();

// All routes require authentication
router.use(authenticate);

// User routes - Support Tickets
router.post(
  "/tickets",
  [
    body("subject").notEmpty().withMessage("Subject is required"),
    body("description").notEmpty().withMessage("Description is required"),
    body("category")
      .isIn(["technical", "payment", "task", "account", "other"])
      .withMessage("Invalid category"),
    body("priority")
      .optional()
      .isIn(["low", "medium", "high"])
      .withMessage("Invalid priority"),
  ],
  SupportController.createTicket
);

router.get("/tickets", SupportController.getUserTickets);

router.get(
  "/tickets/:ticketId",
  param("ticketId").isUUID().withMessage("Invalid ticket ID"),
  SupportController.getTicketById
);

router.post(
  "/tickets/:ticketId/responses",
  [
    param("ticketId").isUUID().withMessage("Invalid ticket ID"),
    body("message").notEmpty().withMessage("Message is required"),
  ],
  SupportController.addResponse
);

// FAQ routes (public for authenticated users)
router.get("/faqs", SupportController.getFAQs);

router.get(
  "/faqs/:faqId",
  param("faqId").isUUID().withMessage("Invalid FAQ ID"),
  SupportController.getFAQById
);

router.post(
  "/faqs/:faqId/rate",
  [
    param("faqId").isUUID().withMessage("Invalid FAQ ID"),
    body("helpful").isBoolean().withMessage("Helpful must be a boolean"),
  ],
  SupportController.rateFAQ
);

// Admin routes
router.get(
  "/admin/tickets",
  requireRole("admin"),
  SupportController.getAllTickets
);

router.patch(
  "/admin/tickets/:ticketId/status",
  requireRole("admin"),
  [
    param("ticketId").isUUID().withMessage("Invalid ticket ID"),
    body("status")
      .isIn(["open", "in_progress", "resolved", "closed"])
      .withMessage("Invalid status"),
  ],
  SupportController.updateTicketStatus
);

router.patch(
  "/admin/tickets/:ticketId/assign",
  requireRole("admin"),
  [
    param("ticketId").isUUID().withMessage("Invalid ticket ID"),
    body("adminId").isUUID().withMessage("Invalid admin ID"),
  ],
  SupportController.assignTicket
);

router.get(
  "/admin/statistics",
  requireRole("admin"),
  SupportController.getSupportStatistics
);

// Admin FAQ management
router.post(
  "/admin/faqs",
  requireRole("admin"),
  [
    body("question").notEmpty().withMessage("Question is required"),
    body("answer").notEmpty().withMessage("Answer is required"),
    body("category")
      .isIn(["general", "tasks", "payments", "account", "technical"])
      .withMessage("Invalid category"),
  ],
  SupportController.createFAQ
);

router.patch(
  "/admin/faqs/:faqId",
  requireRole("admin"),
  param("faqId").isUUID().withMessage("Invalid FAQ ID"),
  SupportController.updateFAQ
);

router.delete(
  "/admin/faqs/:faqId",
  requireRole("admin"),
  param("faqId").isUUID().withMessage("Invalid FAQ ID"),
  SupportController.deleteFAQ
);

export default router;
