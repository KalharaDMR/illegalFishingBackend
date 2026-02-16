const express = require("express");
const multer = require("multer");

const auth = require("../middlewares/auth.middleware");
const role = require("../middlewares/role.middleware");

const {
  createReport,
  getAllReports,
  updateReportStatus,
} = require("../controllers/report.controller");

const router = express.Router();


// multer upload
const storage = multer.diskStorage({
  destination: "src/uploads/",
  filename: (req, file, cb) =>
    cb(null, Date.now() + "-" + file.originalname),
});

const upload = multer({ storage });


// PUBLIC USER submits report
router.post(
  "/",
  auth,
  role("PUBLIC_USER"),
  upload.array("evidence"),
  createReport
);


// ADMIN views reports
router.get("/", auth, role("ADMIN"), getAllReports);


// ADMIN update status
router.put("/:id", auth, role("ADMIN"), updateReportStatus);

module.exports = router;
