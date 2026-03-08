import fetch from "node-fetch";
import crypto from "crypto";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../.env") });

const API_URL = "https://disaster-resource-optimizer-ai-1.onrender.com/api/sms";
// Render's proxy terminates TLS, so the backend sees http:// internally.
// The Twilio signature must be computed with the URL the server reconstructs.
const SIGNING_URL = "http://disaster-resource-optimizer-ai-1.onrender.com/api/sms";
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;

const SAMPLE_MESSAGE = {
  from: "+919800000099",
  body: "Building collapse near Datta Mandir Chowk, people trapped at Wakad",
};

/**
 * Compute Twilio webhook signature so the deployed backend (validateWebhook:true) accepts it.
 * https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
function computeTwilioSignature(authToken, url, params) {
  // Sort params alphabetically and append key+value to URL
  const sortedKeys = Object.keys(params).sort();
  let str = url;
  for (const key of sortedKeys) {
    str += key + params[key];
  }
  return crypto.createHmac("sha1", authToken).update(str).digest("base64");
}

async function simulateSMS() {
  console.log(`Starting simulation of single SMS message...`);
  console.log(`Target URL: ${API_URL}`);

  try {
    console.log(`\nSending from ${SAMPLE_MESSAGE.from}...`);
    console.log(`Body: "${SAMPLE_MESSAGE.body}"`);

    const params = {
      From: SAMPLE_MESSAGE.from,
      Body: SAMPLE_MESSAGE.body,
    };

    const signature = computeTwilioSignature(TWILIO_AUTH_TOKEN, SIGNING_URL, params);
    const urlEncodedBody = new URLSearchParams(params).toString();

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Twilio-Signature": signature,
      },
      body: urlEncodedBody,
    });

    const text = await response.text();
    if (response.ok) {
      console.log("✅ Success:", response.status);
      console.log("Response:", text);
    } else {
      console.error("❌ Failed:", response.status, response.statusText);
      console.error("Response body:", text);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }

  console.log("\n-----------------------------------");
  console.log(`Simulation Complete.`);
  console.log("-----------------------------------");
}

simulateSMS();
