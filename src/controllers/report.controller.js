const Report = require("../models/IllegalReport");

exports.createReport = async (req, res) => {
  try {
    const {
      reportDate,
      reportTime,
      location,
      latitude,
      longitude,
      description,
    } = req.body;

    const evidenceFiles = req.files
      ? req.files.map((file) => file.filename)
      : [];

    const report = await Report.create({
      reporter: req.user.id,
      reportDate,
      reportTime,
      location,
      latitude,
      longitude,
      description,
      evidenceFiles,
    });

    res.status(201).json({ message: "Report submitted", report });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ADMIN
exports.getAllReports = async (req, res) => {
  try {
    const reports = await Report.find().populate("reporter", "name email");
    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ADMIN
exports.updateReportStatus = async (req, res) => {
  try {
    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { status: req.body.status },
      { new: true }
    );

    if (!report) return res.status(404).json({ message: "Report not found" });

    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
