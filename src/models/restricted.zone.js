const mongoose = require("mongoose");

const coordinateSchema = new mongoose.Schema(
  {
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
  },
  { _id: false },
);

const restrictedZoneSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    boundaries: {
      type: [coordinateSchema], // polygon points
      required: true,
    },

    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },

    evidenceFiles: {
      type: [String], // store file URLs
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
