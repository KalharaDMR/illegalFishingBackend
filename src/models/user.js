const mongoose = require("mongoose");

// Sri Lankan districts array for validation
const sriLankaDistricts = [
  "Ampara", "Anuradhapura", "Badulla", "Batticaloa", "Colombo",
  "Galle", "Gampaha", "Hambantota", "Jaffna", "Kalutara",
  "Kandy", "Kegalle", "Kilinochchi", "Kurunegala", "Mannar",
  "Matale", "Matara", "Monaragala", "Mullaitivu", "Nuwara Eliya",
  "Polonnaruwa", "Puttalam", "Ratnapura", "Trincomalee", "Vavuniya"
];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    phone: { type: String, required: true },
    password: { type: String, required: true },

    role: {
      type: String,
      enum: ["PUBLIC_USER", "ZOOLOGIST", "AUTHORIZED_PERSON", "ADMIN"],
      required: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED"],
      default: "PENDING",
    },

    evidenceFiles: {
      type: [String],
      default: [],
    },

    // New field for district - only for AUTHORIZED_PERSON
    district: {
      type: String,
      enum: sriLankaDistricts,
      required: function() {
        return this.role === "AUTHORIZED_PERSON";
      },
      validate: {
        validator: function(value) {
          // If role is AUTHORIZED_PERSON, district must be provided
          if (this.role === "AUTHORIZED_PERSON") {
            return value && sriLankaDistricts.includes(value);
          }
          // For other roles, district is not required
          return true;
        },
        message: props => `${props.value} is not a valid Sri Lankan district!`
      }
    }
  },
  { timestamps: true }
);

// Export districts array for use in other parts of the application
module.exports = {
  User: mongoose.model("User", userSchema),
  sriLankaDistricts
};
