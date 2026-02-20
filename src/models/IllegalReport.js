const mongoose = require("mongoose");

const reportSchema = new mongoose.Schema(
  {
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // ✅ reporter must exist
    },
    reportDate: { type: String, required: true },
    reportTime: { type: String, required: true },
    location: { type: String, required: true },
    latitude: { type: String, required: true },
    longitude: { type: String, required: true },
    description: { type: String, required: true },
    evidenceFiles: { type: [String], default: [] },
    status: {
      type: String,
      enum: ["PENDING", "INVESTIGATING", "RESOLVED"],
      default: "PENDING",
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("IllegalReport", reportSchema);
