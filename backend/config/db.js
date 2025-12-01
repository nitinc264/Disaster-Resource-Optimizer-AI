// Create a MongoDB connection function using Mongoose.
// It should connect to process.env.MONGO_URI.
// Log "MongoDB Connected: [host]" on success and exit process on failure.
// Export the connectDB function.

import mongoose from "mongoose";

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
