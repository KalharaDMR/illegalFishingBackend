const RestrictedZoneService = require("../services/restrictedzone.service");

const service = RestrictedZoneService;

const createZone = async (req, res) => {
  try {
    const zone = await service.createZone(req.body);
    res.status(201).json(zone);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateZone = async (req, res) => {
  try {
    const zone = await service.updateZone(req.params.id, req.body);
    res.json(zone);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deactivateZone = async (req, res) => {
  try {
    const zone = await service.deactivateZone(req.params.id);
    res.json(zone);
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

    if (req.query.active) {
      filter.isActive = req.query.active === "true";
    }

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
