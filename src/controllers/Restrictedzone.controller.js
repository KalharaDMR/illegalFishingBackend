const RestrictedZoneService = require("../services/restrictedzone.service");
const service = RestrictedZoneService;
const RestrictedZone = require("../models/restricted.zone");
const geminiService = require("../services/gemini.service");

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

const getAIAdvisory = async (req, res) => {
  try {
    const { zoneId } = req.query;

    let zones = [];
    let selectedZone = null;

    if (zoneId) {
      selectedZone = await RestrictedZone.findOne({
        _id: zoneId,
        isActive: true,
      });

      if (!selectedZone) {
        return res.status(404).json({
          message: "Selected restricted area not found or inactive.",
        });
      }

      zones = [selectedZone];
    } else {
      zones = await RestrictedZone.find({ isActive: true });
    }

    if (!zones.length) {
      return res.json({
        generatedAt: new Date().toISOString(),
        zoneCount: 0,
        activeNowCount: 0,
        selectedZoneId: zoneId || "",
        selectedZoneName: selectedZone?.name || "",
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
        availableZones: [],
      });
    }

    const result = await geminiService.generateAdvisory(
      zones,
      selectedZone?.name || null,
    );

    const zoneAnalysis = result.zoneFacts.map((z) => ({
      zoneId: z.zoneId,
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
    }));

    const allActiveZones = await RestrictedZone.find({ isActive: true });

    const availableZones = allActiveZones.map((zone) => ({
      zoneId: String(zone._id),
      zoneName: zone.name,
    }));

    return res.json({
      generatedAt: result.generatedAt,
      zoneCount: result.zoneCount,
      activeNowCount: result.activeNowCount,
      selectedZoneId: zoneId || "",
      selectedZoneName: selectedZone?.name || "",
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

      zoneAnalysis,
      availableZones,
    });
  } catch (error) {
    console.error("AI advisory error:", error);

    const errorText =
      error?.message ||
      error?.error?.message ||
      "Failed to generate AI advisory";

    if (
      errorText.includes("Gemini API quota exceeded") ||
      errorText.includes("429") ||
      errorText.includes("RESOURCE_EXHAUSTED") ||
      errorText.toLowerCase().includes("quota")
    ) {
      return res.status(429).json({
        message:
          "AI advisory is temporarily unavailable because the Gemini API quota has been exceeded. Please try again shortly.",
      });
    }

    return res.status(500).json({
      message: errorText || "Failed to generate AI advisory",
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
