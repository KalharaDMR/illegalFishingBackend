const mongoose = require("mongoose");
const Species = require("../models/Species.model");

/**
 * Legacy mistake: a unique index on root `scientificName` while data lives in `fishes[]`.
 * That makes every doc without top-level scientificName index as `null` → E11000 on 2nd insert.
 */
async function removeLegacySpeciesScientificNameIndex() {
  try {
    const coll = mongoose.connection.collection("species");
    const indexes = await coll.indexes();
    for (const idx of indexes) {
      const k = idx.key;
      if (!k || idx.name === "_id_") continue;
      const names = Object.keys(k);
      if (names.length === 1 && names[0] === "scientificName") {
        try {
          await coll.dropIndex(idx.name);
          console.log(`Removed legacy species index: ${idx.name}`);
        } catch (err) {
          console.warn(`Could not drop species index ${idx.name}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.warn("Legacy species index cleanup:", err.message);
  }
}

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB Connected");
    try {
      await removeLegacySpeciesScientificNameIndex();
      await Species.syncIndexes();
    } catch (syncErr) {
      console.warn("Species indexes:", syncErr.message);
    }
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  }
};

module.exports = connectDB;