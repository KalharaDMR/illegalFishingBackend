const { IllegalReport } = require("../models/IllegalReport");
const { User } = require("../models/user");

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
        message: "District is required for reporting" 
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

    // Find all AUTHORIZED_PERSONs in this district
    const authorizedPersonsInDistrict = await User.find({
      role: "AUTHORIZED_PERSON",
      district: district,
      status: "APPROVED"
    }).select("name email phone");

    res.status(201).json({
      message: "Report submitted successfully",
      report: newReport,
      notifications: {
        district: district,
        authorizedPersonsNotified: authorizedPersonsInDistrict.length,
      }
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
   GET MY DISTRICT REPORTS (For AUTHORIZED_PERSON)
   GET /api/reports/my-district
========================= */
exports.getMyDistrictReports = async (req, res) => {
  try {
    // Fetch the full user from database to get district
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ 
        message: "User not found" 
      });
    }

    if (!user.district) {
      return res.status(400).json({ 
        message: "No district assigned to your account" 
      });
    }

    const reports = await IllegalReport.find({ 
      district: user.district 
    })
    .populate("reporter", "name email phone")
    .sort({ createdAt: -1 });

    res.json({
      district: user.district,
      count: reports.length,
      reports
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

/* =========================
   GET REPORTS BY DISTRICT (For ADMIN)
   GET /api/reports/district/:district
========================= */
exports.getReportsByDistrict = async (req, res) => {
  try {
    const { district } = req.params;

    const reports = await IllegalReport.find({ 
      district: district 
    })
    .populate("reporter", "name email phone role")
    .sort({ createdAt: -1 });

    res.json({
      district: district,
      count: reports.length,
      reports
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

/* =========================
   GET ALL REPORTS (For ADMIN)
   GET /api/reports/all
========================= */
exports.getAllReports = async (req, res) => {
  try {
    const reports = await IllegalReport.find({})
      .populate("reporter", "name email phone role district")
      .sort({ createdAt: -1 });

    // Group by district for better visualization
    const reportsByDistrict = reports.reduce((acc, report) => {
      const district = report.district;
      if (!acc[district]) {
        acc[district] = [];
      }
      acc[district].push(report);
      return acc;
    }, {});

    res.json({
      total: reports.length,
      byDistrict: reportsByDistrict,
      reports: reports
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

/* =========================
   GET REPORT STATISTICS
========================= */
exports.getReportStatistics = async (req, res) => {
  try {
    // Fetch the full user from database
    const user = await User.findById(req.user.userId);
    
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const userRole = user.role;
    const userDistrict = user.district;

    let matchStage = {};

    if (userRole === "AUTHORIZED_PERSON" && userDistrict) {
      matchStage.district = userDistrict;
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
          lastReport: { $max: "$createdAt" }
        }
      },
      { $sort: { total: -1 } }
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