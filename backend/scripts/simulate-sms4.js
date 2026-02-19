import fetch from "node-fetch";

const API_URL = "http://localhost:3000/api/sms";

const SAMPLE_MESSAGE = {
  from: "+919800000098",
  body: "Fire broke out at Marunji Road. Smoke everywhere.",
};

async function simulateSMS() {
  console.log(`Starting simulation of single SMS message...`);
  console.log(`Target URL: ${API_URL}`);

  try {
    console.log(`\nSending from ${SAMPLE_MESSAGE.from}...`);
    console.log(`Body: "${SAMPLE_MESSAGE.body}"`);

    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        From: SAMPLE_MESSAGE.from,
        Body: SAMPLE_MESSAGE.body,
      }),
    });

    if (response.ok) {
      const text = await response.text();
      console.log("✅ Success:", response.status);
      console.log("Response:", text);
    } else {
      console.error("❌ Failed:", response.status, response.statusText);
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }

  console.log("\n-----------------------------------");
  console.log(`Simulation Complete.`);
  console.log("-----------------------------------");
}

simulateSMS();
