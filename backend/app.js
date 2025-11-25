import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import config from "./config/index.js";
import apiRouter from "./routes/index.js";
import { errorHandler, notFoundHandler } from "./middleware/index.js";
import { requestLogger } from "./middleware/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Creates and configures the Express application instance.
 * Keeping this logic isolated makes the HTTP layer easier to test and extend.
 */
export function createApp() {
  const app = express();

  // CORS middleware with configuration
  app.use(cors(config.cors));

  // Body parsing middleware
  app.use(express.urlencoded({ extended: false }));
  app.use(express.json());

  // Request logging middleware (only in development)
  if (config.logging.requests) {
    app.use(requestLogger);
  }

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({
      success: true,
      message: "Disaster Response Resource Optimization Platform API",
      version: "1.0.0",
      environment: config.nodeEnv,
    });
  });

  // API routes
  app.use("/api", apiRouter);

  // Serve static files in production
  if (config.nodeEnv === "production") {
    const frontendPath = path.join(__dirname, "../frontend/dist");
    app.use(express.static(frontendPath));

    // Handle SPA routing - send index.html for any other route not starting with /api
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        return next();
      }
      res.sendFile(path.join(frontendPath, "index.html"));
    });
  } else {
    // Development root handler
    app.get("/", (req, res) => {
      res.json({
        success: true,
        message: "Disaster Response Resource Optimization Platform API",
        version: "1.0.0",
        environment: config.nodeEnv,
      });
    });
  }

  // 404 handler - must be after all routes
  app.use(notFoundHandler);

  // Global error handler - must be last
  app.use(errorHandler);

  return app;
}

export default createApp;
