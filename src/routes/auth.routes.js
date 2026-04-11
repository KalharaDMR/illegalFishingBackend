const express = require("express");
const multer = require("multer");
const role= require("../middlewares/role.middleware")

const { signup, login, getProfile, updateProfile } = require("../controllers/auth.controller");
const auth = require("../middlewares/auth.middleware");

const router = express.Router();

const storage = multer.diskStorage({
  destination: "src/uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

const upload = multer({ storage });

/**
 * @swagger
 * /api/auth/signup:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - phone
 *               - password
 *               - role
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               phone:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [PUBLIC_USER, ZOOLOGIST, AUTHORIZED_PERSON]
 *               district:
 *                 type: string
 *                 description: Required only for AUTHORIZED_PERSON role. Must be a Sri Lankan district.
 *                 enum:
 *                   - Ampara
 *                   - Anuradhapura
 *                   - Badulla
 *                   - Batticaloa
 *                   - Colombo
 *                   - Galle
 *                   - Gampaha
 *                   - Hambantota
 *                   - Jaffna
 *                   - Kalutara
 *                   - Kandy
 *                   - Kegalle
 *                   - Kilinochchi
 *                   - Kurunegala
 *                   - Mannar
 *                   - Matale
 *                   - Matara
 *                   - Monaragala
 *                   - Mullaitivu
 *                   - Nuwara Eliya
 *                   - Polonnaruwa
 *                   - Puttalam
 *                   - Ratnapura
 *                   - Trincomalee
 *                   - Vavuniya
 *               evidence:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: binary
 */
router.post("/signup", upload.array("evidence"), signup);

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 */
router.post("/login", login);
router.get("/profile", auth,role("ZOOLOGIST"), getProfile);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 description: New email address
 *               password:
 *                 type: string
 *                 description: New password
 *               phone:
 *                 type: string
 *                 description: New phone number
 *               district:
 *                 type: string
 *                 description: New district (only for AUTHORIZED_PERSON)
 *                 enum:
 *                   - Ampara
 *                   - Anuradhapura
 *                   - Badulla
 *                   - Batticaloa
 *                   - Colombo
 *                   - Galle
 *                   - Gampaha
 *                   - Hambantota
 *                   - Jaffna
 *                   - Kalutara
 *                   - Kandy
 *                   - Kegalle
 *                   - Kilinochchi
 *                   - Kurunegala
 *                   - Mannar
 *                   - Matale
 *                   - Matara
 *                   - Monaragala
 *                   - Mullaitivu
 *                   - Nuwara Eliya
 *                   - Polonnaruwa
 *                   - Puttalam
 *                   - Ratnapura
 *                   - Trincomalee
 *                   - Vavuniya
 */

router.put("/profile", auth,role("ZOOLOGIST"), updateProfile);

module.exports = router;
