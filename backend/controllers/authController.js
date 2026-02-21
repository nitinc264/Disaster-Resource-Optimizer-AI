import User from "../models/UserModel.js";
import crypto from "crypto";

// Rate limiting for PIN login attempts (in-memory store)
const loginAttempts = new Map(); // key: IP, value: { count, lastAttempt, lockedUntil }
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000; // 5 minute window

function checkRateLimit(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (!record) return { allowed: true };

  // Check if currently locked out
  if (record.lockedUntil && now < record.lockedUntil) {
    const remainingSec = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, remainingSec };
  }

  // Reset if outside the attempt window
  if (now - record.lastAttempt > ATTEMPT_WINDOW_MS) {
    loginAttempts.delete(ip);
    return { allowed: true };
  }

  if (record.count >= MAX_LOGIN_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    const remainingSec = Math.ceil(LOCKOUT_DURATION_MS / 1000);
    return { allowed: false, remainingSec };
  }

  return { allowed: true };
}

function recordFailedAttempt(ip) {
  const now = Date.now();
  const record = loginAttempts.get(ip) || { count: 0, lastAttempt: now };
  record.count += 1;
  record.lastAttempt = now;
  loginAttempts.set(ip, record);
}

function clearAttempts(ip) {
  loginAttempts.delete(ip);
}

const ensureDefaultManager = async () => {
  // Only create a default manager if none exist at all
  const existing = await User.findOne({ role: "manager", isActive: true });
  if (existing) return;

  // Generate a secure random 4-digit PIN instead of using "0000"
  const defaultPin = String(Math.floor(1000 + Math.random() * 9000));
  await User.create({
    pin: defaultPin,
    name: "Default Manager",
    role: "manager",
    email: "admin@disaster-response.local",
    isActive: true,
  });
  console.log(`Default manager (self-heal) created with PIN: ${defaultPin}`);
};

/**
 * Generate a unique 4-digit PIN
 */
const generateUniquePin = async () => {
  let pin;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100;

  while (!isUnique && attempts < maxAttempts) {
    // Generate random 4-digit PIN (1000-9999)
    pin = String(Math.floor(1000 + Math.random() * 9000));

    // Check if PIN already exists (need to compare against all users since PINs are hashed)
    const existingUser = await User.findByPin(pin);
    if (!existingUser) {
      isUnique = true;
    }
    attempts++;
  }

  if (!isUnique) {
    throw new Error("Unable to generate unique PIN. Please try again.");
  }

  return pin;
};

/**
 * Login with PIN
 * POST /api/auth/login
 */
export const loginWithPin = async (req, res) => {
  try {
    const { pin } = req.body;
    const clientIp = req.ip || req.connection.remoteAddress || "unknown";

    // Check rate limit
    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        success: false,
        message: `Too many login attempts. Please try again in ${rateCheck.remainingSec} seconds.`,
      });
    }

    if (!pin || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 4-digit PIN",
      });
    }

    let user = await User.findByPin(pin);

    if (!user) {
      await ensureDefaultManager();
      user = await User.findByPin(pin);
      if (!user) {
        recordFailedAttempt(clientIp);
        return res.status(401).json({
          success: false,
          message: "Invalid PIN",
        });
      }
    }

    // Successful login — clear failed attempts
    clearAttempts(clientIp);

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Store user in session for 24-hour persistence
    req.session.userId = user._id;
    req.session.userPin = user.pin;
    req.session.userRole = user.role;
    req.session.loginTime = Date.now();

    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        role: user.role,
        sessionExpires: Date.now() + 24 * 60 * 60 * 1000, // 24 hours from now
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      success: false,
      message: "Authentication failed",
    });
  }
};

/**
 * Register a new volunteer (managers only)
 * POST /api/auth/register
 */
export const registerVolunteer = async (req, res) => {
  try {
    const { name, phone, email, skills, role } = req.body;

    // requireManager middleware already verified the user is an authenticated manager
    // req.user is guaranteed to be a manager at this point

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required",
      });
    }

    // Generate unique PIN
    const pin = await generateUniquePin();

    // Create new user
    const newUser = await User.create({
      pin,
      name,
      phone,
      email,
      skills: skills || [],
      role: role === "manager" ? "manager" : "volunteer",
      registeredBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      data: {
        id: newUser._id,
        name: newUser.name,
        pin: newUser.pin,
        role: newUser.role,
      },
      message: `User registered successfully. PIN: ${pin}`,
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
    });
  }
};

/**
 * Get all volunteers (managers only)
 * GET /api/auth/volunteers
 */
export const getVolunteers = async (req, res) => {
  try {
    const volunteers = await User.find({ role: "volunteer" })
      .select("-__v")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: volunteers,
    });
  } catch (error) {
    console.error("Get volunteers error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch volunteers",
    });
  }
};

/**
 * Get current user info
 * GET /api/auth/me
 */
export const getCurrentUser = async (req, res) => {
  try {
    const pin = req.headers["x-auth-pin"];

    if (!pin) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const user = await User.findByPin(pin);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        role: user.role,
        phone: user.phone,
        email: user.email,
        skills: user.skills,
      },
    });
  } catch (error) {
    console.error("Get current user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to get user info",
    });
  }
};

/**
 * Deactivate a volunteer (managers only)
 * DELETE /api/auth/volunteers/:id
 */
export const deactivateVolunteer = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await User.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true },
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.json({
      success: true,
      message: "User deactivated successfully",
    });
  } catch (error) {
    console.error("Deactivate user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to deactivate user",
    });
  }
};

/**
 * Check session status
 * GET /api/auth/session
 */
export const checkSession = async (req, res) => {
  try {
    // Check if session exists and has userId
    if (req.session?.userId) {
      const user = await User.findById(req.session.userId).select("-__v");

      if (user && user.isActive) {
        return res.json({
          success: true,
          authenticated: true,
          data: {
            id: user._id,
            name: user.name,
            role: user.role,
            sessionExpires:
              (req.session.loginTime || Date.now()) + 24 * 60 * 60 * 1000,
          },
        });
      }
    }

    // No valid session - return unauthenticated (not an error)
    return res.json({
      success: true,
      authenticated: false,
    });
  } catch (error) {
    console.error("Check session error:", error);
    // Even on error, return unauthenticated rather than 500
    return res.json({
      success: true,
      authenticated: false,
    });
  }
};

/**
 * Logout user and destroy session
 * POST /api/auth/logout
 */
export const logoutUser = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destroy error:", err);
        return res.status(500).json({
          success: false,
          message: "Logout failed",
        });
      }

      res.clearCookie("connect.sid");
      res.json({
        success: true,
        message: "Logged out successfully",
      });
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};

/**
 * Initialize default manager if none exists
 */
export const initializeDefaultManager = async () => {
  try {
    const managerExists = await User.findOne({ role: "manager" });

    if (!managerExists) {
      const defaultPin = String(Math.floor(1000 + Math.random() * 9000));
      await User.create({
        pin: defaultPin,
        name: "Alex Mercer",
        role: "manager",
        email: "admin@disaster-response.local",
      });
      console.log(`Default manager created with PIN: ${defaultPin}`);
    }
  } catch (error) {
    console.error("Failed to initialize default manager:", error);
  }
};
