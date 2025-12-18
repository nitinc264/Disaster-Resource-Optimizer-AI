import User from "../models/UserModel.js";

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

    const user = await User.findOne({ pin, isActive: true });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid PIN",
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        role: user.role,
        pin: user.pin,
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
