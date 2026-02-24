const mongoose = require("mongoose");

const restrictedZoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    location: {
      lat: { type: Number, required: true },
      lng: { type: Number, required: true },
    },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    restrictedTime: { type: String, default: "All Day" },

    evidenceFiles: {
      type: [String],
      default: [],
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("RestrictedZone", restrictedZoneSchema);
