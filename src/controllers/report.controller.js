
const { IllegalReport } = require("../models/IllegalReport");
const { User } = require("../models/user");
const sendEmail = require("../utils/email.service"); // SendGrid service

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
      district,
    } = req.body;

    if (!district) {
      return res.status(400).json({
        message: "District is required for reporting",
      });
    }

    const evidenceFiles = req.files
      ? req.files.map((file) => file.path)
      : [];

    const newReport = new IllegalReport({
      reporter: reporterId,
      district,
      reportDate,
      reportTime,
      location,
      latitude,
      longitude,
      description,
      evidenceFiles,
    });

    await newReport.save();

    // =========================
    // FIND USERS
    // =========================

    const reporter = await User.findById(reporterId);

    const authorizedPersons = await User.find({
      role: "AUTHORIZED_PERSON",
      district: district,
      status: "APPROVED",
    }).select("name email");

    const admins = await User.find({
      role: "ADMIN",
      status: "APPROVED",
    }).select("name email");

    // =========================
    // SEND EMAILS
    // =========================

    // 1️⃣ Confirmation to Reporter
    if (reporter) {
      await sendEmail(
        reporter.email,
        "Report Submitted Successfully",
        `Dear ${reporter.name},

Your illegal fishing report has been successfully submitted.

District: ${district}
Date: ${reportDate}

- Marine Protection System`
      );
    }

    // 2️⃣ Alert to District Officers
    for (const officer of authorizedPersons) {
      await sendEmail(
        officer.email,
        "🚨 New District Report Alert",
        `Hello ${officer.name},

A new report has been submitted in your district.

District: ${district}
Location: ${location}

- Marine Protection System`
      );
    }

    // 3️⃣ Alert to Admins
    for (const admin of admins) {
      await sendEmail(
        admin.email,
        "📢 New System Report Submitted",
        `Hello ${admin.name},

A new report has been submitted.

District: ${district}
Reported By: ${reporter?.name || "User"}

- Marine Protection System`
      );
    }

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
    })
      .populate("reporter", "name email role district")
      .sort({ createdAt: -1 });

    res.json(reports);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================
   GET MY DISTRICT REPORTS
========================= */

exports.getMyDistrictReports = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    if (!user || !user.district) {
      return res.status(400).json({
        message: "District not assigned",
      });
    }

    const reports = await IllegalReport.find({
      district: user.district,
    })
      .populate("reporter", "name email phone")
      .sort({ createdAt: -1 });

    res.json({
      district: user.district,
      count: reports.length,
      reports,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================
   GET REPORT STATISTICS
========================= */
exports.getReportStatistics = async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);

    let matchStage = {};

    if (user.role === "AUTHORIZED_PERSON" && user.district) {
      matchStage.district = user.district;
    }

    const statistics = await IllegalReport.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: "$district",
          total: { $sum: 1 },
          pending: {
            $sum: { $cond: [{ $eq: ["$status", "PENDING"] }, 1, 0] }
          },
          investigating: {
            $sum: { $cond: [{ $eq: ["$status", "INVESTIGATING"] }, 1, 0] }
          },
          resolved: {
            $sum: { $cond: [{ $eq: ["$status", "RESOLVED"] }, 1, 0] }
          },
        },
      },
      { $sort: { total: -1 } },
    ]);

    res.json(statistics);

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
        reporter: req.user.userId,
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
      reporter: req.user.userId,
    });

    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    res.json({ message: "Report deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================
   GET REPORTS BY DISTRICT (ADMIN)
========================= */
exports.getReportsByDistrict = async (req, res) => {
  try {
    const { district } = req.params;

    const reports = await IllegalReport.find({ district })
      .populate("reporter", "name email phone role")
      .sort({ createdAt: -1 });

    res.json({
      district,
      count: reports.length,
      reports,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

/* =========================
   GET ALL REPORTS (ADMIN)
========================= */
exports.getAllReports = async (req, res) => {
  try {
    const reports = await IllegalReport.find({})
      .populate("reporter", "name email phone role district")
      .sort({ createdAt: -1 });

    res.json({
      total: reports.length,
      reports,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};