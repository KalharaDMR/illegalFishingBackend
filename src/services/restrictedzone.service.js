const RestrictedZoneRepository = require("../repositories/restrictedzone.repository");
const ZoneAuditLog = require("../models/zone.auditlog");

class RestrictedZoneService {
  constructor() {
    this.repository = RestrictedZoneRepository;
  }

  async createZone(data, files = []) {
    this.validateDates(data.startDate, data.endDate);
    await this.validateOverlap(data);

    if (files.length > 0) {
      data.evidenceFiles = files.map((file) => file.path);
    }

    const zone = await this.repository.create(data);

    await ZoneAuditLog.create({
      zoneId: zone._id,
      action: "CREATE",
      changes: data,
    });

    return zone;
  }

  async updateZone(id, data, files = []) {
    this.validateDates(data.startDate, data.endDate);
    await this.validateOverlap(data, id);

    if (files.length > 0) {
      data.evidenceFiles = files.map((file) => file.path);
    }

    const updated = await this.repository.update(id, data);

    await ZoneAuditLog.create({
      zoneId: id,
      action: "UPDATE",
      changes: data,
    });

    return updated;
  }

  async deactivateZone(id) {
    const updated = await this.repository.update(id, { isActive: false });

    await ZoneAuditLog.create({
      zoneId: id,
      action: "DEACTIVATE",
    });

    return updated;
  }

  async deleteZone(id) {
    await this.repository.delete(id);

    await ZoneAuditLog.create({
      zoneId: id,
      action: "DELETE",
    });

    return { message: "Zone deleted" };
  }

  async getZones(filter) {
    return await this.repository.findAll(filter);
  }

  validateDates(start, end) {
    if (new Date(start) >= new Date(end)) {
      throw new Error("Start date must be before end date");
    }
  }

  async validateOverlap(data, excludeId = null) {
    const existingZones = await this.repository.findAll({ isActive: true });

    for (let zone of existingZones) {
      if (excludeId && zone._id.toString() === excludeId) continue;

      const timeOverlap =
        new Date(data.startDate) <= zone.endDate &&
        new Date(data.endDate) >= zone.startDate;

      const sameLocation =
        zone.location.lat === data.location.lat &&
        zone.location.lng === data.location.lng;

      if (timeOverlap && sameLocation) {
        throw new Error(
          "A restricted zone already exists at this location during the selected time period",
        );
      }
    }
  }
}

module.exports = new RestrictedZoneService();
