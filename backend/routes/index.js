import express from "express";
import smsWebhookRoutes from "./smsRoutes.js";
import tasksRoutes from "./taskRoutes.js";
import reportsRoutes from "./reportRoutes.js";
import missionRoutes from "./missionRoutes.js";
import weatherRoutes from "./weatherRoutes.js";
import roadConditionRoutes from "./roadConditionRoutes.js";
import missingPersonRoutes from "./missingPersonRoutes.js";
import shelterRoutes from "./shelterRoutes.js";
import authRoutes from "./authRoutes.js";

const router = express.Router();

router.use(authRoutes);
router.use(smsWebhookRoutes);
router.use(tasksRoutes);
router.use("/reports", reportsRoutes);
router.use(missionRoutes);
router.use(weatherRoutes);
router.use(roadConditionRoutes);
router.use(missingPersonRoutes);
router.use(shelterRoutes);

export default router;
