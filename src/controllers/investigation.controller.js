const Investigation = require("../models/Investigation");
const { IllegalReport } = require("../models/IllegalReport");
const { User } = require("../models/user");
const notificationService = require("../services/notification.service"); 
const { generatePDF } = require("../services/pdf.service"); // We'll create this
const path = require("path");
const fs = require("fs");

/* =========================
   GET ASSIGNED REPORTS DASHBOARD
   For Authorized Person - Shows reports in their district that need investigation
========================= */
exports.getAssignedReports = async (req, res) => {
  try {
    const officerDistrict = req.user.district;

    if (!officerDistrict) {
      return res.status(400).json({
        message: "No district assigned to your account"
      });
    }

    // Find all reports in officer's district that are PENDING or INVESTIGATING
    const reports = await IllegalReport.find({
      district: officerDistrict,
      status: { $in: ["PENDING", "INVESTIGATING"] }
    })
    .populate("reporter", "name email phone")
    .sort({ createdAt: -1 });

    // Check which reports already have investigations
    const reportsWithInvestigation = await Investigation.find({
      reportId: { $in: reports.map(r => r._id) }
    }).select("reportId status");

    // Create a map of reportId to investigation status
    const investigationMap = {};
    reportsWithInvestigation.forEach(inv => {
      investigationMap[inv.reportId.toString()] = inv.status;
    });

    // Enhance reports with investigation status
    const enhancedReports = reports.map(report => ({
      ...report.toObject(),
      investigationStatus: investigationMap[report._id.toString()] || "NOT_STARTED"
    }));

    res.json({
      district: officerDistrict,
      total: enhancedReports.length,
      reports: enhancedReports
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

/* =========================
   START INVESTIGATION
   Create a new investigation record for a report
========================= */
exports.startInvestigation = async (req, res) => {
  try {
    const { reportId } = req.params;
    const officerId = req.user.userId;

    // Check if report exists
    const report = await IllegalReport.findById(reportId);
    if (!report) {
      return res.status(404).json({ message: "Report not found" });
    }

    // Verify officer is in the same district
    if (report.district !== req.user.district) {
      return res.status(403).json({
        message: "You can only investigate reports in your district"
      });
    }

    // Check if investigation already exists
    const existingInvestigation = await Investigation.findOne({ reportId });
    if (existingInvestigation) {
      return res.status(400).json({
        message: "Investigation already started for this report",
        investigation: existingInvestigation
      });
    }

    // Create new investigation with proper default values
    const investigation = new Investigation({
      reportId,
      officerId,
      visited: false,
      actualSituation: "Investigation in progress", // Default value
      illegalActivityFound: false,
      actionTaken: "NO_ACTION",
      actionDescription: "",
      fineAmount: 0,
      visitDate: new Date(),
      visitTime: new Date().toTimeString().slice(0, 5),
      officerNotes: "",
      evidenceImages: [],
      evidenceVideos: [],
      status: "INVESTIGATING"
    });

    await investigation.save();

    // Update report status
    report.status = "INVESTIGATING";
    await report.save();

    res.status(201).json({
      message: "Investigation started successfully",
      investigation
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      message: "Failed to start investigation", 
      error: error.message 
    });
  }
};

/* =========================
   SUBMIT INVESTIGATION (UPDATED)
   Authorized officer submits their findings with SMS notification
========================= */
exports.submitInvestigation = async (req, res) => {
  try {
    const { investigationId } = req.params;
    const officerId = req.user.userId;

    const {
      visited,
      actualSituation,
      illegalActivityFound,
      actionTaken,
      actionDescription,
      fineAmount,
      visitDate,
      visitTime,
      officerNotes,
    } = req.body;

    // Handle file uploads
    const evidenceImages = req.files?.images 
      ? req.files.images.map(file => file.path.replace(/\\/g, '/'))
      : [];

    const evidenceVideos = req.files?.videos
      ? req.files.videos.map(file => file.path.replace(/\\/g, '/'))
      : [];

    // Find investigation with officer validation
    const investigation = await Investigation.findOne({
      _id: investigationId,
      officerId
    });

    if (!investigation) {
      return res.status(404).json({ message: "Investigation not found" });
    }

    // Update investigation fields
    investigation.visited = visited === "true" || visited === true;
    investigation.actualSituation = actualSituation;
    investigation.illegalActivityFound = illegalActivityFound === "true" || illegalActivityFound === true;
    investigation.actionTaken = actionTaken;
    investigation.actionDescription = actionDescription || '';
    investigation.fineAmount = fineAmount ? parseFloat(fineAmount) : 0;
    investigation.visitDate = visitDate || new Date();
    investigation.visitTime = visitTime || new Date().toTimeString().slice(0, 5);
    investigation.officerNotes = officerNotes || '';
    investigation.evidenceImages = evidenceImages;
    investigation.evidenceVideos = evidenceVideos;
    investigation.status = "COMPLETED";
    investigation.resolvedAt = new Date();

    await investigation.save();

    // Update the original report status
    await IllegalReport.findByIdAndUpdate(
      investigation.reportId,
      { status: "RESOLVED" }
    );

    // Fetch related data for notifications
    const report = await IllegalReport.findById(investigation.reportId);
    const officer = await User.findById(officerId).select('name email phone');

    /* ===== NEW: SEND SMS NOTIFICATIONS ===== */
    let notificationResult = null;
    
    try {
      console.log('📱 Attempting to send SMS notifications for completed investigation...');
      
      notificationResult = await notificationService.sendInvestigationCompletedNotification(
        investigation,
        report,
        officer
      );

      // Store notification status in investigation
      investigation.notifications = {
        sms: notificationResult.sms,
        sentAt: new Date()
      };
      
      await investigation.save();

      console.log('✅ Notification process completed:', {
        smsSuccess: notificationResult.sms?.success,
        smsSuccessful: notificationResult.sms?.successful,
        smsFailed: notificationResult.sms?.failed
      });

    } catch (notifError) {
      console.error('❌ Notification service error:', notifError.message);
      notificationResult = {
        success: false,
        error: notifError.message
      };
    }
    /* ===== END OF SMS NOTIFICATIONS ===== */

    res.json({
      message: "Investigation submitted successfully",
      investigation,
      notifications: notificationResult, // Include notification status in response
      smsConfig: {
        trialAccount: true,
        note: "SMS sent to verified numbers only. Add numbers in Twilio Console."
      }
    });

  } catch (error) {
    console.error("Submit investigation error:", error);
    res.status(500).json({ 
      message: "Failed to submit investigation",
      error: error.message 
    });
  }
};

/* =========================
   GET INVESTIGATION DETAILS
   View specific investigation
========================= */
exports.getInvestigationDetails = async (req, res) => {
  try {
    const { investigationId } = req.params;
    const userRole = req.user.role;
    const userId = req.user.userId;

    const investigation = await Investigation.findById(investigationId)
      .populate("reportId")
      .populate("officerId", "name email phone district");

    if (!investigation) {
      return res.status(404).json({ message: "Investigation not found" });
    }

    // Check permissions
    if (userRole === "AUTHORIZED_PERSON" && 
        investigation.officerId._id.toString() !== userId) {
      return res.status(403).json({ 
        message: "You can only view your own investigations" 
      });
    }

    res.json(investigation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

/* =========================
   GET MY INVESTIGATIONS (For Authorized Person)
   View all investigations conducted by the officer
========================= */
exports.getMyInvestigations = async (req, res) => {
  try {
    const officerId = req.user.userId;

    const investigations = await Investigation.find({ officerId })
      .populate("reportId", "location description reportDate district")
      .sort({ createdAt: -1 });

    res.json({
      total: investigations.length,
      completed: investigations.filter(i => i.status === "COMPLETED").length,
      investigating: investigations.filter(i => i.status === "INVESTIGATING").length,
      investigations
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

/* =========================
   GET ALL INVESTIGATIONS (For Admin)
   Admin view all investigations
========================= */
exports.getAllInvestigations = async (req, res) => {
  try {
    const { district, status, startDate, endDate } = req.query;

    let query = {};

    if (district) {
      // First get reports in that district
      const reportsInDistrict = await IllegalReport.find({ district }).select("_id");
      query.reportId = { $in: reportsInDistrict.map(r => r._id) };
    }

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const investigations = await Investigation.find(query)
      .populate("reportId")
      .populate("officerId", "name email district")
      .sort({ createdAt: -1 });

    // Calculate statistics
    const stats = {
      total: investigations.length,
      completed: investigations.filter(i => i.status === "COMPLETED").length,
      investigating: investigations.filter(i => i.status === "INVESTIGATING").length,
      resolved: investigations.filter(i => i.status === "RESOLVED").length,
      totalFines: investigations
        .filter(i => i.actionTaken === "FINE")
        .reduce((sum, i) => sum + (i.fineAmount || 0), 0),
      illegalActivityFound: investigations.filter(i => i.illegalActivityFound).length
    };

    res.json({
      stats,
      investigations
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

/* =========================
   GENERATE INVESTIGATION REPORT (PDF)
   Download official investigation report
========================= */
exports.generateReportPDF = async (req, res) => {
  try {
    const { investigationId } = req.params;

    const investigation = await Investigation.findById(investigationId)
      .populate("reportId")
      .populate("officerId", "name email phone district");

    if (!investigation) {
      return res.status(404).json({ message: "Investigation not found" });
    }

    // Generate PDF using the service
    const pdfPath = await generatePDF(investigation);

    // Send file for download
    res.download(pdfPath, `investigation_report_${investigationId}.pdf`, (err) => {
      if (err) {
        console.error(err);
        res.status(500).json({ message: "Error downloading file" });
      }
      
      // Clean up temp file after download
      fs.unlink(pdfPath, (unlinkErr) => {
        if (unlinkErr) console.error("Error deleting temp file:", unlinkErr);
      });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

/* =========================
   GET NOTIFICATION STATUS
   Check SMS delivery status for admin
========================= */
exports.getNotificationStatus = async (req, res) => {
  try {
    const { investigationId } = req.params;

    const investigation = await Investigation.findById(investigationId)
      .populate("reportId", "district location")
      .populate("officerId", "name");

    if (!investigation) {
      return res.status(404).json({ message: "Investigation not found" });
    }

    // Get notification status from investigation or create default
    const notifications = investigation.notifications || {
      sms: { success: false, error: 'No notifications sent' }
    };

    const status = {
      investigationId: investigation._id,
      reportId: investigation.reportId?._id,
      district: investigation.reportId?.district,
      officerName: investigation.officerId?.name,
      actionTaken: investigation.actionTaken,
      fineAmount: investigation.fineAmount,
      notifications: notifications,
      adminNumbers: process.env.ADMIN_PHONE_NUMBERS 
        ? process.env.ADMIN_PHONE_NUMBERS.split(',').length 
        : process.env.ADMIN_PHONE_NUMBER ? 1 : 0,
      twilioConfig: {
        accountSid: process.env.TWILIO_ACCOUNT_SID ? '✅ Configured' : '❌ Missing',
        phoneNumber: process.env.TWILIO_PHONE_NUMBER || '❌ Missing',
        isTrial: true
      }
    };

    res.json(status);
  } catch (error) {
    console.error("Error in getNotificationStatus:", error);
    res.status(500).json({ error: error.message });
  }
};