const express = require("express");
const { sriLankaDistricts } = require("../models/user");
const auth = require("../middlewares/auth.middleware");

const router = express.Router();

/**
 * @swagger
 * /api/districts:
 *   get:
 *     summary: Get all Sri Lankan districts
 *     tags: [Districts]
 *     responses:
 *       200:
 *         description: List of districts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 districts:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get("/districts", (req, res) => {
  res.json({ districts: sriLankaDistricts });
});

module.exports = router;