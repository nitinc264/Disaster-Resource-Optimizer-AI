import User from "../models/UserModel.js";

// Simple in-memory user cache to reduce DB queries per request
const userCache = new Map();
const USER_CACHE_TTL = 60 * 1000; // 1 minute
const MAX_CACHE_SIZE = 200;

function getCachedUser(key) {
  const entry = userCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > USER_CACHE_TTL) {
    userCache.delete(key);
    return null;
  }
  return entry.user;
}

function setCachedUser(key, user) {
  // Evict oldest entries if cache is full
  if (userCache.size >= MAX_CACHE_SIZE) {
    const oldest = userCache.keys().next().value;
    userCache.delete(oldest);
  }
  userCache.set(key, { user, ts: Date.now() });
}

/** Invalidate cache for a user (e.g. on deactivation) */
export function invalidateUserCache(userId) {
  for (const [key, entry] of userCache) {
    if (entry.user?._id?.toString() === userId?.toString()) {
      userCache.delete(key);
    }
  }
}

/**
 * Middleware to require authentication via session or PIN header
 * Sessions persist for 24 hours
 */
export const requireAuth = async (req, res, next) => {
  try {
    // First check session (24-hour persistent login)
    if (req.session && req.session.userId) {
      const cacheKey = `id:${req.session.userId}`;
      let user = getCachedUser(cacheKey);
      if (!user) {
        user = await User.findOne({
          _id: req.session.userId,
          isActive: true,
        });
        if (user) setCachedUser(cacheKey, user);
      }
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

    const cacheKey = `pin:${pin}`;
    let user = getCachedUser(cacheKey);
    if (!user) {
      user = await User.findByPin(pin);
      if (user) setCachedUser(cacheKey, user);
    }

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
      const cacheKey = `id:${req.session.userId}`;
      let user = getCachedUser(cacheKey);
      if (!user) {
        user = await User.findOne({
          _id: req.session.userId,
          isActive: true,
          role: "manager",
        });
        if (user) setCachedUser(cacheKey, user);
      }
      if (user && user.role === "manager") {
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

    const cacheKey = `pin:${pin}`;
    let user = getCachedUser(cacheKey);
    if (!user) {
      user = await User.findByPin(pin);
      if (user) setCachedUser(cacheKey, user);
    }

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

/**
 * Middleware that allows public access but still attaches user if authenticated
 * Use this for endpoints that should work for both public and authenticated users
 */
export const allowPublic = async (req, res, next) => {
  try {
    // Check session first
    if (req.session && req.session.userId) {
      const cacheKey = `id:${req.session.userId}`;
      let user = getCachedUser(cacheKey);
      if (!user) {
        user = await User.findOne({
          _id: req.session.userId,
          isActive: true,
        });
        if (user) setCachedUser(cacheKey, user);
      }
      if (user) {
        req.user = user;
        return next();
      }
    }

    // Check PIN header
    const pin = req.headers["x-auth-pin"];
    if (pin) {
      const cacheKey = `pin:${pin}`;
      let user = getCachedUser(cacheKey);
      if (!user) {
        user = await User.findByPin(pin);
        if (user) setCachedUser(cacheKey, user);
      }
      if (user) {
        req.user = user;
        return next();
      }
    }

    // No authentication - allow as public user
    req.user = null;
    req.isPublicUser = true;
    next();
  } catch (error) {
    console.error("Public auth middleware error:", error);
    // Still allow public access on error
    req.user = null;
    req.isPublicUser = true;
    next();
  }
};
