const {
  calculateDistance,
  toRad,
  toDeg,
  getBoundingBox,
  formatDistance,
  isWithinRadius,
  sortByDistance,
} = require("./geoUtils");

describe("geoUtils", () => {
  describe("calculateDistance", () => {
    describe("positive cases", () => {
      it("returns ~0 for identical points", () => {
        expect(calculateDistance(7, 80, 7, 80)).toBeLessThan(0.001);
      });

      it("returns a positive distance for distinct points", () => {
        const d = calculateDistance(0, 0, 0, 1);
        expect(d).toBeGreaterThan(0);
        expect(d).toBeLessThan(200);
      });
    });
  });

  describe("toRad / toDeg", () => {
    describe("positive cases", () => {
      it("converts degrees to radians and back consistently", () => {
        expect(toRad(180)).toBeCloseTo(Math.PI, 5);
        expect(toDeg(Math.PI)).toBeCloseTo(180, 5);
      });
    });
  });

  describe("getBoundingBox", () => {
    describe("positive cases", () => {
      it("returns min/max lat/lon around center", () => {
        const box = getBoundingBox(7.0, 80.0, 10);
        expect(box.minLat).toBeLessThan(7);
        expect(box.maxLat).toBeGreaterThan(7);
        expect(box.minLon).toBeLessThan(80);
        expect(box.maxLon).toBeGreaterThan(80);
      });
    });
  });

  describe("formatDistance", () => {
    describe("positive cases", () => {
      it("uses meters when under 1 km", () => {
        expect(formatDistance(0.5)).toEqual({ value: 500, unit: "meters" });
      });

      it("uses kilometers when 1 km or more", () => {
        expect(formatDistance(2.345).unit).toBe("kilometers");
      });
    });
  });

  describe("isWithinRadius", () => {
    describe("positive cases", () => {
      it("returns true when distance is within radius", () => {
        expect(isWithinRadius(7, 80, 7, 80, 1)).toBe(true);
      });
    });

    describe("negative cases", () => {
      it("returns false when beyond radius", () => {
        expect(isWithinRadius(0, 0, 10, 10, 1)).toBe(false);
      });
    });
  });

  describe("sortByDistance", () => {
    describe("positive cases", () => {
      it("sorts locations by distance ascending", () => {
        const locations = [
          { lat: 50, lon: 50, id: "far" },
          { lat: 0.01, lon: 0.01, id: "near" },
        ];
        const sorted = sortByDistance(locations, 0, 0);
        expect(sorted[0].id).toBe("near");
        expect(sorted[1].id).toBe("far");
      });
    });
  });
});
