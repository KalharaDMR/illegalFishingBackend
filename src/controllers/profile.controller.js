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
