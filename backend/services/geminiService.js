import { GoogleGenerativeAI } from "@google/generative-ai";
import config from "../config/index.js";
import { logger } from "../utils/appLogger.js";
import { AI_MODELS } from "../constants/index.js";

// Initialize Gemini AI (single instance for all operations)
const genAI = new GoogleGenerativeAI(config.geminiApiKey);
const model = genAI.getGenerativeModel({ model: AI_MODELS.GEMINI });

/**
 * ========================================
 * SMS TRIAGE ANALYSIS
 * ========================================
 * Analyzes incoming SMS messages from citizens and extracts structured data.
 */

const SMS_TRIAGE_PROMPT = (messageBody) => `
You are a disaster response triage bot. Analyze the following SMS message 
from a citizen in distress. Extract the key information and return *only* a valid JSON object. Do not add any other text, greetings, markdown (like \`\`\`json), 
or explanations.

The JSON object must strictly follow this format:
{
  "needType": "string",
  "location": "string",
  "details": "string",
  "urgency": "string"
}

---
JSON Key Definitions:
* "needType": Must be one of: 'Water', 'Food', 'Medical', 'Rescue', 'Other'.
* "location": The physical location mentioned (e.g., "123 Main St", "high school gym"). If unknown, set to "Unknown".
* "details": Any other useful information (e.g., "3 people trapped", "no power").
* "urgency": Must be one of: 'Low', 'Medium', 'High'. Base this on the message's tone and content.
---

Example Message 1: 'Help we need water and medicine at the old high school on main street. my grandmother is sick'
Example JSON Output 1:
{
  "needType": "Medical",
  "location": "old high school on main street",
  "details": "Need water and medicine. Grandmother is sick.",
  "urgency": "High"
}

Example Message 2: 'trapped in my attic at 405 pine avenue, water rising fast!!'
Example JSON Output 2:
{
  "needType": "Rescue",
  "location": "405 pine avenue",
  "details": "Trapped in attic, water rising fast.",
  "urgency": "High"
}

Example Message 3: 'we need food for 2 families near the central park statue'
Example JSON Output 3:
{
  "needType": "Food",
  "location": "near the central park statue",
  "details": "Need food for 2 families.",
  "urgency": "Medium"
}
---

Now, analyze this message:
Message: "${messageBody}"

JSON Output:
`;

/**
 * Analyzes a raw SMS message and returns structured triage data.
 * @param {string} messageBody - The raw text from the SMS.
 * @returns {Promise<object>} A promise that resolves to the structured triage object.
 */
async function triageSMS(messageBody) {
  try {
    const prompt = SMS_TRIAGE_PROMPT(messageBody);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonText = response.text();

    const triageData = JSON.parse(jsonText);

    // Validate enum values
    const validNeed = ["Water", "Food", "Medical", "Rescue", "Other"].includes(
      triageData.needType
    );
    const validUrgency = ["Low", "Medium", "High"].includes(triageData.urgency);

    if (!validNeed || !validUrgency) {
      logger.warn(
        "Gemini returned invalid enum values. Defaulting to safe values."
      );
      if (!validNeed) triageData.needType = "Other";
      if (!validUrgency) triageData.urgency = "Medium";
    }

    logger.debug("SMS triage completed successfully", {
      needType: triageData.needType,
    });
    return triageData;
  } catch (error) {
    logger.error("Error in SMS Triage:", error.message);
    throw error;
  }
}

/**
 * ========================================
 * REPORT ANALYSIS (Oracle)
 * ========================================
 * Analyzes visual/audio reports and determines severity, needs, and summary.
 */

const REPORT_ANALYSIS_PROMPT = (report) => {
  const tag = report.sentinelData?.tag || "Unknown";
  const confidence = report.sentinelData?.confidence
    ? (report.sentinelData.confidence * 100).toFixed(1) + "%"
    : "N/A";
  const userText = report.text || "No additional text provided";

  return `You are a disaster response AI analyst. Analyze the following disaster report:

The visual agent detected "${tag}" with ${confidence} confidence.
The user text reported: "${userText}"
Location: Lat ${report.location?.lat || "N/A"}, Lng ${
    report.location?.lng || "N/A"
  }

Based on this information, assess the situation and provide your analysis.

Return ONLY valid JSON in this exact format (no markdown, no code blocks):
{
  "severity": <number from 1-10, where 10 is most severe>,
  "needs": [<array of strings like "Water", "Medical", "Rescue", "Shelter", "Food", "Evacuation", "Fire Suppression", etc>],
  "summary": "<brief 1-2 sentence summary of the situation>"
}`;
};

/**
 * Analyzes a report and returns severity assessment.
 * @param {object} report - The report document with sentinelData and text.
 * @returns {Promise<object>} Analysis result with severity, needs, and summary.
 */
async function analyzeReport(report) {
  const prompt = REPORT_ANALYSIS_PROMPT(report);

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();

    // Clean up the response (remove markdown code blocks if present)
    text = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();

    const analysisResult = JSON.parse(text);

    // Validate the response structure
    if (
      typeof analysisResult.severity !== "number" ||
      !Array.isArray(analysisResult.needs) ||
      typeof analysisResult.summary !== "string"
    ) {
      throw new Error("Invalid response structure from Gemini");
    }

    // Clamp severity between 1-10
    analysisResult.severity = Math.max(
      1,
      Math.min(10, analysisResult.severity)
    );

    logger.debug("Report analysis completed", {
      severity: analysisResult.severity,
    });
    return analysisResult;
  } catch (error) {
    logger.error("Error in Report Analysis:", error.message);
    throw error;
  }
}

export { triageSMS, analyzeReport };
