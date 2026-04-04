const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const profileController = require("../controllers/profile.controller");

router.get("/me", authMiddleware, profileController.getMyProfile);
router.put("/me", authMiddleware, profileController.updateMyProfile);

module.exports = router;
