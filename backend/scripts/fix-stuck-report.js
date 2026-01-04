/**
 * Fix stuck report that's causing Gemini rate limit errors
 */
import mongoose from "mongoose";

const REPORT_ID = "695aa9202f27a5a943656d0b";

async function fixStuckReport() {
  try {
    await mongoose.connect("mongodb://localhost:27017/DisasterResponseDB");
    console.log("Connected to MongoDB");

    const result = await mongoose.connection.db.collection("reports").updateOne(
      { _id: new mongoose.Types.ObjectId(REPORT_ID) },
      { 
        $set: { 
          status: "Error",
          errorMessage: "Gemini API quota exceeded - needs manual retry or new API key"
        } 
      }
    );

    if (result.modifiedCount > 0) {
      console.log(`✅ Report ${REPORT_ID} marked as Error - Oracle Agent will stop retrying`);
    } else {
      console.log(`⚠️ Report ${REPORT_ID} not found or already in Error state`);
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

fixStuckReport();
