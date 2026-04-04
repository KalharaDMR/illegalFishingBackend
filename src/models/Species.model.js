const mongoose = require('mongoose');

const speciesSchema = new mongoose.Schema(
{
    fishes:
      [
        {
          scientificName:{
            type:String,
            required:[true,'Scientific name is required'],
            trim:true
          }
          ,
          localName:{
            type:String,
            required:[true,'Local name is required'],
            trim:true
          },
          conservationStatus:{
            type:String,
            required:[true,'Conservation status is required'],
            enum: [
                    'Critically Endangered',
                    'Endangered',
                    'Vulnerable',
                    'Near Threatened',
                    'Least Concern',
                    'Data Deficient',
                    'Not Evaluated'
                  ],
          },
          populationEstimate:{
            type:String,
            trim:true
          }
        }
      ]
,
    // Description
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters']
    },
    // Evidence/Images
    evidence: 
        {
          url: {
            type: String,
            required: [true, 'Evidence image URL is required']
          },
          publicId: {
            type: String
          },
          format: {
            type: String
          }
      }
    ,

    // Location Information with GeoJSON format for MongoDB geospatial queries
    location: {
      type: {
        type: String,
        enum: ['Point'],
        required: true,
        default: 'Point'
      },
      coordinates: {
        type: [Number], // [longitude, latitude]
        required: [true, 'Location coordinates are required']
      },
      address: {
        type: String,
        trim: true
      },
      city: {
        type: String,
        trim: true
      },
      country: {
        type: String,
        trim: true
      },
      formattedAddress: {
        type: String,
        trim: true
      }
    },

    // Threats
    threats: [{
      type: String,
      trim: true
    }],
    // Submitted by (Zoologist)
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false // Make it optional for now
    },
    // Additional metadata
    tags: [{
      type: String,
      trim: true
    }],
    isVerified:{
      type:Boolean,
      default:true
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes
speciesSchema.index({
  'fishes.scientificName': 'text',
  'fishes.localName': 'text',
});

speciesSchema.index({ location: '2dsphere' });
speciesSchema.index({ 'fishes.conservationStatus': 1 });
speciesSchema.index({ isVerified: 1 });
speciesSchema.index({ createdAt: -1 });

// Virtual for location display
speciesSchema.virtual('locationDisplay').get(function() {
  if (this.location && this.location.coordinates) {
    return {
      latitude: this.location.coordinates[1],
      longitude: this.location.coordinates[0],
      address: this.location.formattedAddress || this.location.address
    };
  }
  return null;
});


// Static method to find species within radius
speciesSchema.statics.findNearby = async function(longitude, latitude, maxDistance = 50000) {
  return this.find({
    location: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: [longitude, latitude]
        },
        $maxDistance: maxDistance // in meters
      }
    },
    isVerified: true 
  }).select('-__v');
};

// Static method to get species by conservation status
speciesSchema.statics.findByStatus = async function(status) {
  return this.find({ 
    conservationStatus: status,
    isVerified: true // Only return verified species
  }).select('-__v');
};


const Species = mongoose.model('Species', speciesSchema);

module.exports = Species;
