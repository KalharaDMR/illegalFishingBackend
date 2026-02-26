const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");

const authMiddleware = require("../middlewares/auth.middleware");
const roleMiddleware = require("../middlewares/role.middleware");

const {
  getAssignedReports,
  startInvestigation,
  submitInvestigation,
  getInvestigationDetails,
  getMyInvestigations,
  getAllInvestigations,
  generateReportPDF,
  getNotificationStatus,
} = require("../controllers/investigation.controller");

// Configure multer for evidence uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath = "src/uploads/investigations/";
    
    if (file.fieldname === "images") {
      uploadPath += "images/";
    } else if (file.fieldname === "videos") {
      uploadPath += "videos/";
    }
    
    // Create directory if it doesn't exist
    const fs = require("fs");
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for videos
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "images") {
      if (!file.mimetype.startsWith("image/")) {
        return cb(new Error("Only image files are allowed for images"));
      }
    } else if (file.fieldname === "videos") {
      if (!file.mimetype.startsWith("video/")) {
        return cb(new Error("Only video files are allowed for videos"));
      }
    }
    cb(null, true);
  },
});

// Middleware for handling multiple file fields
const uploadFields = upload.fields([
  { name: "images", maxCount: 5 },
  { name: "videos", maxCount: 3 },
]);

/* =========================
   AUTHORIZED PERSON ROUTES
========================= */

// Get assigned reports dashboard
router.get(
  "/assigned-reports",
  authMiddleware,
  roleMiddleware("AUTHORIZED_PERSON"),
  getAssignedReports
);

// Start investigation for a report
router.post(
  "/start/:reportId",
  authMiddleware,
  roleMiddleware("AUTHORIZED_PERSON"),
  startInvestigation
);

// Submit investigation findings
router.post(
  "/submit/:investigationId",
  authMiddleware,
  roleMiddleware("AUTHORIZED_PERSON"),
  uploadFields,
  submitInvestigation
);

// Get my investigations
router.get(
  "/my-investigations",
  authMiddleware,
  roleMiddleware("AUTHORIZED_PERSON"),
  getMyInvestigations
);

// Get specific investigation details
router.get(
  "/:investigationId",
  authMiddleware,
  getInvestigationDetails
);

/* =========================
   ADMIN ROUTES
========================= */

// Get all investigations (admin only)
router.get(
  "/admin/all",
  authMiddleware,
  roleMiddleware("ADMIN"),
  getAllInvestigations
);

// Generate PDF report
router.get(
  "/:investigationId/pdf",
  authMiddleware,
  generateReportPDF
);

router.get("/:investigationId/notifications", authMiddleware, roleMiddleware("ADMIN"), getNotificationStatus);

module.exports = router;

/**
 * @swagger
 * components:
 *   schemas:
 *     Investigation:
 *       type: object
 *       required:
 *         - reportId
 *         - officerId
 *         - visited
 *         - actualSituation
 *         - illegalActivityFound
 *         - actionTaken
 *         - visitDate
 *         - visitTime
 *       properties:
 *         reportId:
 *           type: string
 *         officerId:
 *           type: string
 *         visited:
 *           type: boolean
 *         actualSituation:
 *           type: string
 *         illegalActivityFound:
 *           type: boolean
 *         actionTaken:
 *           type: string
 *           enum: [WARNING, FINE, EQUIPMENT_CONFISCATED, ARREST, NO_ACTION, OTHER]
 *         fineAmount:
 *           type: number
 *         visitDate:
 *           type: string
 *           format: date
 *         visitTime:
 *           type: string
 *         evidenceImages:
 *           type: array
 *           items:
 *             type: string
 *         status:
 *           type: string
 *           enum: [INVESTIGATING, COMPLETED, RESOLVED]
 */