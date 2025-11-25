import config, { validateConfig } from "./config/index.js";
import { connectDatabase } from "./config/dbConnection.js";
import { createApp } from "./app.js";
import { logger } from "./utils/appLogger.js";

async function startServer() {
  try {
    // Validate configuration before starting
    validateConfig();
    logger.info("Configuration validated successfully");

    // Connect to database
    await connectDatabase(config.mongoUri);
    logger.info("Database connected successfully");

    // Create and start Express app
    const app = createApp();

    app.listen(config.port, () => {
      logger.info(`Server is running on port ${config.port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(
        `Twilio Webhook URL: http://localhost:${config.port}/api/sms`
      );
      logger.info(
        `Use ngrok to expose this URL for Twilio webhook configuration`
      );
    });
  } catch (error) {
    logger.error("Failed to start server:", error);
    process.exit(1);
  }
}

startServer();
