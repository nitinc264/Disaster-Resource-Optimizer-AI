import mongoose from "mongoose";
import config from "../config/index.js";
import Need from "../models/NeedModel.js";

async function run() {
  try {
    await mongoose.connect(config.mongoUri);
    const docs = await Need.find()
      .sort({ createdAt: -1 })
      .select("triageData urgency coordinates rawMessage")
      .lean();

    for (const doc of docs) {
      const coords = doc.coordinates
        ? `lat=${doc.coordinates.lat}, lon=${doc.coordinates.lon}`
        : "none";
      console.log(
        `${doc._id} | urgency=${doc.triageData?.urgency} | location=${doc.triageData?.location} | coords=${coords}`
      );
    }
  } catch (error) {
    console.error(error);
  } finally {
    await mongoose.disconnect();
  }
}

run();
