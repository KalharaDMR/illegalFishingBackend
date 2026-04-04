const RestrictedZoneService = require("../services/restrictedzone.service");
const service = RestrictedZoneService;

const validateLocation = (location) => {
  if (!location) {
    throw new Error("Location is required");
  }

  // If location comes as string (form-data), parse it
  if (typeof location === "string") {
    try {
      location = JSON.parse(location);
    } catch (err) {
      throw new Error("Invalid location format");
    }
  }

  let lat = Number(location.lat);
  let lng = Number(location.lng);

  if (isNaN(lat) || lat < -90 || lat > 90) {
    throw new Error("Invalid latitude value");
  }

  if (isNaN(lng) || lng < -180 || lng > 180) {
    throw new Error("Invalid longitude value");
  }

  return { lat, lng };
};
// Create Zone
const createZone = async (req, res) => {
  try {
    req.body.location = validateLocation(req.body.location);

    const zone = await service.createZone(req.body, req.files);
    res.status(201).json(zone);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update Zone
const updateZone = async (req, res) => {
  try {
    if (req.body.location) {
      req.body.location = validateLocation(req.body.location);
    }

    const zone = await service.updateZone(req.params.id, req.body, req.files);
    res.json(zone);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

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

    if (req.query.active !== undefined) {
      filter.isActive = req.query.active === "true";
    }

    const zones = await service.getZones(filter);
    res.json(zones);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const RestrictedZone = require("../models/restricted.zone");
const geminiService = require("../services/gemini.service");

const getAIAdvisory = async (req, res) => {
  try {
    const activeZones = await RestrictedZone.find({ isActive: true });

    if (!activeZones.length) {
      return res.json({
        generatedAt: new Date().toISOString(),
        zoneCount: 0,
        activeNowCount: 0,
        overallRiskLevel: "LOW",
        executiveSummary: "No active restricted zones available for analysis.",
        keyConcerns: [],
        recommendedActions: [],
        priorityAreas: [],
        expectedImpact: [],
        patrolTiming: {
          highestPriorityWindow: "N/A",
          notes: "No active zones found.",
        },
        zoneAnalysis: [],
      });
    }

    const result = await geminiService.generateAdvisory(activeZones);

    return res.json({
      generatedAt: result.generatedAt,
      zoneCount: result.zoneCount,
      activeNowCount: result.activeNowCount,
      zoneFacts: result.zoneFacts,

      overallRiskLevel: result.advisory?.overallRiskLevel || "LOW",
      executiveSummary:
        result.advisory?.executiveSummary || "No executive summary available.",
      keyConcerns: result.advisory?.keyConcerns || [],
      recommendedActions: result.advisory?.recommendedActions || [],
      priorityAreas: result.advisory?.priorityAreas || [],
      expectedImpact: result.advisory?.expectedImpact || [],
      patrolTiming: result.advisory?.patrolTiming || {
        highestPriorityWindow: "N/A",
        notes: "",
      },

      zoneAnalysis: result.zoneFacts.map((z) => ({
        zoneName: z.zoneName,
        riskScore: z.preliminaryRiskScore,
        ecologicalRisk: z.preliminaryRiskLevel,
        status: z.isCurrentlyActive
          ? "ACTIVE NOW"
          : z.isActive
            ? "ACTIVE"
            : "INACTIVE",
        restrictedTime: z.restrictedTime,
        startDate: z.startDate,
        endDate: z.endDate,
        evidenceCount: z.evidenceCount,
      })),
    });
  } catch (error) {
    console.error("AI advisory error:", error);
    res.status(500).json({
      message: error.message || "Failed to generate AI advisory",
    });
  }
};
module.exports = {
  createZone,
  updateZone,
  deactivateZone,
  deleteZone,
  getZones,
  getAIAdvisory,
};
