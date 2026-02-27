const mongoose = require("mongoose");

// Sri Lankan districts array (same as in User model)
const sriLankaDistricts = [
  "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo",
  "Galle", "Gampaha", "Hambantota", "Jaffna", "Kalutara",
  "Kandy", "Kegalle", "Kilinochchi", "Kurunegala", "Mannar",
  "Matale", "Matara", "Monaragala", "Mullaitivu", "Nuwara Eliya",
  "Polonnaruwa", "Puttalam", "Ratnapura", "Trincomalee", "Vavuniya"
];

const reportSchema = new mongoose.Schema(
  {
    // User who submitted the report
    reporter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // District where incident occurred
    district: {
      type: String,
      required: true,
      enum: sriLankaDistricts,
      validate: {
        validator: function(value) {
          return sriLankaDistricts.includes(value);
        },
        message: props => `${props.value} is not a valid Sri Lankan district!`
      }
    },

    // Incident date selected by user
    reportDate: {
      type: Date,
      required: true,
    },

    // Incident time selected by user
    reportTime: {
      type: String,
      required: true,
      match: /^([0-1]\d|2[0-3]):([0-5]\d)$/, 
      // ensures HH:MM 24-hour format
    },

    // Location details
    location: {
      type: String,
      required: true,
      trim: true,
    },

    latitude: {
      type: Number,
      required: true,
    },

    longitude: {
      type: Number,
      required: true,
    },

    // Description of incident
    description: {
      type: String,
      required: true,
      trim: true,
    },

    // Multiple evidence files (images/videos)
    evidenceFiles: {
      type: [String],
      default: [],
    },

    // Report status handled by admin
    status: {
      type: String,
      enum: ["PENDING", "INVESTIGATING", "RESOLVED"],
      default: "PENDING",
    },
  },
  {
    timestamps: true, // automatically adds createdAt and updatedAt
  }
);

module.exports = {
  IllegalReport: mongoose.model("IllegalReport", reportSchema),
  sriLankaDistricts
};