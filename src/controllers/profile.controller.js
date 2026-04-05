const bcrypt = require("bcryptjs");
const { User } = require("../models/user");

// GET /api/profile/me
exports.getMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "AUTHORIZED_PERSON") {
      return res.status(403).json({
        message: "This profile endpoint is only for authorized persons",
      });
    }

    res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      status: user.status,
      district: user.district || "",
      evidenceFiles: user.evidenceFiles || [],
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/profile/me
exports.updateMyProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role !== "AUTHORIZED_PERSON") {
      return res.status(403).json({
        message: "This profile endpoint is only for authorized persons",
      });
    }

    const { name, email, phone, district } = req.body;

    if (email && email !== user.email) {
      const existingUser = await User.findOne({
        email,
        _id: { $ne: user._id },
      });

      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }
    }

    if (name !== undefined) user.name = name;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (district !== undefined) user.district = district;

    await user.save();

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
        district: user.district || "",
        evidenceFiles: user.evidenceFiles || [],
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ========================= PUBLIC USER PROFILE =========================

// GET /api/profile/public/me
exports.getPublicProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      _id:       user._id,
      name:      user.name,
      email:     user.email,
      phone:     user.phone   || "",
      role:      user.role    || "PUBLIC_USER",
      status:    user.status  || "PENDING",
      createdAt: user.createdAt,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/profile/public/me
exports.updatePublicProfile = async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    const updates = {};
    if (name  !== undefined && name.trim())  updates.name  = name.trim();
    if (email !== undefined && email.trim()) updates.email = email.trim().toLowerCase();
    if (phone !== undefined && phone.trim()) updates.phone = phone.trim();

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No valid fields provided" });
    }

    if (updates.email) {
      const conflict = await User.findOne({
        email: updates.email,
        _id: { $ne: req.user.userId },
      });
      if (conflict) {
        return res.status(409).json({ message: "That email is already in use by another account" });
      }
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json({
      message: "Profile updated successfully",
      user: {
        _id:       user._id,
        name:      user.name,
        email:     user.email,
        phone:     user.phone   || "",
        role:      user.role    || "PUBLIC_USER",
        status:    user.status  || "PENDING",
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "That email is already in use by another account" });
    }
    res.status(500).json({ message: error.message });
  }
};

// PUT /api/profile/public/password
exports.changePublicPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Both current and new password are required" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ message: "New password must differ from the current one" });
    }

    const user = await User.findById(req.user.userId).select("+password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();

    res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};