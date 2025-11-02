// File: services/geminiService.js

import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize the Gemini client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

/**
 * This is the master prompt for the Gemini AI.
 * It's engineered to force the AI to return *only* a valid JSON string.
 * This is crucial for parsing the output reliably.
 */
const getTriagePrompt = (messageBody) => {
  return `
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
};

/**
 * Analyzes a raw SMS message and returns structured triage data.
 * @param {string} messageBody - The raw text from the SMS.
 * @returns {Promise<object>} A promise that resolves to the structured triage object.
 */
async function triageSMS(messageBody) {
  try {
    const prompt = getTriagePrompt(messageBody);
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const jsonText = response.text();

    // Parse the JSON text returned by Gemini
    const triageData = JSON.parse(jsonText);
    
    // Basic validation (can be expanded)
    const validNeed = ['Water', 'Food', 'Medical', 'Rescue', 'Other'].includes(triageData.needType);
    const validUrgency = ['Low', 'Medium', 'High'].includes(triageData.urgency);

    if (!validNeed || !validUrgency) {
        console.warn('Gemini returned invalid enum values. Defaulting.');
        // Handle cases where Gemini might hallucinate a new category
        if (!validNeed) triageData.needType = 'Other';
        if (!validUrgency) triageData.urgency = 'Medium';
    }

    return triageData;

  } catch (error) {
    console.error('Error in Gemini Triage Service:', error);
    // Fallback in case AI fails: Save the raw message with default values
    return {
      needType: 'Other',
      location: 'Unknown',
      details: `AI Triage Failed. Raw: ${messageBody}`,
      urgency: 'Medium',
    };
  }
}

export { triageSMS };
