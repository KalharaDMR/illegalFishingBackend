const express = require("express");
const multer = require("multer");

const {
  createZone,
  updateZone,
  deactivateZone,
  deleteZone,
  getZones,
  getAIAdvisory,
} = require("../controllers/Restrictedzone.controller");

const authMiddleware = require("../middlewares/auth.middleware");
const roleMiddleware = require("../middlewares/role.middleware");

const router = express.Router();

// Multer configuration
const storage = multer.diskStorage({
  destination: "src/uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

/**
 * @swagger
 * tags:
 *   name: Restricted Zones
 *   description: Restricted Fishing Area Management APIs
 */

/**
 * @swagger
 * /api/zones:
 *   post:
 *     summary: Create a new restricted fishing zone
 *     tags: [Restricted Zones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - location
 *               - startDate
 *               - endDate
 *             properties:
 *               name:
 *                 type: string
 *                 example: Anuradhapura Tissa Wewa Protection Zone
 *               location:
 *                 type: string
 *                 description: JSON string format {"lat":8.3356,"lng":80.4037}
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: 2026-03-01
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: 2026-09-30
 *               restrictedTime:
 *                 type: string
 *                 example: All Day
 *               evidenceFiles:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Restricted zone created successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("AUTHORIZED_PERSON"),
  upload.array("evidenceFiles"),
  createZone,
);

/**
 * @swagger
 * /api/zones:
 *   get:
 *     summary: Get all restricted fishing zones
 *     tags: [Restricted Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter zones by active status
 *     responses:
 *       200:
 *         description: List of restricted zones
 *       401:
 *         description: Unauthorized
 */
router.get("/", authMiddleware, getZones);

/**
 * @swagger
 * /api/zones/{id}:
 *   put:
 *     summary: Update an existing restricted fishing zone
 *     tags: [Restricted Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Restricted zone ID
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               location:
 *                 type: string
 *                 description: JSON string format {"lat":8.3356,"lng":80.4037}
 *               startDate:
 *                 type: string
 *                 format: date
 *               endDate:
 *                 type: string
 *                 format: date
 *               restrictedTime:
 *                 type: string
 *               evidenceFiles:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       200:
 *         description: Zone updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 */
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("AUTHORIZED_PERSON"),
  upload.array("evidenceFiles"),
  updateZone,
);

/**
 * @swagger
 * /api/zones/{id}/deactivate:
 *   patch:
 *     summary: Deactivate a restricted fishing zone
 *     tags: [Restricted Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Restricted zone ID
 *     responses:
 *       200:
 *         description: Zone deactivated successfully
 *       400:
 *         description: Error occurred
 *       401:
 *         description: Unauthorized
 */
router.patch(
  "/:id/deactivate",
  authMiddleware,
  roleMiddleware("AUTHORIZED_PERSON"),
  deactivateZone,
);

/**
 * @swagger
 * /api/zones/{id}:
 *   delete:
 *     summary: Delete a restricted fishing zone
 *     tags: [Restricted Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Restricted zone ID
 *     responses:
 *       200:
 *         description: Zone deleted successfully
 *       400:
 *         description: Error occurred
 *       401:
 *         description: Unauthorized
 */
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("AUTHORIZED_PERSON"),
  deleteZone,
);

/**
 * @swagger
 * /api/zones/ai-advisory:
 *   get:
 *     summary: Generate AI conservation advisory for all active zones
 *     tags: [Restricted Zones]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: AI-generated advisory
 *       401:
 *         description: Unauthorized
 */
router.get(
  "/ai-advisory",
  authMiddleware,
  roleMiddleware("AUTHORIZED_PERSON"),
  getAIAdvisory,
);

module.exports = router;
