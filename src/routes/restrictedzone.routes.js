const express = require("express");
const multer = require("multer");
const {
  createZone,
  updateZone,
  deactivateZone,
  deleteZone,
  getZones,
} = require("../controllers/restrictedzone.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const roleMiddleware = require("../middlewares/role.middleware");

const router = express.Router();

const storage = multer.diskStorage({
  destination: "src/uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

router.post(
  "/",
  authMiddleware,
  roleMiddleware("AUTHORIZED_PERSON"),
  upload.array("evidenceFiles"),
  createZone,
);

router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("AUTHORIZED_PERSON"),
  upload.array("evidenceFiles"),
  updateZone,
);

router.patch(
  "/:id/deactivate",
  authMiddleware,
  roleMiddleware("AUTHORIZED_PERSON"),
  deactivateZone,
);

router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("AUTHORIZED_PERSON"),
  deleteZone,
);

router.get("/", authMiddleware, getZones);

module.exports = router;
