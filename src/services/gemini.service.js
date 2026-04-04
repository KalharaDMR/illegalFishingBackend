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

      const isCurrentlyActive = zone.isActive && start <= now && end >= now;
      const durationDays = Math.max(
        1,
        Math.ceil((end - start) / (1000 * 60 * 60 * 24)),
      );

      let baseRiskScore = 0;

      if (zone.isActive) baseRiskScore += 2;
      if (isCurrentlyActive) baseRiskScore += 3;
      if ((zone.restrictedTime || "").toLowerCase() === "all day")
        baseRiskScore += 2;
      if (durationDays >= 30) baseRiskScore += 1;
      if ((end - now) / (1000 * 60 * 60 * 24) <= 7 && end >= now)
        baseRiskScore += 1;

      let preliminaryRiskLevel = "LOW";
      if (baseRiskScore >= 7) preliminaryRiskLevel = "HIGH";
      else if (baseRiskScore >= 4) preliminaryRiskLevel = "MEDIUM";

      return {
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
    try {
      return JSON.parse(text);
    } catch (_) {
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        throw new Error("Gemini response was not valid JSON");
      }
      return JSON.parse(match[0]);
    }
  }

  async generateAdvisory(zones) {
    const zoneFacts = this.buildZoneFacts(zones);

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

Zone analysis data:
${JSON.stringify(zoneFacts, null, 2)}
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    const rawText = response.text || "{}";
    const parsed = this.extractJson(rawText);

    return {
      generatedAt: new Date().toISOString(),
      zoneCount: zoneFacts.length,
      activeNowCount: zoneFacts.filter((z) => z.isCurrentlyActive).length,
      advisory: parsed,
      zoneFacts,
    };
  }
}

module.exports = new GeminiService();
