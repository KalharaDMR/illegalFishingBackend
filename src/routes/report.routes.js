
const express = require("express");
const router = express.Router();
const multer = require("multer");

const authMiddleware = require("../middlewares/auth.middleware");
const roleMiddleware = require("../middlewares/role.middleware");

const {
  createReport,
  getMyReports,
  updateReport,
  deleteReport,
  getReportsByDistrict,
  getMyDistrictReports,
  getReportStatistics,
  getAllReports,  // NOW INCLUDED
} = require("../controllers/report.controller");

/* -------- Multer Config -------- */

const upload = multer({
  dest: "src/uploads/",
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB per file
  },
});

/* =========================
   CREATE REPORT
   POST /api/reports
========================= */

router.post(
  "/",
  authMiddleware,
  upload.array("evidence", 5),
  createReport
);

/* =========================
   GET MY REPORTS
   GET /api/reports/my
========================= */

router.get(
  "/my",
  authMiddleware,
  getMyReports
);

/* =========================
   GET REPORTS FOR AUTHORIZED PERSON'S DISTRICT
   GET /api/reports/my-district
========================= */

router.get(
  "/my-district",
  authMiddleware,
  roleMiddleware("AUTHORIZED_PERSON"),
  getMyDistrictReports
);

/* =========================
   GET REPORTS BY DISTRICT (ADMIN ONLY)
   GET /api/reports/district/:district
========================= */

router.get(
  "/district/:district",
  authMiddleware,
  roleMiddleware("ADMIN"),
  getReportsByDistrict
);

/* =========================
   GET ALL REPORTS (ADMIN ONLY)
   GET /api/reports/all
========================= */

router.get(
  "/all",
  authMiddleware,
  roleMiddleware("ADMIN"),
  getAllReports
);

/* =========================
   GET REPORT STATISTICS
   GET /api/reports/statistics
========================= */

router.get(
  "/statistics",
  authMiddleware,
  getReportStatistics
);

/* =========================
   UPDATE REPORT
   PUT /api/reports/:id
========================= */

router.put(
  "/:id",
  authMiddleware,
  updateReport
);

/* =========================
   DELETE REPORT
   DELETE /api/reports/:id
========================= */

router.delete(
  "/:id",
  authMiddleware,
  deleteReport
);

module.exports = router;

/**
 * @swagger
 * components:
 *   schemas:
 *     Report:
 *       type: object
 *       required:
 *         - district
 *         - reportDate
 *         - reportTime
 *         - location
 *         - latitude
 *         - longitude
 *         - description
 *       properties:
 *         district:
 *           type: string
 *           enum: [Ampara, Anuradhapura, Badulla, Batticaloa, Colombo, Galle, Gampaha, Hambantota, Jaffna, Kalutara, Kandy, Kegalle, Kilinochchi, Kurunegala, Mannar, Matale, Matara, Monaragala, Mullaitivu, Nuwara Eliya, Polonnaruwa, Puttalam, Ratnapura, Trincomalee, Vavuniya]
 *           description: District where incident occurred
 *         reportDate:
 *           type: string
 *           format: date
 *         reportTime:
 *           type: string
 *           pattern: '^([0-1]\d|2[0-3]):([0-5]\d)$'
 *         location:
 *           type: string
 *         latitude:
 *           type: number
 *         longitude:
 *           type: number
 *         description:
 *           type: string
 *         evidenceFiles:
 *           type: array
 *           items:
 *             type: string
 *         status:
 *           type: string
 *           enum: [PENDING, INVESTIGATING, RESOLVED]
 */

/**
 * @swagger
 * /reports:
 *   post:
 *     summary: Create a new illegal fishing report
 *     tags: [Reports]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - district
 *               - reportDate
 *               - reportTime
 *               - location
 *               - latitude
 *               - longitude
 *               - description
 *             properties:
 *               district:
 *                 type: string
 *               reportDate:
 *                 type: string
 *                 format: date
 *               reportTime:
 *                 type: string
 *               location:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               description:
 *                 type: string
 *               evidence:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 */