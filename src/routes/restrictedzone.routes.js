const express = require("express");
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
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - boundaries
 *               - startDate
 *               - endDate
 *             properties:
 *               name:
 *                 type: string
 *               boundaries:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     lat:
 *                       type: number
 *                     lng:
 *                       type: number
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               evidenceFiles:
 *                 type: array
 *                 items:
 *                   type: string
 */
router.post(
  "/",
  authMiddleware,
  roleMiddleware("AUTHORIZED_PERSON"),
  createZone,
);

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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               boundaries:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     lat:
 *                       type: number
 *                     lng:
 *                       type: number
 *               startDate:
 *                 type: string
 *                 format: date-time
 *               endDate:
 *                 type: string
 *                 format: date-time
 *               evidenceFiles:
 *                 type: array
 *                 items:
 *                   type: string
 */
router.put(
  "/:id",
  authMiddleware,
  roleMiddleware("AUTHORIZED_PERSON"),
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
 */
router.delete(
  "/:id",
  authMiddleware,
  roleMiddleware("AUTHORIZED_PERSON"),
  deleteZone,
);

/**
 * @swagger
 * /api/zones:
 *   get:
 *     summary: Get restricted fishing zones
 *     tags: [Restricted Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *         description: Filter active/inactive zones
 */
router.get("/", authMiddleware, getZones);

module.exports = router;
