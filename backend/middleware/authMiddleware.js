import User from "../models/UserModel.js";

/**
 * Middleware to require authentication via session or PIN header
 * Sessions persist for 24 hours
 */
export const requireAuth = async (req, res, next) => {
  try {
    // First check session (24-hour persistent login)
    if (req.session && req.session.userId) {
      const user = await User.findOne({
        _id: req.session.userId,
        isActive: true,
      });
      if (user) {
        req.user = user;
        return next();
      }
      // Session exists but user not found/inactive - clear session
      req.session.destroy();
    }

    // Fallback to PIN header authentication
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
    // First check session
    if (
      req.session &&
      req.session.userId &&
      req.session.userRole === "manager"
    ) {
      const user = await User.findOne({
        _id: req.session.userId,
        isActive: true,
        role: "manager",
      });
      if (user) {
        req.user = user;
        return next();
      }
    }

    // Fallback to PIN header
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
