// File: models/Need.js

import mongoose from 'mongoose';

/**
 * This nested schema stores the structured data extracted by the Gemini AI.
 */
const TriageDataSchema = new mongoose.Schema({
  needType: {
    type: String,
    enum: ['Water', 'Food', 'Medical', 'Rescue', 'Other'],
    default: 'Other',
  },
  location: {
    type: String,
    trim: true,
  },
  details: {
    type: String,
    trim: true,
  },
  urgency: {
    type: String,
    enum: ['Low', 'Medium', 'High'],
    default: 'Medium',
  },
});

/**
 * This is the main schema for a citizen's report.
 * It links to the volunteer who verifies it and the manager who assigns it.
 */
const NeedSchema = new mongoose.Schema({
  // --- Part 1: Citizen Data ---
  fromNumber: {
    type: String,
    required: true,
    trim: true,
  },
  rawMessage: {
    type: String,
    required: true,
    trim: true,
  },
  status: {
    type: String,
    required: true,
    enum: ['Unverified', 'Verified', 'InProgress', 'Completed', 'Flagged'],
    default: 'Unverified',
  },
  /**
   * Stores the structured data from the Gemini AI triage.
   */
  triageData: TriageDataSchema,

  // --- Part 2 & 3: Links (for later) ---
  // verifiedBy: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'User', // Assuming you have a 'User' model for volunteers
  // },
  // assignedTo: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: 'Resource', // Assuming you have a 'Resource' model (e.g., a truck)
  // },

}, {
  timestamps: true, // Adds createdAt and updatedAt timestamps
});

export default mongoose.model('Need', NeedSchema);
