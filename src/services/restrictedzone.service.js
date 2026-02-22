const RestrictedZoneRepository = require("../repositories/restrictedzone.repository");
const ZoneAuditLog = require("../models/zone.auditlog");

class RestrictedZoneService {
  constructor() {
    this.repository = RestrictedZoneRepository;
  }

  async createZone(data) {
    this.validateDates(data.startDate, data.endDate);
    await this.validateOverlap(data);

    const zone = await this.repository.create(data);

    await ZoneAuditLog.create({
      zoneId: zone._id,
      action: "CREATE",
      changes: data,
    });

    return zone;
  }

  async updateZone(id, data) {
    this.validateDates(data.startDate, data.endDate);
    await this.validateOverlap(data, id);

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

      const overlap =
        new Date(data.startDate) <= zone.endDate &&
        new Date(data.endDate) >= zone.startDate;

      if (overlap) {
        throw new Error("Time period overlaps with another restricted zone");
      }
    }
  }
}

module.exports = new RestrictedZoneService();
