const User = require("../models/user");
const bcrypt = require("bcryptjs");
const generateToken = require("../utils/jwt");

exports.signup = async (req, res) => {
  try {
    const { name, email, phone, password, role } = req.body;

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

    const user = await User.create({
      name,
      email,
      phone,
      password: hashedPassword,
      role,
      status,
      evidenceFiles,
    });

    res.status(201).json({
      message:
        role === "PUBLIC_USER"
          ? "Signup successful"
          : "Signup successful. Waiting for admin approval",
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

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
