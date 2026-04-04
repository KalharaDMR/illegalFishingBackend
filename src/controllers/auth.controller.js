const { User } = require("../models/user"); // Updated import
const bcrypt = require("bcryptjs");
const generateToken = require("../utils/jwt");

exports.signup = async (req, res) => {
  try {
    const { name, email, phone, password, role, district } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    let status = "PENDING";
    let evidenceFiles = [];

    if (role === "PUBLIC_USER") {
      status = "APPROVED";
    } else {
      if (!req.files || req.files.length === 0) {
        return res
          .status(400)
          .json({ message: "Evidence is required for this role" });
      }
      evidenceFiles = req.files.map((file) => file.filename);
    }

    // Prepare user data
    const userData = {
      name,
      email,
      phone,
      password: hashedPassword,
      role,
      status,
      evidenceFiles,
    };

    // Add district only for AUTHORIZED_PERSON
    if (role === "AUTHORIZED_PERSON") {
      if (!district) {
        return res.status(400).json({ 
          message: "District is required for AUTHORIZED_PERSON role" 
        });
      }
      userData.district = district;
    }

    const user = await User.create(userData);

    // Prepare response message
    let responseMessage = "Signup successful. Waiting for admin approval";
    if (role === "PUBLIC_USER") {
      responseMessage = "Signup successful";
    }

    res.status(201).json({
      message: responseMessage,
      user: role === "AUTHORIZED_PERSON" ? { district: user.district } : {}
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.status !== "APPROVED") {
      return res
        .status(403)
        .json({ message: "Account not approved yet" });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = generateToken(user);

    // Include district in response if user is AUTHORIZED_PERSON
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };

    if (user.role === "AUTHORIZED_PERSON" && user.district) {
      userResponse.district = user.district;
    }

    res.json({
      token,
      user: userResponse,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };

    if (user.role === "AUTHORIZED_PERSON" && user.district) {
      userResponse.district = user.district;
    }

    res.json({ user: userResponse });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.userId; // From auth middleware
    const { email, password, phone, district, currentPassword } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if email is already taken by another user
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "Email already exists" });
      }
      user.email = email;
    }

    // Update password if provided
    if (password) {
      if (!currentPassword) {
        return res.status(400).json({ message: "Current password is required to change password" });
      }
      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      user.password = hashedPassword;
    }

    // Update phone if provided
    if (phone) {
      user.phone = phone;
    }


    await user.save();

    // Return updated user data (without password)
    const userResponse = {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
    };
    res.json({
      message: "Profile updated successfully",
      user: userResponse,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};