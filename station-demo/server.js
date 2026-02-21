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
import resourceRoutes from "./routes/resourceRoutes.js";
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
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// Make io available to routes
app.set("io", io);
app.set("stationConfig", stationConfig);

// Middleware
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  }),
);
app.use(express.json({ limit: "1mb" }));

// Simple in-memory rate limiter (100 requests per minute per IP)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60_000; // 1 minute
const RATE_LIMIT_MAX = 100;
app.use((req, res, next) => {
  const ip = req.ip;
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(ip, { start: now, count: 1 });
    return next();
  }
  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    return res.status(429).json({ success: false, error: "Too many requests" });
  }
  next();
});
// Periodically clean up stale entries
setInterval(() => {
  const now = Date.now();
  for (const [ip, entry] of rateLimitMap) {
    if (now - entry.start > RATE_LIMIT_WINDOW) rateLimitMap.delete(ip);
  }
}, RATE_LIMIT_WINDOW);

app.use(express.static(path.join(__dirname, "public")));
app.use("/sounds", express.static(path.join(__dirname, "alert sound")));

// Request logging
app.use((req, res, next) => {
  console.log(`[${stationConfig.name}] ${req.method} ${req.path}`);
  next();
});

// API Routes
app.use("/api", alertRoutes);
app.use("/api", resourceRoutes);

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
    status: "active",
  });
});

// Serve the frontend
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Socket.IO connection handling
const STATION_SOCKET_TOKEN = process.env.STATION_SOCKET_TOKEN || null;

io.use((socket, next) => {
  // If a token is configured, require it for connections
  if (STATION_SOCKET_TOKEN) {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token !== STATION_SOCKET_TOKEN) {
      return next(new Error("Authentication failed: invalid token"));
    }
  }
  next();
});

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
        { new: true },
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
          `[${stationConfig.name}] Alert ${alertId} status: ${status}`,
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
