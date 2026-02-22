// src/routes/report.routes.js

const express = require("express");
const router = express.Router();
const multer = require("multer");

const authMiddleware = require("../middlewares/auth.middleware");

const {
  createReport,
  getMyReports,      // ✅ ADDED
  updateReport,      // ✅ ADDED
  deleteReport,      // ✅ ADDED
} = require("../controllers/report.controller");

/* -------- Multer Config -------- */
// Files stored in 'src/uploads/' with max 5 files, 20MB each
const upload = multer({
  dest: "src/uploads/",
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB per file
  },
});

/* =====================================================
   ROUTES
===================================================== */

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
