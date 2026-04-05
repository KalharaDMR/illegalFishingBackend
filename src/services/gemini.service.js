const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

class GeminiService {
  buildZoneFacts(zones) {
    const now = new Date();

    return zones.map((zone) => {
      const start = new Date(zone.startDate);
      const end = new Date(zone.endDate);

      // Keep the zone active for the full calendar day range
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);

      const isCurrentlyActive = !!zone.isActive && start <= now && end >= now;

      const durationDays = Math.max(
        1,
        Math.ceil((end - start) / (1000 * 60 * 60 * 24)),
      );

      let baseRiskScore = 0;

      if (zone.isActive) baseRiskScore += 2;
      if (isCurrentlyActive) baseRiskScore += 3;
      if ((zone.restrictedTime || "").toLowerCase() === "all day") {
        baseRiskScore += 2;
      }
      if (durationDays >= 30) baseRiskScore += 1;
      if ((end - now) / (1000 * 60 * 60 * 24) <= 7 && end >= now) {
        baseRiskScore += 1;
      }
      if (Array.isArray(zone.evidenceFiles) && zone.evidenceFiles.length > 0) {
        baseRiskScore += 1;
      }

      let preliminaryRiskLevel = "LOW";
      if (baseRiskScore >= 8) preliminaryRiskLevel = "HIGH";
      else if (baseRiskScore >= 5) preliminaryRiskLevel = "MEDIUM";

      return {
        zoneId: String(zone._id),
        zoneName: zone.name,
        coordinates: zone.location,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        restrictedTime: zone.restrictedTime || "All Day",
        isActive: !!zone.isActive,
        isCurrentlyActive,
        durationDays,
        evidenceCount: Array.isArray(zone.evidenceFiles)
          ? zone.evidenceFiles.length
          : 0,
        preliminaryRiskScore: baseRiskScore,
        preliminaryRiskLevel,
      };
    });
  }

  extractJson(text) {
    const tryParse = (value) => JSON.parse(value);

    const cleanJsonString = (value) => {
      let cleaned = String(value || "").trim();

      // Remove markdown fences if Gemini adds them
      cleaned = cleaned.replace(/```json\s*/gi, "").replace(/```/g, "");

      // Extract the first JSON object block
      const firstBrace = cleaned.indexOf("{");
      const lastBrace = cleaned.lastIndexOf("}");
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleaned = cleaned.slice(firstBrace, lastBrace + 1);
      }

      // Remove trailing commas before } or ]
      cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");

      return cleaned;
    };

    try {
      return tryParse(text);
    } catch (_) {
      const cleaned = cleanJsonString(text);

      try {
        return tryParse(cleaned);
      } catch (err) {
        console.error("Raw Gemini response:", text);
        console.error("Cleaned Gemini response:", cleaned);
        throw new Error(`Gemini response was not valid JSON: ${err.message}`);
      }
    }
  }

  buildFallbackAdvisory(zoneFacts, selectedZoneName = null) {
    const sorted = [...zoneFacts].sort(
      (a, b) => b.preliminaryRiskScore - a.preliminaryRiskScore,
    );

    const topZone = sorted[0];
    const activeNowCount = zoneFacts.filter((z) => z.isCurrentlyActive).length;
    const highestScore = topZone?.preliminaryRiskScore || 0;

    let overallRiskLevel = "LOW";
    if (highestScore >= 10) overallRiskLevel = "CRITICAL";
    else if (highestScore >= 8) overallRiskLevel = "HIGH";
    else if (highestScore >= 5) overallRiskLevel = "MEDIUM";

    const summary = selectedZoneName
      ? `Selected restricted area "${selectedZoneName}" requires monitoring based on current schedule, restriction timing, and supporting evidence signals.`
      : activeNowCount > 1
        ? "Multiple restricted areas are active at the same time and need coordinated enforcement attention."
        : topZone
          ? `The highest-priority restricted area is "${topZone.zoneName}" based on current activity and risk indicators.`
          : "Restricted area review completed with limited active risk signals.";

    return {
      overallRiskLevel,
      executiveSummary: summary,
      keyConcerns: [
        activeNowCount > 0
          ? "At least one restricted area is currently active."
          : "No area is currently active by date window.",
        topZone
          ? `${topZone.zoneName} has the strongest current risk indicators.`
          : "No priority area could be determined.",
      ],
      priorityAreas: topZone
        ? [
            {
              zoneId: topZone.zoneId,
              zoneName: topZone.zoneName,
              riskLevel: topZone.preliminaryRiskLevel,
              reason:
                "Prioritized using active status, restriction timing, duration, and available evidence count.",
              recommendedPatrolTiming: topZone.restrictedTime || "All Day",
            },
          ]
        : [],
      recommendedActions: [
        "Prioritize patrol visibility in the selected high-risk zone.",
        "Verify restriction compliance and document any suspicious activity.",
      ],
      expectedImpact: [
        "Improved monitoring coverage for restricted waters.",
        "Faster enforcement response in higher-risk periods.",
      ],
      patrolTiming: {
        highestPriorityWindow: topZone?.restrictedTime || "All Day",
        notes:
          activeNowCount > 0
            ? "Focus patrol resources during the active restriction window."
            : "Prepare monitoring around the next active restriction period.",
      },
    };
  }

  async generateAdvisory(zones, selectedZoneName = null) {
    const zoneFacts = this.buildZoneFacts(zones);

    const scopeLine = selectedZoneName
      ? `Focus the analysis primarily on this selected area: "${selectedZoneName}".`
      : "Analyze all provided restricted areas together and prioritize the highest-risk areas.";

    const prompt = `
You are an AI decision-support assistant for authorized fisheries enforcement officers.

Your task is to analyze restricted fishing zones and return a STRICT JSON object only.
Do not wrap the answer in markdown.
Do not include explanations outside JSON.

Use the following structure exactly:

{
  "overallRiskLevel": "LOW | MEDIUM | HIGH | CRITICAL",
  "executiveSummary": "string",
  "keyConcerns": ["string", "string"],
  "priorityAreas": [
    {
      "zoneId": "string",
      "zoneName": "string",
      "riskLevel": "LOW | MEDIUM | HIGH | CRITICAL",
      "reason": "string",
      "recommendedPatrolTiming": "string"
    }
  ],
  "recommendedActions": ["string", "string"],
  "expectedImpact": ["string", "string"],
  "patrolTiming": {
    "highestPriorityWindow": "string",
    "notes": "string"
  }
}

Rules:
- Make the output operational, concise, and field-oriented.
- Focus on enforcement monitoring, illegal fishing prevention, and patrol planning.
- Mention urgency when needed.
- Prioritize zones with higher preliminary risk.
- If several zones are active at the same time, elevate concern.
- Use practical action language suitable for authorized officers.
- Keep each bullet short and useful.
- Return valid JSON only.
- Do not use trailing commas.
- Do not include comments.
- Do not include markdown code fences.
- All property names must be double-quoted JSON keys.
- When a selected area is provided, ensure the summary and recommendations are centered on that area.
- Use the given zoneId values in priorityAreas whenever relevant.

${scopeLine}

Zone analysis data:
${JSON.stringify(zoneFacts, null, 2)}
`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const rawText = response.text || "{}";
      console.log("Gemini raw response:", rawText);

      let parsed;
      try {
        parsed = this.extractJson(rawText);
      } catch (parseError) {
        console.error("Gemini parse failed:", parseError.message);
        parsed = this.buildFallbackAdvisory(zoneFacts, selectedZoneName);
      }

      return {
        generatedAt: new Date().toISOString(),
        zoneCount: zoneFacts.length,
        activeNowCount: zoneFacts.filter((z) => z.isCurrentlyActive).length,
        advisory: parsed,
        zoneFacts,
      };
    } catch (error) {
      const msg =
        error?.message || error?.error?.message || JSON.stringify(error);

      if (
        msg.includes("429") ||
        msg.includes("RESOURCE_EXHAUSTED") ||
        msg.toLowerCase().includes("quota")
      ) {
        throw new Error("Gemini API quota exceeded");
      }

      throw error;
    }
  }
}

module.exports = new GeminiService();
