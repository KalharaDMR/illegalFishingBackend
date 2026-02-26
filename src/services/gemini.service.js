const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

class GeminiService {
  async generateAdvisory(zones) {
    const zoneSummary = zones
      .map(
        (zone) =>
          `${zone.name} | ${new Date(zone.startDate).toDateString()} - ${new Date(zone.endDate).toDateString()} | ${zone.restrictedTime}`,
      )
      .join("\n");

    const prompt = `
You are an environmental advisory assistant supporting sustainable fisheries management.

Based on the following restricted fishing zones:

${zoneSummary}

Generate a short conservation advisory (5–6 lines).
Focus on:
- Sustainable fishing
- Enforcement monitoring
- Risk awareness
- SDG 14 (Life Below Water)

Keep it professional and concise.
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });

    return response.text;
  }
}

module.exports = new GeminiService();
