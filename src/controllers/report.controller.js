const IllegalReport = require("../models/IllegalReport");

/* =========================
   CREATE REPORT
========================= */
exports.createReport = async (req, res) => {
  try {
    const reporterId = req.user.userId;

    const {
      reportDate,
      reportTime,
      location,
      latitude,
      longitude,
      description,
    } = req.body;

    const evidenceFiles = req.files
      ? req.files.map((file) => file.path)
      : [];

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

    res.status(201).json({
      message: "Report submitted successfully",
      report: newReport,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to submit report",
      error: error.message,
    });
  }
};

/* =========================
   GET MY REPORTS
========================= */
exports.getMyReports = async (req, res) => {
  try {
    const reports = await IllegalReport.find({
      reporter: req.user.userId,
    }).sort({ createdAt: -1 });

    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================
   UPDATE REPORT
========================= */
exports.updateReport = async (req, res) => {
  try {
    const report = await IllegalReport.findOneAndUpdate(
      {
        _id: req.params.id,
        reporter: req.user.userId, // ownership check
      },
      req.body,
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    res.json(report);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================
   DELETE REPORT
========================= */
exports.deleteReport = async (req, res) => {
  try {
    const report = await IllegalReport.findOneAndDelete({
      _id: req.params.id,
      reporter: req.user.userId, // ownership check
    });

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    res.json({ message: "Report deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
