const IllegalReport = require("../models/IllegalReport");

exports.createReport = async (req, res) => {
  try {
    // ✅ reporter is automatically populated from auth middleware
    const reporterId = req.user.userId // decoded token should have id

    const { reportDate, reportTime, location, latitude, longitude, description } = req.body;

    // Map uploaded files to paths
    const evidenceFiles = req.files ? req.files.map((file) => file.path) : [];

    const newReport = new IllegalReport({
      reporter: reporterId,
      reportDate,
      reportTime,
      location,
      latitude,
      longitude,
      description,
      evidenceFiles,
    });

    await newReport.save();

    res.status(201).json({ message: "Report submitted successfully", report: newReport });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to submit report", error: error.message });
  }
};
