import express from "express";
import {
  loginWithPin,
  registerVolunteer,
  getVolunteers,
  getCurrentUser,
  deactivateVolunteer,
} from "../controllers/authController.js";
import { requireAuth, requireManager } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.post("/auth/login", loginWithPin);

// Protected routes (require authentication)
router.get("/auth/me", requireAuth, getCurrentUser);

// Manager-only routes
router.post("/auth/register", requireManager, registerVolunteer);
router.get("/auth/volunteers", requireManager, getVolunteers);
router.delete("/auth/volunteers/:id", requireManager, deactivateVolunteer);

export default router;
