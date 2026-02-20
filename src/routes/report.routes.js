const express = require("express");
const router = express.Router();
const multer = require("multer");

// 👇 TEMP DEBUG — we verify path manually
const authMiddleware = require("../middlewares/auth.middleware");

const { createReport } = require("../controllers/report.controller");

const upload = multer({ dest: "src/uploads/" });

router.post("/", authMiddleware, upload.array("evidence", 5), createReport);

module.exports = router;
