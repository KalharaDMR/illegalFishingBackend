const express = require("express");
const router = express.Router();

const authMiddleware = require("../middlewares/auth.middleware");
const profileController = require("../controllers/profile.controller");

// ========================= AUTHORIZED_PERSON PROFILE =========================
router.get("/me", authMiddleware, profileController.getMyProfile);
router.put("/me", authMiddleware, profileController.updateMyProfile);

// ========================= PUBLIC USER PROFILE =========================
router.get("/public/me", authMiddleware, profileController.getPublicProfile);
router.put("/public/me", authMiddleware, profileController.updatePublicProfile);

// ========================= PUBLIC USER CHANGE PASSWORD =========================
router.put("/public/password", authMiddleware, profileController.changePublicPassword);

module.exports = router;