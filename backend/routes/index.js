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
import routeRoutes from "./routeRoutes.js";
import emergencyStationRoutes from "./emergencyStationRoutes.js";
import volunteerMessageRoutes from "./volunteerMessageRoutes.js";
import analyticsRoutes from "./analyticsRoutes.js";
import resourceRoutes from "./resourceRoutes.js";

const router = express.Router();

// These route files define their own path prefixes internally
router.use(authRoutes); // /auth/*
router.use(smsWebhookRoutes); // /sms
router.use(tasksRoutes); // /tasks/*, /needs/*
router.use(missionRoutes); // /missions/*
router.use(weatherRoutes); // /weather/*
router.use(roadConditionRoutes); // /roads/*
router.use(missingPersonRoutes); // /missing-persons/*
router.use(shelterRoutes); // /shelters/*
router.use(routeRoutes); // /routes/*
router.use(volunteerMessageRoutes); // /volunteer-messages/*, /messages/*
router.use(analyticsRoutes); // /analytics

// These route files expect to be mounted at a prefix
router.use("/reports", reportsRoutes);
router.use("/emergency-stations", emergencyStationRoutes);
router.use("/resources", resourceRoutes);

export default router;
