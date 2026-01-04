/**
 * Fix reports with invalid 0,0 coordinates
 * Updates them to use Pune city center as the default location
 */
import mongoose from "mongoose";

const DEFAULT_LAT = 18.5204;
const DEFAULT_LNG = 73.8567;

async function fixInvalidCoordinates() {
  try {
    await mongoose.connect("mongodb://localhost:27017/DisasterResponseDB");
    console.log("Connected to MongoDB");

    // Fix reports with 0,0 coordinates
    const reportsResult = await mongoose.connection.db.collection("reports").updateMany(
      { 
        $or: [
          { "location.lat": 0, "location.lng": 0 },
          { "location.lat": { $exists: false } },
          { "location.lng": { $exists: false } }
        ]
      },
      { 
        $set: { 
          "location.lat": DEFAULT_LAT, 
          "location.lng": DEFAULT_LNG,
          "location.isApproximate": true
        } 
      }
    );
    console.log(`✅ Updated ${reportsResult.modifiedCount} reports with invalid coordinates`);

    // Fix needs with 0,0 coordinates
    const needsResult = await mongoose.connection.db.collection("needs").updateMany(
      { 
        $or: [
          { "coordinates.lat": 0, "coordinates.lon": 0 },
          { "coordinates.lat": 0, "coordinates.lng": 0 }
        ]
      },
      { 
        $set: { 
          "coordinates.lat": DEFAULT_LAT, 
          "coordinates.lon": DEFAULT_LNG,
          "coordinates.isApproximate": true
        } 
      }
    );
    console.log(`✅ Updated ${needsResult.modifiedCount} needs with invalid coordinates`);

    await mongoose.disconnect();
    console.log("Done!");
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

fixInvalidCoordinates();
