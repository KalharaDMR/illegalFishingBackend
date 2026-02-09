const express = require("express");
const {
  getPendingUsers,
  approveUser,
  rejectUser,
  getAllUsers,
  deleteUser,
} = require("../controllers/admin.controller");

const auth = require("../middlewares/auth.middleware");
const role = require("../middlewares/role.middleware");

const router = express.Router();

router.get("/pending-users", auth, role("ADMIN"), getPendingUsers);
router.put("/approve/:id", auth, role("ADMIN"), approveUser);
router.put("/reject/:id", auth, role("ADMIN"), rejectUser);
router.get("/users", auth, role("ADMIN"), getAllUsers);
router.delete("/users/:id", auth, role("ADMIN"), deleteUser);


module.exports = router;
