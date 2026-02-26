const mongoose = require("mongoose");

const investigationSchema = new mongoose.Schema(
  {
    // Reference to the original report
    reportId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "IllegalReport",
      required: true,
      unique: true, // One investigation per report
    },

    // Authorized officer who conducted investigation
    officerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // Investigation details
    visited: {
      type: Boolean,
      required: true,
      default: false,
    },

    actualSituation: {
      type: String,
      required: true,
      trim: true,
    },

    illegalActivityFound: {
      type: Boolean,
      required: true,
    },

    actionTaken: {
      type: String,
      enum: ["WARNING", "FINE", "EQUIPMENT_CONFISCATED", "ARREST", "NO_ACTION", "OTHER"],
      required: true,
    },

    actionDescription: {
      type: String,
      trim: true,
    },

    fineAmount: {
      type: Number,
      min: 0,
    },

    // Visit details
    visitDate: {
      type: Date,
      required: true,
    },

    visitTime: {
      type: String,
      required: true,
      match: /^([0-1]\d|2[0-3]):([0-5]\d)$/, // HH:MM format
    },

    // Evidence
    evidenceImages: {
      type: [String],
      default: [],
    },

    evidenceVideos: {
      type: [String],
      default: [],
    },

    officerNotes: {
      type: String,
      trim: true,
    },

    // Status
    status: {
      type: String,
      enum: ["INVESTIGATING", "COMPLETED", "RESOLVED"],
      default: "INVESTIGATING",
    },

    // Resolution details
    resolvedAt: {
      type: Date,
    },

    // For notifications
    adminNotified: {
      type: Boolean,
      default: false,
    },

    notifiedAt: {
      type: Date,
    },

     notifications: {
      sms: {
        success: Boolean,
        messageId: String,
        to: [String],
        cost: String,
        provider: String,
        error: String,
        successful: Number,
        failed: Number
      },
      sentAt: Date
    },
    
  },
  {
    timestamps: true,
  }
);

// Index for better query performance
// investigationSchema.index({ reportId: 1 });
investigationSchema.index({ officerId: 1 });
investigationSchema.index({ status: 1 });

module.exports = mongoose.model("Investigation", investigationSchema);