/**
 * Emergency Station Demo Server
 * A configurable server that simulates different emergency service stations
 */

import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";
import { fileURLToPath } from "url";

import { getStationConfig } from "./config/stationConfig.js";
import alertRoutes from "./routes/alertRoutes.js";
import Alert from "./models/AlertModel.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Get station configuration
const stationConfig = getStationConfig();

const app = express();
const httpServer = createServer(app);

// Socket.IO for real-time alerts
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// Make io available to routes
app.set("io", io);
app.set("stationConfig", stationConfig);

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/sounds", express.static(path.join(__dirname, "alert sound")));

// Request logging
app.use((req, res, next) => {
  console.log(`[${stationConfig.name}] ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use("/api", alertRoutes);

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "online",
    station: stationConfig.name,
    type: stationConfig.type,
    timestamp: new Date().toISOString(),
  });
});

// Station info endpoint
app.get("/api/station", (req, res) => {
  res.json({
    stationId: stationConfig.stationId,
    name: stationConfig.name,
    type: stationConfig.type,
    location: stationConfig.location,
    capabilities: stationConfig.capabilities,
    apiKey: stationConfig.apiKey,
    status: "active",
  });
});

// Serve the frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Socket.IO connection handling
io.on("connection", (socket) => {
  console.log(`[${stationConfig.name}] Dashboard connected: ${socket.id}`);

  // Send current alerts on connection
  Alert.find({ status: { $ne: "resolved" } })
    .sort({ createdAt: -1 })
    .limit(20)
    .then((alerts) => {
      socket.emit("initialAlerts", alerts);
    });

  socket.on("acknowledgeAlert", async (alertId) => {
    try {
      const alert = await Alert.findOneAndUpdate(
        { alertId },
        {
          status: "acknowledged",
          acknowledgedAt: new Date(),
        },
        { new: true }
      );

      if (alert) {
        io.emit("alertUpdated", alert);
        console.log(`[${stationConfig.name}] Alert ${alertId} acknowledged`);
      }
    } catch (error) {
      console.error("Error acknowledging alert:", error);
    }
  });

  socket.on("updateAlertStatus", async ({ alertId, status }) => {
    try {
      const updates = { status };
      if (status === "resolved") {
        updates.resolvedAt = new Date();
      }

      const alert = await Alert.findOneAndUpdate({ alertId }, updates, {
        new: true,
      });

      if (alert) {
        io.emit("alertUpdated", alert);
        console.log(
          `[${stationConfig.name}] Alert ${alertId} status: ${status}`
        );
      }
    } catch (error) {
      console.error("Error updating alert status:", error);
    }
  });

  socket.on("disconnect", () => {
    console.log(`[${stationConfig.name}] Dashboard disconnected: ${socket.id}`);
  });
});

// Connect to station's own database
const mongoUri =
  process.env[`MONGO_URI_${stationConfig.type.toUpperCase()}`] ||
  `mongodb://localhost:27017/emergency_station_${stationConfig.type}`;

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log(`[${stationConfig.name}] Connected to database`);

    // Start server
    const PORT = stationConfig.port;
    httpServer.listen(PORT, () => {
      console.log(`
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║   ${stationConfig.emoji}  ${stationConfig.name.padEnd(50)}║
║                                                              ║
║   Type: ${stationConfig.type.padEnd(52)}║
║   Port: ${String(PORT).padEnd(52)}║
║   Dashboard: http://localhost:${PORT}/                       ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
      `);
    });
  })
  .catch((err) => {
    console.error(`[${stationConfig.name}] Database connection error:`, err);
    process.exit(1);
  });

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log(`\n[${stationConfig.name}] Shutting down...`);
  await mongoose.connection.close();
  process.exit(0);
});
