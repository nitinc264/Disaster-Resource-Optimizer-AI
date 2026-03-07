// Create a MongoDB connection function using Mongoose.
// It should connect to process.env.MONGO_URI.
// Log "MongoDB Connected: [host]" on success and exit process on failure.
// Export the connectDB function.

import mongoose from "mongoose";

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("FATAL: MONGO_URI environment variable is not set.");
    process.exit(1);
  }

  try {
    const conn = await mongoose.connect(uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      retryWrites: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // Log connection events for observability
    mongoose.connection.on("error", (err) => {
      console.error("MongoDB connection error:", err.message);
    });
    mongoose.connection.on("disconnected", () => {
      console.warn("MongoDB disconnected. Attempting reconnection...");
    });
    mongoose.connection.on("reconnected", () => {
      console.log("MongoDB reconnected.");
    });
  } catch (error) {
    console.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
