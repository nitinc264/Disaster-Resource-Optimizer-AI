import fetch from "node-fetch";

const API_URL = "http://localhost:3000/api/whatsapp";

/**
 * Simulate WhatsApp messages to test the webhook.
 *
 * Twilio WhatsApp webhooks send these fields:
 *   - From: "whatsapp:+91XXXXXXXXXX"
 *   - Body: message text
 *   - NumMedia: "0" or "1"
 *   - MediaUrl0 / MediaContentType0: image attachment
 *   - Latitude / Longitude: native location sharing
 */
const SCENARIOS = [
  // --- Text-only message (same as SMS but via WhatsApp) ---
  {
    label: "Text report: Flood in Kothrud",
    payload: {
      From: "whatsapp:+919800100001",
      Body: "Heavy flooding in Kothrud near Paud Road. Water level rising fast. Need rescue boats!",
      NumMedia: "0",
    },
  },

  // --- Text + shared location (WhatsApp location pin) ---
  {
    label: "Text + location: Fire at Hinjewadi",
    payload: {
      From: "whatsapp:+919800100002",
      Body: "Major fire broke out in warehouse at Hinjewadi Phase 1. Multiple explosions heard.",
      NumMedia: "0",
      Latitude: "18.5912",
      Longitude: "73.7390",
    },
  },

  // --- Pure location share (no text) — follow-up scenario ---
  {
    label: "Location-only share",
    payload: {
      From: "whatsapp:+919800100003",
      Body: "",
      NumMedia: "0",
      Latitude: "18.5314",
      Longitude: "73.8446",
    },
  },

  // --- Text with high urgency ---
  {
    label: "Urgent medical: Deccan area",
    payload: {
      From: "whatsapp:+919800100004",
      Body: "Building wall collapsed on Fergusson College Road near Deccan. 3 people trapped under rubble. Need ambulance and rescue team IMMEDIATELY!",
      NumMedia: "0",
      Latitude: "18.5195",
      Longitude: "73.8407",
    },
  },

  // --- Duplicate report (should cluster with Kothrud flood) ---
  {
    label: "Duplicate: Another Kothrud flood report",
    payload: {
      From: "whatsapp:+919800100005",
      Body: "Water everywhere in Kothrud near Paud Road bridge. Cars are floating. Please send help!",
      NumMedia: "0",
    },
  },

  // --- Medical emergency ---
  {
    label: "Medical emergency: Katraj",
    payload: {
      From: "whatsapp:+919800100006",
      Body: "My grandmother is having a heart attack. We are at Katraj Chowk. No ambulance available. Please help us!",
      NumMedia: "0",
      Latitude: "18.4529",
      Longitude: "73.8687",
    },
  },

  // --- Gas leak ---
  {
    label: "Gas leak: Koregaon Park",
    payload: {
      From: "whatsapp:+919800100007",
      Body: "Strong gas smell in our building at Koregaon Park Lane 5. Evacuating with kids. Fire brigade needed.",
      NumMedia: "0",
    },
  },

  // --- Follow-up: location for first message (Kothrud flood person) ---
  {
    label: "Follow-up location for Kothrud report",
    payload: {
      From: "whatsapp:+919800100001",
      Body: "",
      NumMedia: "0",
      Latitude: "18.5074",
      Longitude: "73.8077",
    },
  },
];

async function simulateWhatsApp() {
  console.log(
    `\n🟢 Starting WhatsApp simulation: ${SCENARIOS.length} messages`,
  );
  console.log(`Target: ${API_URL}\n`);
  console.log("=".repeat(60));

  let successCount = 0;
  let failCount = 0;

  for (const [index, scenario] of SCENARIOS.entries()) {
    try {
      console.log(
        `\n[${index + 1}/${SCENARIOS.length}] ${scenario.label}`,
      );
      console.log(
        `  From: ${scenario.payload.From}`,
      );
      if (scenario.payload.Body) {
        console.log(`  Body: "${scenario.payload.Body}"`);
      }
      if (scenario.payload.Latitude) {
        console.log(
          `  📍 Location: ${scenario.payload.Latitude}, ${scenario.payload.Longitude}`,
        );
      }
      if (scenario.payload.NumMedia !== "0") {
        console.log(`  📎 Media: ${scenario.payload.NumMedia} attachment(s)`);
      }

      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scenario.payload),
      });

      if (response.ok) {
        const text = await response.text();
        // Extract the <Body> content from TwiML response
        const bodyMatch = text.match(/<Body>([\s\S]*?)<\/Body>/);
        const replyText = bodyMatch
          ? bodyMatch[1].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
          : "(raw response)";
        console.log(`  ✅ Reply: ${replyText.substring(0, 120)}...`);
        successCount++;
      } else {
        console.error(
          `  ❌ Failed: ${response.status} ${response.statusText}`,
        );
        failCount++;
      }
    } catch (error) {
      console.error(`  ❌ Error: ${error.message}`);
      failCount++;
    }

    // Respect Nominatim rate limits
    console.log("  ⏳ Waiting 2s...");
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log("\n" + "=".repeat(60));
  console.log("SIMULATION COMPLETE");
  console.log("=".repeat(60));
  console.log(`  ✅ Successful: ${successCount}`);
  console.log(`  ❌ Failed: ${failCount}`);
  console.log("\n📊 EXPECTED BEHAVIOR:");
  console.log(
    "  1. Kothrud flood → 2 reports (1 primary + 1 duplicate via clustering)",
  );
  console.log(
    "  2. Hinjewadi fire → new report with WhatsApp native location",
  );
  console.log(
    "  3. Location-only → acknowledged, asked for description",
  );
  console.log(
    "  4. Deccan collapse → new urgent report with location",
  );
  console.log(
    "  5. Katraj medical → new report with location",
  );
  console.log(
    "  6. Koregaon Park gas → new report, geocoded from text",
  );
  console.log(
    "  7. Follow-up location → updates Kothrud flood report #1 with coordinates",
  );
  console.log(
    "\n💡 Check the dashboard to see WhatsApp reports on the map!",
  );
}

simulateWhatsApp();
