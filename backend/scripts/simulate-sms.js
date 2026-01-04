import fetch from "node-fetch";

const API_URL = "http://localhost:3000/api/sms";

const SAMPLE_MESSAGES = [
  {
    from: "+919800000001",
    body: "Building collapse near Datta Mandir Chowk, people trapped at Wakad",
  },
  {
    from: "+919800000002",
    body: "Massive cracks in our apartment building at Fergusson College Road, Deccan Gymkhana. We are scared it might fall.",
  },
  {
    from: "+919800000003",
    body: "Fire broke out at Jangali Maharaj Road. Smoke everywhere.",
  },
  {
    from: "+919800000004",
    body: "Medical emergency at Pune Railway Station. Part of the roof fell on platform 1. Multiple injuries.",
  },
  {
    from: "+919800000005",
    body: "Road completely blocked by fallen tree near Swargate Bus Stand. Ambulance stuck in traffic.",
  },
  {
    from: "+919800000006",
    body: "Gas leak smell and no power in Koregaon Park. We are evacuating but need assistance.",
  },
  {
    from: "+919800000007",
    body: "Need ambulance immediately at Mahatma Gandhi Road, Camp. A compound wall collapsed on a pedestrian.",
  },
  {
    from: "+919800000008",
    body: "Stampede-like situation near Dagdusheth Halwai Ganpati Temple. People are panicking. Need police.",
  },
  {
    from: "+919800000009",
    body: "Main water pipe burst at Shivaji Nagar. Street is flooding rapidly.",
  },
  {
    from: "+91980000010",
    body: "Stuck in the elevator at Sassoon Hospital. Power is out. Please help!",
  },
];

async function simulateSMS() {
  console.log(
    `Starting simulation of ${SAMPLE_MESSAGES.length} SMS messages...`
  );
  console.log(`Target URL: ${API_URL}`);

  let successCount = 0;
  let failCount = 0;

  for (const [index, msg] of SAMPLE_MESSAGES.entries()) {
    try {
      console.log(
        `\n[${index + 1}/${SAMPLE_MESSAGES.length}] Sending from ${msg.from}...`
      );
      console.log(`Body: "${msg.body}"`);

      const response = await fetch(API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          From: msg.from,
          Body: msg.body,
        }),
      });

      if (response.ok) {
        const text = await response.text();
        console.log("✅ Success:", response.status);
        // console.log("Response:", text);
        successCount++;
      } else {
        console.error("❌ Failed:", response.status, response.statusText);
        failCount++;
      }
    } catch (error) {
      console.error("❌ Error:", error.message);
      failCount++;
    }

    // Add a delay between messages to respect Nominatim rate limits (1 req/sec)
    // We use 2 seconds to be safe
    console.log("Waiting 2 seconds before next message...");
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log("\n-----------------------------------");
  console.log(`Simulation Complete.`);
  console.log(`Successful: ${successCount}`);
  console.log(`Failed: ${failCount}`);
  console.log("-----------------------------------");
}

simulateSMS();
