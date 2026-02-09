require("dotenv").config();
const app = require("./app");
const connectDB = require("./config/db");

connectDB();

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

const User = require("./models/user");
const bcrypt = require("bcryptjs");

const seedAdmin = async () => {
  const adminExists = await User.findOne({ role: "ADMIN" });
  if (!adminExists) {
    const password = await bcrypt.hash("admin123", 10);
    await User.create({
      name: "System Admin",
      email: "admin@gmail.com",
      phone: "0000000000",
      password,
      role: "ADMIN",
      status: "APPROVED",
    });
    console.log("Admin user created");
  }
};

seedAdmin();

