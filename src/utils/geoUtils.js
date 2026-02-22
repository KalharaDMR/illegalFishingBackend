/**
 * Calculate distance between two coordinates using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @returns {number} Distance in kilometers
 */
const calculateDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Radius of the Earth in kilometers
  
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return distance;
};

/**
 * Convert degrees to radians
 * @param {number} deg - Degrees
 * @returns {number} Radians
 */
const toRad = (deg) => {
  return deg * (Math.PI / 180);
};

/**
 * Convert radians to degrees
 * @param {number} rad - Radians
 * @returns {number} Degrees
 */
const toDeg = (rad) => {
  return rad * (180 / Math.PI);
};

/**
 * Calculate the bounding box for a given point and radius
 * @param {number} latitude - Center latitude
 * @param {number} longitude - Center longitude
 * @param {number} radiusKm - Radius in kilometers
 * @returns {object} Bounding box coordinates
 */
const getBoundingBox = (latitude, longitude, radiusKm) => {
  const latRad = toRad(latitude);
  const degLat = radiusKm / 111.32; // 1 degree latitude ≈ 111.32 km
  const degLon = radiusKm / (111.32 * Math.cos(latRad));

  return {
    minLat: latitude - degLat,
    maxLat: latitude + degLat,
    minLon: longitude - degLon,
    maxLon: longitude + degLon
  };
};

/**
 * Format distance for display
 * @param {number} distanceKm - Distance in kilometers
 * @returns {object} Formatted distance with unit
 */
const formatDistance = (distanceKm) => {
  if (distanceKm < 1) {
    return {
      value: Math.round(distanceKm * 1000),
      unit: 'meters'
    };
  } else {
    return {
      value: parseFloat(distanceKm.toFixed(2)),
      unit: 'kilometers'
    };
  }
};

/**
 * Check if a point is within a radius of another point
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lon1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lon2 - Longitude of point 2
 * @param {number} radiusKm - Radius in kilometers
 * @returns {boolean} True if within radius
 */
const isWithinRadius = (lat1, lon1, lat2, lon2, radiusKm) => {
  const distance = calculateDistance(lat1, lon1, lat2, lon2);
  return distance <= radiusKm;
};

/**
 * Sort locations by distance from a point
 * @param {Array} locations - Array of location objects with lat/lon
 * @param {number} centerLat - Center latitude
 * @param {number} centerLon - Center longitude
 * @returns {Array} Sorted array with distances
 */
const sortByDistance = (locations, centerLat, centerLon) => {
  return locations
    .map(location => ({
      ...location,
      distance: calculateDistance(
        centerLat,
        centerLon,
        location.latitude || location.lat,
        location.longitude || location.lon
      )
    }))
    .sort((a, b) => a.distance - b.distance);
};

module.exports = {
  calculateDistance,
  toRad,
  toDeg,
  getBoundingBox,
  formatDistance,
  isWithinRadius,
  sortByDistance
};
