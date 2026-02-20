// routes/report.routes.js

const express = require("express");
const router = express.Router();
const multer = require("multer");

const authMiddleware = require("../middlewares/auth.middleware");
const { createReport } = require("../controllers/report.controller");

/* -------- Multer Config -------- */
// Files will be stored in 'src/uploads/' with a max of 5 files, 20MB each
const upload = multer({
  dest: "src/uploads/",
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB per file
  },
});

/* -------- Route -------- */
// POST /api/reports
// Upload up to 5 evidence files along with the report
router.post(
  "/",
  authMiddleware,
  upload.array("evidence", 5),
  createReport
);

module.exports = router;
