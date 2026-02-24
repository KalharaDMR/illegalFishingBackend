const mongoose = require("mongoose");

const zoneAuditLogSchema = new mongoose.Schema(
  {
    zoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RestrictedZone",
      required: true,
    },
    action: {
      type: String,
      enum: ["CREATE", "UPDATE", "DEACTIVATE", "DELETE"],
      required: true,
    },
    changes: {
      type: Object,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("ZoneAuditLog", zoneAuditLogSchema);
