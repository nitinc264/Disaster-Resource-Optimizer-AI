import express from "express";
import {
  getNeedsForMap,
  getUnverifiedTasks,
  getVerifiedTasks,
  verifyTask,
} from "../controllers/volunteerTaskController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

// All task routes require authentication (volunteer or manager)
router.get("/tasks/unverified", requireAuth, getUnverifiedTasks);
router.post("/tasks/verify", requireAuth, verifyTask);
router.get("/tasks/verified", requireAuth, getVerifiedTasks);
router.get("/needs/map", requireAuth, getNeedsForMap);

export default router;
