import express from "express";
import {
  getNeedsForMap,
  getUnverifiedTasks,
  getVerifiedTasks,
  verifyTask,
} from "../controllers/volunteerTaskController.js";

const router = express.Router();

router.get("/tasks/unverified", getUnverifiedTasks);
router.post("/tasks/verify", verifyTask);
router.get("/tasks/verified", getVerifiedTasks);
router.get("/needs/map", getNeedsForMap);

export default router;
