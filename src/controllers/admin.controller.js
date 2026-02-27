
const { User } = require("../models/user"); // Updated import

exports.getPendingUsers = async (req, res) => {
  const users = await User.find({ status: "PENDING" }).select("-password");
  res.json(users);
};

exports.approveUser = async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { status: "APPROVED" },
    { new: true }
  ).select("-password");
  res.json({ message: "User approved", user });
};

exports.rejectUser = async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { status: "REJECTED" },
    { new: true }
  ).select("-password");
  res.json({ message: "User rejected", user });
};

// Get all users (except admin itself - optional)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: { $ne: "ADMIN" } }).select("-password");
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User removed successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
