import express from "express";
import smsWebhookRoutes from "./smsRoutes.js";
import tasksRoutes from "./taskRoutes.js";
import reportsRoutes from "./reportRoutes.js";
import missionRoutes from "./missionRoutes.js";

const router = express.Router();

router.use(smsWebhookRoutes);
router.use(tasksRoutes);
router.use("/reports", reportsRoutes);
router.use(missionRoutes);

export default router;
