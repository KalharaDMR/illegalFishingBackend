const Species = require('../models/Species.model');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');
const { calculateDistance } = require('../utils/geoUtils');
const mongoose = require('mongoose');

/**
 * @desc    Create new Endangered species entry
 * @route   POST /api/species
 * @access  Public/Zoologist
 */
const createEndaneredSpeciesEntry = async (req, res) => {
  try {

    /* ===============================
       1. Extract and Parse Data
    =============================== */

    let {
      fishes,
      description,
      location,
      threats,
      tags,
    } = req.body;
    // Parse fishes if string
    if (typeof fishes === "string") {
      fishes = JSON.parse(fishes);
    }

    // Parse location if string
    if (typeof location === "string") {
      location = JSON.parse(location);
    }

    // Parse threats if string
    if (typeof threats === "string") {
      threats = JSON.parse(threats);
    }

    // Parse tags if string
    if (typeof tags === "string") {
      tags = JSON.parse(tags);
    }


    /* ===============================
       2. Validate Fishes
    =============================== */

    if (!Array.isArray(fishes) || fishes.length === 0) {
      return res.status(400).json({
        error: "At least one fish entry is required"
      });
    }

    for (const fish of fishes) {
      const { scientificName, localName, conservationStatus } = fish;

      if (!scientificName || !localName || !conservationStatus) {
        return res.status(400).json({
          error: "All fish entries must have scientific name, local name, and conservation status"
        });
      }
    }


    /* ===============================
       3. Validate Description
    =============================== */

    if (description && description.length < 20) {
      return res.status(400).json({
        error: "Description must be at least 20 characters long"
      });
    }

    if (description && description.length > 2000) {
      return res.status(400).json({
        error: "Description must not exceed 2000 characters"
      });
    }


    /* ===============================
       4. Validate Location
    =============================== */

    if (
      !location ||
      !location.coordinates ||
      location.coordinates.length !== 2
    ) {
      return res.status(400).json({
        error: "Valid location coordinates (longitude, latitude) are required"
      });
    }

    const longitude = parseFloat(location.coordinates[0]);
    const latitude = parseFloat(location.coordinates[1]);

    if (
      longitude < -180 || longitude > 180 ||
      latitude < -90 || latitude > 90
    ) {
      return res.status(400).json({
        error: "Invalid coordinates. Longitude must be between -180 and 180, latitude between -90 and 90"
      });
    }


    /* ===============================
       5. Check existing species at location
    =============================== */

    const existingSpecies = await Species.findOne({
      "location.type": "Point",
      "location.coordinates": [longitude, latitude]
    });

    if (existingSpecies) {
      return res.status(400).json({
        error: "The location already has an endangered species entry. Please provide a different location or update the existing entry."
      });
    }


    /* ===============================
       6. Upload Evidence Image
    =============================== */

    if (!req.file) {
      return res.status(400).json({
        error: "Evidence image is required"
      });
    }

    let evidenceObject;

    try {
      const uploadResult = await uploadToCloudinary(
        req.file.path,
        "marine-species/evidence"
      );

      evidenceObject = {
        url: uploadResult.url,
        publicId: uploadResult.publicId,
        format: uploadResult.format,
      };

    } catch (error) {
      return res.status(500).json({
        error: `Image upload failed: ${error.message}`
      });
    }


    /* ===============================
       7. Format Location
    =============================== */

    const locationData = {
      type: "Point",
      coordinates: [longitude, latitude],
      address: location.address || "",
      city: location.city || "",
      country: location.country || "",
      formattedAddress:
        location.formattedAddress || location.address || ""
    };


    /* ===============================
       8. Create Species Document
    =============================== */

    const species = await Species.create({
      fishes,
      description,
      evidence: evidenceObject,
      location: locationData,
      threats: Array.isArray(threats) ? threats : [],
      tags: Array.isArray(tags) ? tags : [],
      submittedBy: req.user?.userId || null,
      isVerified: false
    });


    /* ===============================
       9. Success Response
    =============================== */

    return res.status(201).json({
      success: true,
      message: "Species created successfully",
      data: species
    });

  } catch (error) {

    console.error(error);

    return res.status(500).json({
      error: error.message
    });

  }
};

/**
 * @desc    Get all Endangered species with filtering and pagination
 * @route   GET /api/species
 * @access  Public
 */
const getAllEndangeredSpeciesEntryByPagination = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sortBy = 'createdAt',
      order = 'desc'
    } = req.query;

    const query = {};

    // Filter by conservation status (nested in fishes)
    if (status) {
      query['fishes.conservationStatus'] = status;
    }

    // Search by scientific/local name or description
    if (search) {
      query.$or = [
        { 'fishes.scientificName': { $regex: search, $options: 'i' } },
        { 'fishes.localName': { $regex: search, $options: 'i' } },
      ];
    }
    query.isVerified = true
    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort
    const sortOrder = order === 'asc' ? 1 : -1;
    const sortOptions = { [sortBy]: sortOrder };

    // Execute query
    const species = await Species.find(query)
      .sort(sortOptions)
      .limit(limitNum)
      .skip(skip)
      .select('-__v');

    // Get total count
    const totalCount = await Species.countDocuments(query);

    return res.status(200).json({
      success: true,
      count: species.length,
      total: totalCount,
      currentPage: pageNum,
      totalPages: Math.ceil(totalCount / limitNum),
      data: species
    });

  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

/**
 * @desc    Get single species by ID
 * @route   GET /api/species/:id
 * @access  Public
 */
const getEndangeredSpeciesDetailsByLocation = async (req, res) => {
  const {location} = req.body
  if (!location || !location.coordinates || location.coordinates.length !== 2) {
    return res.status(400).json({ error: "Valid location coordinates (longitude, latitude) are required" });
  }
  const species = await Species.findOne({
          "location.type": "Point",
          "location.coordinates": [location.coordinates[0], location.coordinates[1]]
        }).select('-__v');

  if (!species) 
  {
    return res.status(404).json({error:"Endangered species entry not found"});
  }

  return res.status(200).json({
    success: true,
    data: species
  });
};

/**
 * @desc    Update species
 * @route   PUT /api/species/:id
 * @access  Zoologist/Admin
 */
const updateEndangeredSpeciesEntry = async (req, res) => {

  if (!mongoose.Types.ObjectId.isValid(req.params.id)) 
  {
      return res.status(400).json({ success: false, message: 'Invalid Endangered Species ID' });
  }
  let species = await Species.findById(req.params.id);

  if (!species) 
  {
    return res.status(404).json({error:"Endangered species entry not found"});
  }
  if(species.id!==req.user.userId)
  {
    return res.status(403).json({error:"You are not authorized to update this entry"});
  }
  let {
      fishes,
      description,
      location,
      threats,
      tags,
  } = req.body;
    try{
      if (fishes && typeof fishes === "string") 
      {
        fishes = JSON.parse(fishes);
      }
      // Parse location if string
      if (location && typeof location === "string") {
        location = JSON.parse(location);
      }
      // Parse threats if string
      if (threats && typeof threats === "string") {
        threats = JSON.parse(threats);
      }
      // Parse tags if string
      if (tags && typeof tags === "string") {
        tags = JSON.parse(tags);
      }
    }catch(err)
    {
      return res.status(400).json({ error: "Invalid JSON format for fishes, location, threats, or tags" });
    }
    if(fishes && (!Array.isArray(fishes) || fishes.length === 0))
      {
        return res.status(400).json({ error: "Fishes must be an array with at least one element" });
      }
    if(fishes && Array.isArray(fishes) && fishes.length > 0)
      {
        for(const fish of fishes)
        {
            const { scientificName, localName, conservationStatus } = fish;
            if(!scientificName || !localName || !conservationStatus)
            {
              return res.status(400).json({ error: "All fish entries must have scientific name, local name, and conservation status" });
            }
        }
      }
    if(threats && !Array.isArray(threats))
      {
        return res.status(400).json({ error: "Threats must be an array" });
      }
    
    if(tags && !Array.isArray(tags))
      {
        return res.status(400).json({ error: "Tags must be an array" });
      }
    
    if(description && description.length <20)
      {
        return res.status(400).json({ error: "Description must be at least 20 characters long" });
      }

    if(description && description.length > 2000)
      {
        return res.status(400).json({ error: "Description must not exceed 2000 characters" });
      }
    // Handle image upload if new image is provided
    if (req.file) {
      try {
        // Delete old image from Cloudinary if exists
        if (species.evidence.publicId) {
          await deleteFromCloudinary(species.evidence.publicId);
        }

        // Upload new image
        const uploadResult = await uploadToCloudinary(req.file.path, 'marine-species/evidence');
        species.evidence = {
          url: uploadResult.url,
          publicId: uploadResult.publicId,
          format: uploadResult.format
        };
      } catch (error) {
        return res.status(500).json({ error: `Image upload failed: ${error.message}` });
      }
  }

  try{
      // Update fields
      if (description) species.description = description;
      if (fishes) species.fishes = fishes;
      if (threats) species.threats = Array.isArray(threats) ? threats : [];
      if (tags) species.tags = Array.isArray(tags) ? tags : [];

      // Update location if provided
      if (location && location.coordinates && location.coordinates.length === 2) {
        species.location = {
          type: 'Point',
          coordinates: [
            parseFloat(location.coordinates[0]),
            parseFloat(location.coordinates[1])
          ],
          address: location.address || species.location.address,
          city: location.city || species.location.city,
          country: location.country || species.location.country,
          formattedAddress: location.formattedAddress || location.address || species.location.formattedAddress
        };
      }

      await species.save();

      return res.status(200).json({
        success: true,
        message: 'Species updated successfully',
        data: species
      });
  }catch(err)
  {
    return res.status(500).json({error:err.message})
  }
};

/**
 * @desc    Delete species
 * @route   DELETE /api/species/:id
 * @access  Admin
 */
const deleteEndangeredSpeciesEntry = async (req, res) => {
  try{
  const species = await Species.findById(req.params.id);

  if (!species) {
    return res.status(404).json({ error: "Species not found" });
  }
  if(species.id!==req.user.userId)
  {
    return res.status(403).json({error:"You are not authorized to delete this entry"});
  }
  // Delete image from Cloudinary
  if (species.evidence.publicId) {
    try {
      await deleteFromCloudinary(species.evidence.publicId);
    } catch (error) {
      return res.status(500).json({ error: `Failed to delete evidence image: ${error.message}` });
    }
  }

  await species.deleteOne();

  return res.status(200).json({
    success: true,
    message: 'Species deleted successfully',
  });
  }catch(err)
  {
    return res.status(500).json({error:err.message})
  }
};

/**
 * @desc    Get endangered species near user location
 * @route   POST /api/species/nearby
 * @access  Public
 */
const getNearbyEndangeredSpeciesPlaces = async (req, res) => {
  const { longitude, latitude, maxDistance = 50000 } = req.body;

  // Validate coordinates
  if (!longitude || !latitude) {
    return res.status(400).json({ error: 'Longitude and latitude are required' });
  }

  const lng = parseFloat(longitude);
  const lat = parseFloat(latitude);

  // Validate coordinate ranges
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
    return res.status(400).json({ error: 'Invalid coordinates. Longitude must be between -180 and 180, latitude between -90 and 90' });
  }

  // Convert maxDistance to number (in meters)
  const maxDist = parseInt(maxDistance);

  try {
    // Use MongoDB's geospatial query
    const nearbySpecies = await Species.find({
      location: {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [lng, lat]
          },
          $maxDistance: maxDist
        }
      }
    }).select('-__v').limit(50); // Limit to 50 results

    // Calculate actual distances for each species
    const speciesWithDistance = nearbySpecies.map(species => {
      const distance = calculateDistance(
        lat,
        lng,
        species.location.coordinates[1],
        species.location.coordinates[0]
      );

      return {
        ...species.toObject(),
        distanceKm: parseFloat(distance.toFixed(2)),
        distanceMiles: parseFloat((distance * 0.621371).toFixed(2))
      };
    });

    // Sort by distance
    speciesWithDistance.sort((a, b) => a.distanceKm - b.distanceKm);

    res.status(200).json({
      success: true,
      count: speciesWithDistance.length,
      userLocation: {
        latitude: lat,
        longitude: lng
      },
      maxDistanceKm: (maxDist / 1000).toFixed(2),
      data: speciesWithDistance
    });
  } catch (error) {
    return res.status(500).json({ error: `Error finding nearby species: ${error.message}` });
  }
};

const getAllEndangeredSpeciesEntry = async (req, res) => {
  try {
    const species = await Species.find().select('-__v');
    return res.status(200).json({
      success: true,
      count: species.length,
      data: species
    });
  }catch(err)
  {
    return res.status(500).json({error:err.message})
  } 
}

module.exports = {
  createEndaneredSpeciesEntry,
  getAllEndangeredSpeciesEntryByPagination,
  getEndangeredSpeciesDetailsByLocation,
  updateEndangeredSpeciesEntry,
  deleteEndangeredSpeciesEntry,
  getAllEndangeredSpeciesEntry,
  getNearbyEndangeredSpeciesPlaces,
};