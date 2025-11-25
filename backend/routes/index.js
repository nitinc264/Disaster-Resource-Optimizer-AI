import express from "express";
import smsWebhookRoutes from "./smsRoutes.js";
import tasksRoutes from "./taskRoutes.js";
import optimizationRoutes from "./optimizationRoutes.js";
import reportsRoutes from "./reportRoutes.js";

const router = express.Router();

router.use(smsWebhookRoutes);
router.use(tasksRoutes);
router.use(optimizationRoutes);
router.use("/reports", reportsRoutes);

export default router;
