import config from "../config/index.js";

/**
 * Log levels
 */
const LOG_LEVELS = {
  DEBUG: "debug",
  INFO: "info",
  WARN: "warn",
  ERROR: "error",
};

/**
 * Simple logger utility with different log levels
 */
class Logger {
  constructor() {
    this.level = config.logging?.level || LOG_LEVELS.INFO;
  }

  /**
   * Check if log level should be printed
   */
  shouldLog(level) {
    const levels = [
      LOG_LEVELS.DEBUG,
      LOG_LEVELS.INFO,
      LOG_LEVELS.WARN,
      LOG_LEVELS.ERROR,
    ];
    const currentLevelIndex = levels.indexOf(this.level);
    const requestedLevelIndex = levels.indexOf(level);
    return requestedLevelIndex >= currentLevelIndex;
  }

  /**
   * Format log message with level
   */
  format(level, message, ...args) {
    const levelUpper = level.toUpperCase();
    return [`[${levelUpper}]`, message, ...args];
  }

  /**
   * Debug level logging
   */
  debug(message, ...args) {
    if (this.shouldLog(LOG_LEVELS.DEBUG)) {
      console.log(...this.format(LOG_LEVELS.DEBUG, message, ...args));
    }
  }

  /**
   * Info level logging
   */
  info(message, ...args) {
    if (this.shouldLog(LOG_LEVELS.INFO)) {
      console.log(...this.format(LOG_LEVELS.INFO, message, ...args));
    }
  }

  /**
   * Warning level logging
   */
  warn(message, ...args) {
    if (this.shouldLog(LOG_LEVELS.WARN)) {
      console.warn(...this.format(LOG_LEVELS.WARN, message, ...args));
    }
  }

  /**
   * Error level logging
   */
  error(message, ...args) {
    if (this.shouldLog(LOG_LEVELS.ERROR)) {
      console.error(...this.format(LOG_LEVELS.ERROR, message, ...args));
    }
  }
}

// Export singleton instance
export const logger = new Logger();
