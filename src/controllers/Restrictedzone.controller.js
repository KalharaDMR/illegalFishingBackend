const RestrictedZoneService = require("../services/restrictedzone.service");
const service = RestrictedZoneService;

// Helper to parse and validate boundaries
const parseBoundaries = (boundaries) => {
  if (!boundaries) return [];

  // Parse if it's a string (common in multipart/form-data)
  if (typeof boundaries === "string") {
    try {
      boundaries = JSON.parse(boundaries);
    } catch (err) {
      throw new Error("Invalid JSON format for boundaries");
    }
  }

  // Must be an array
  if (!Array.isArray(boundaries)) {
    throw new Error("Boundaries must be an array of objects");
  }

  // Validate each point
  const isValid = boundaries.every(
    (point) =>
      point.lat !== undefined &&
      typeof point.lat === "number" &&
      point.lng !== undefined &&
      typeof point.lng === "number",
  );

  if (!isValid) {
    throw new Error("Each boundary point must have numeric lat and lng");
  }

  // Optional: check for minimum 3 points
  if (boundaries.length < 3) {
    throw new Error("Boundaries must have at least 3 points");
  }

  return boundaries;
};

// Create Zone
const createZone = async (req, res) => {
  try {
    req.body.boundaries = parseBoundaries(req.body.boundaries);
    const zone = await service.createZone(req.body, req.files);
    res.status(201).json(zone);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update Zone
const updateZone = async (req, res) => {
  try {
    if (req.body.boundaries) {
      req.body.boundaries = parseBoundaries(req.body.boundaries);
    }
    const zone = await service.updateZone(req.params.id, req.body, req.files);
    res.json(zone);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Other controllers remain the same
const deactivateZone = async (req, res) => {
  try {
    const updated = await service.deactivateZone(req.params.id);
    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteZone = async (req, res) => {
  try {
    const result = await service.deleteZone(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const getZones = async (req, res) => {
  try {
    const filter = {};
    if (req.query.active) filter.isActive = req.query.active === "true";

    const zones = await service.getZones(filter);
    res.json(zones);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  createZone,
  updateZone,
  deactivateZone,
  deleteZone,
  getZones,
};
