import User from "../models/UserModel.js";

/**
 * Middleware to require authentication via PIN header
 */
export const requireAuth = async (req, res, next) => {
  try {
    const pin = req.headers["x-auth-pin"];

    if (!pin) {
      return res.status(401).json({
        success: false,
        message: "Authentication required. Please provide your PIN.",
      });
    }

    const user = await User.findOne({ pin, isActive: true });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid or expired PIN",
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

/**
 * Middleware to require manager role
 */
export const requireManager = async (req, res, next) => {
  try {
    const pin = req.headers["x-auth-pin"];

    if (!pin) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    const user = await User.findOne({ pin, isActive: true });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid PIN",
      });
    }

    if (user.role !== "manager") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Manager privileges required.",
      });
    }

    req.user = user;
    next();
  } catch (error) {
    console.error("Manager auth error:", error);
    res.status(500).json({
      success: false,
      message: "Authorization failed",
    });
  }
};
