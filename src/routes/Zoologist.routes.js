const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  createEndaneredSpeciesEntry,
  getAllEndangeredSpeciesEntryByPagination,
  getEndangeredSpeciesDetailsByLocation,
  updateEndangeredSpeciesEntry,
  deleteEndangeredSpeciesEntry,
  getNearbyEndangeredSpeciesPlaces,
  getAllEndangeredSpeciesEntry
} = require('../controllers/species.controller');
const auth = require("../middlewares/auth.middleware")
const role= require("../middlewares/role.middleware")

const storage = multer.diskStorage({
  destination: "src/uploads/",
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// Get all species with pagination
router.get('/',auth,role("ZOOLOGIST"), getAllEndangeredSpeciesEntryByPagination);

// Get nearby endangered species places
router.post('/nearby',auth,role("ZOOLOGIST"), getNearbyEndangeredSpeciesPlaces);

// Create species (with image upload and validation)
router.post('/',auth,role("ZOOLOGIST"), upload.single('evidence'),createEndaneredSpeciesEntry);

// Update species (with optional image upload)
router.put('/:id',auth,role("ZOOLOGIST"), upload.single('evidence'),updateEndangeredSpeciesEntry);

// Delete species
router.delete('/:id',auth,role("ZOOLOGIST"), deleteEndangeredSpeciesEntry);

// Get species details by location
router.post('/details-by-location',auth,role("ZOOLOGIST"), getEndangeredSpeciesDetailsByLocation);

router.get('/all',auth,role("ZOOLOGIST"), getAllEndangeredSpeciesEntry);

module.exports = router;