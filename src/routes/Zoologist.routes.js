const express = require('express');
const router = express.Router();
const {
  createEndaneredSpeciesEntry,
  getAllEndangeredSpeciesEntryByPagination,
  getEndangeredSpeciesDetailsById,
  updateEndangeredSpeciesEntry,
  deleteEndangeredSpeciesEntry,
  getNearbyEndangeredSpeciesPlaces,
} = require('../controllers/species.controller');
const auth = require("../middlewares/auth.middleware")
const role= require("../middlewares/role.middleware")
const { upload,handleMulterError } = require('../middlewares/upload.middleware');

// Public routes
router.get('/',auth,role("ZOOLOGIST"), getAllEndangeredSpeciesEntryByPagination);
router.get('/:id',auth,role("ZOOLOGIST"), getEndangeredSpeciesDetailsById);
router.post('/nearby',auth,role("ZOOLOGIST"), getNearbyEndangeredSpeciesPlaces);

// Create species (with image upload and validation)
router.post('/',auth,role("ZOOLOGIST"), upload.single('evidence'),handleMulterError, createEndaneredSpeciesEntry);

// Update species (with optional image upload)
router.put('/:id',auth,role("ZOOLOGIST"), upload.single('evidence'), handleMulterError, updateEndangeredSpeciesEntry);

// Delete species
router.delete('/:id',auth,role("ZOOLOGIST"), deleteEndangeredSpeciesEntry);


module.exports = router;