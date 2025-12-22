import User from "../models/UserModel.js";

const ensureDefaultManager = async () => {
  const defaultPin = "0000";
  const existing = await User.findOne({ pin: defaultPin });

  if (!existing) {
    await User.create({
      pin: defaultPin,
      name: "Default Manager",
      role: "manager",
      email: "admin@disaster-response.local",
      isActive: true,
    });
    console.log(`Default manager (self-heal) created with PIN: ${defaultPin}`);
    return;
  }

  // If the default manager exists but is inactive or has the wrong role, fix it
  const updates = {};
  if (!existing.isActive) updates.isActive = true;
  if (existing.role !== "manager") updates.role = "manager";
  if (Object.keys(updates).length > 0) {
    await User.updateOne({ _id: existing._id }, { $set: updates });
    console.log(`Default manager (self-heal) reactivated with PIN: ${defaultPin}`);
  }
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

    // Check if PIN already exists
    const existingUser = await User.findOne({ pin });
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

    if (!pin || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 4-digit PIN",
      });
    }

    let user = await User.findOne({ pin, isActive: true });

    if (!user) {
      await ensureDefaultManager();
      user = await User.findOne({ pin, isActive: true });
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid PIN",
        });
      }
    }

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
        pin: user.pin,
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

    // Check if requester is a manager
    const managerPin = req.headers["x-auth-pin"];
    if (managerPin) {
      const manager = await User.findOne({ pin: managerPin, role: "manager" });
      if (!manager) {
        return res.status(403).json({
          success: false,
          message: "Only managers can register new users",
        });
      }
    }

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
      registeredBy: managerPin
        ? (
            await User.findOne({ pin: managerPin })
          )?._id
        : null,
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

    const user = await User.findOne({ pin, isActive: true }).select("-__v");

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
      { new: true }
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
            pin: user.pin,
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
      const defaultPin = "0000";
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
