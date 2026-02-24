const RestrictedZone = require("../models/restricted.zone");

class RestrictedZoneRepository {
  async create(data) {
    return await RestrictedZone.create(data);
  }

  async findById(id) {
    return await RestrictedZone.findById(id);
  }

  async findAll(filter = {}) {
    return await RestrictedZone.find(filter);
  }

  async update(id, data) {
    return await RestrictedZone.findByIdAndUpdate(id, data, { new: true });
  }

  async delete(id) {
    return await RestrictedZone.findByIdAndDelete(id);
  }
}

module.exports = new RestrictedZoneRepository();
