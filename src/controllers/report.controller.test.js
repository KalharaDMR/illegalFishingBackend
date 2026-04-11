jest.mock("../models/IllegalReport", () => {
  const mockSave = jest.fn().mockResolvedValue(undefined);
  const Mock = jest.fn(function IllegalReport(data) {
    Object.assign(this, data);
    this._id = "new-report-id";
    this.save = mockSave;
  });
  Mock.mockSave = mockSave;
  Mock.find = jest.fn();
  Mock.findOneAndUpdate = jest.fn();
  Mock.findOneAndDelete = jest.fn();
  Mock.aggregate = jest.fn();
  return { IllegalReport: Mock };
});

jest.mock("../models/user", () => ({
  User: {
    findById: jest.fn(),
    find: jest.fn(),
  },
}));

jest.mock("../utils/email.service", () => jest.fn().mockResolvedValue(undefined));

const { IllegalReport } = require("../models/IllegalReport");
const { User } = require("../models/user");
const sendEmail = require("../utils/email.service");

const reportController = require("./report.controller");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const baseBody = () => ({
  reportDate: "2026-04-01",
  reportTime: "10:00",
  location: "Coast",
  latitude: "6.9",
  longitude: "79.9",
  description: "Suspicious vessel activity observed.",
  district: "Galle",
});

describe("report.controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sendEmail.mockResolvedValue(undefined);
  });

  describe("createReport", () => {
    describe("positive cases", () => {
      it("returns 201 and sends emails to reporter, officers, and admins", async () => {
        User.findById.mockResolvedValue({ name: "Reporter", email: "rep@test.com" });
        User.find
          .mockReturnValueOnce({
            select: jest.fn().mockResolvedValue([{ name: "Officer", email: "off@test.com" }]),
          })
          .mockReturnValueOnce({
            select: jest.fn().mockResolvedValue([{ name: "Admin", email: "adm@test.com" }]),
          });

        const req = {
          user: { userId: "507f1f77bcf86cd799439011" },
          body: baseBody(),
          files: [{ path: "/tmp/evidence.jpg" }],
        };
        const res = createRes();

        await reportController.createReport(req, res);

        expect(IllegalReport).toHaveBeenCalled();
        expect(IllegalReport.mockSave).toHaveBeenCalled();
        expect(sendEmail).toHaveBeenCalledTimes(3);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "Report submitted successfully",
          }),
        );
      });

      it("submits without evidence files when none uploaded", async () => {
        User.findById.mockResolvedValue({ name: "R", email: "r@test.com" });
        User.find
          .mockReturnValueOnce({ select: jest.fn().mockResolvedValue([]) })
          .mockReturnValueOnce({ select: jest.fn().mockResolvedValue([]) });

        const req = {
          user: { userId: "507f1f77bcf86cd799439011" },
          body: baseBody(),
        };
        const res = createRes();

        await reportController.createReport(req, res);

        const call = IllegalReport.mock.calls[0][0];
        expect(call.evidenceFiles).toEqual([]);
        expect(res.status).toHaveBeenCalledWith(201);
      });

      it("skips reporter email when reporter user not found", async () => {
        User.findById.mockResolvedValue(null);
        User.find
          .mockReturnValueOnce({ select: jest.fn().mockResolvedValue([]) })
          .mockReturnValueOnce({ select: jest.fn().mockResolvedValue([]) });

        const req = {
          user: { userId: "507f1f77bcf86cd799439011" },
          body: baseBody(),
        };
        const res = createRes();

        await reportController.createReport(req, res);

        expect(sendEmail).toHaveBeenCalledTimes(0);
        expect(res.status).toHaveBeenCalledWith(201);
      });
    });

    describe("negative cases", () => {
      it("returns 400 when district is missing", async () => {
        const req = {
          user: { userId: "u1" },
          body: { ...baseBody(), district: undefined },
        };
        const res = createRes();
        await reportController.createReport(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          message: "District is required for reporting",
        });
      });

      it("returns 500 when save fails", async () => {
        IllegalReport.mockSave.mockRejectedValueOnce(new Error("db error"));
        User.findById.mockResolvedValue(null);
        User.find
          .mockReturnValueOnce({ select: jest.fn().mockResolvedValue([]) })
          .mockReturnValueOnce({ select: jest.fn().mockResolvedValue([]) });

        const req = {
          user: { userId: "507f1f77bcf86cd799439011" },
          body: baseBody(),
        };
        const res = createRes();
        const spy = jest.spyOn(console, "error").mockImplementation(() => {});

        await reportController.createReport(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        spy.mockRestore();
        IllegalReport.mockSave.mockResolvedValue(undefined);
      });
    });
  });

  describe("getMyReports", () => {
    describe("positive cases", () => {
      it("returns reports for current reporter", async () => {
        const list = [{ _id: "1" }];
        IllegalReport.find.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockResolvedValue(list),
        });
        const req = { user: { userId: "u1" } };
        const res = createRes();
        await reportController.getMyReports(req, res);
        expect(IllegalReport.find).toHaveBeenCalledWith({ reporter: "u1" });
        expect(res.json).toHaveBeenCalledWith(list);
      });
    });

    describe("negative cases", () => {
      it("returns 500 on error", async () => {
        IllegalReport.find.mockImplementation(() => {
          throw new Error("fail");
        });
        const req = { user: { userId: "u1" } };
        const res = createRes();
        await reportController.getMyReports(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe("getMyDistrictReports", () => {
    describe("positive cases", () => {
      it("returns reports for users district", async () => {
        User.findById.mockResolvedValue({ district: "Matara" });
        IllegalReport.find.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockResolvedValue([{ _id: "r1" }]),
        });
        const req = { user: { userId: "u1" } };
        const res = createRes();
        await reportController.getMyDistrictReports(req, res);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            district: "Matara",
            count: 1,
          }),
        );
      });
    });

    describe("negative cases", () => {
      it("returns 400 when user has no district", async () => {
        User.findById.mockResolvedValue({ district: null });
        const req = { user: { userId: "u1" } };
        const res = createRes();
        await reportController.getMyDistrictReports(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("returns 400 when user not found", async () => {
        User.findById.mockResolvedValue(null);
        const req = { user: { userId: "u1" } };
        const res = createRes();
        await reportController.getMyDistrictReports(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("returns 500 on error", async () => {
        User.findById.mockRejectedValue(new Error("db"));
        const req = { user: { userId: "u1" } };
        const res = createRes();
        await reportController.getMyDistrictReports(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe("getReportStatistics", () => {
    describe("positive cases", () => {
      it("filters by district for AUTHORIZED_PERSON", async () => {
        User.findById.mockResolvedValue({
          role: "AUTHORIZED_PERSON",
          district: "Galle",
        });
        IllegalReport.aggregate.mockResolvedValue([{ _id: "Galle", total: 3 }]);

        const req = { user: { userId: "u1" } };
        const res = createRes();
        await reportController.getReportStatistics(req, res);

        expect(IllegalReport.aggregate).toHaveBeenCalled();
        const pipeline = IllegalReport.aggregate.mock.calls[0][0];
        expect(pipeline[0].$match).toEqual({ district: "Galle" });
        expect(res.json).toHaveBeenCalledWith([{ _id: "Galle", total: 3 }]);
      });

      it("uses empty match for non-authorized roles", async () => {
        User.findById.mockResolvedValue({ role: "ADMIN" });
        IllegalReport.aggregate.mockResolvedValue([]);

        const req = { user: { userId: "u1" } };
        const res = createRes();
        await reportController.getReportStatistics(req, res);

        const pipeline = IllegalReport.aggregate.mock.calls[0][0];
        expect(pipeline[0].$match).toEqual({});
      });
    });

    describe("negative cases", () => {
      it("returns 500 on aggregate error", async () => {
        User.findById.mockResolvedValue({ role: "ADMIN" });
        IllegalReport.aggregate.mockRejectedValue(new Error("agg fail"));
        const req = { user: { userId: "u1" } };
        const res = createRes();
        await reportController.getReportStatistics(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe("updateReport", () => {
    describe("positive cases", () => {
      it("returns updated report", async () => {
        const updated = { _id: "r1", description: "new" };
        IllegalReport.findOneAndUpdate.mockResolvedValue(updated);
        const req = {
          params: { id: "r1" },
          user: { userId: "rep1" },
          body: { description: "new" },
        };
        const res = createRes();
        await reportController.updateReport(req, res);
        expect(res.json).toHaveBeenCalledWith(updated);
      });
    });

    describe("negative cases", () => {
      it("returns 404 when report not found", async () => {
        IllegalReport.findOneAndUpdate.mockResolvedValue(null);
        const req = { params: { id: "r1" }, user: { userId: "rep1" }, body: {} };
        const res = createRes();
        await reportController.updateReport(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
      });

      it("returns 500 on error", async () => {
        IllegalReport.findOneAndUpdate.mockRejectedValue(new Error("db"));
        const req = { params: { id: "r1" }, user: { userId: "rep1" }, body: {} };
        const res = createRes();
        await reportController.updateReport(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe("deleteReport", () => {
    describe("positive cases", () => {
      it("deletes and confirms", async () => {
        IllegalReport.findOneAndDelete.mockResolvedValue({ _id: "r1" });
        const req = { params: { id: "r1" }, user: { userId: "rep1" } };
        const res = createRes();
        await reportController.deleteReport(req, res);
        expect(res.json).toHaveBeenCalledWith({ message: "Report deleted successfully" });
      });
    });

    describe("negative cases", () => {
      it("returns 404 when not found", async () => {
        IllegalReport.findOneAndDelete.mockResolvedValue(null);
        const req = { params: { id: "r1" }, user: { userId: "rep1" } };
        const res = createRes();
        await reportController.deleteReport(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
      });

      it("returns 500 on error", async () => {
        IllegalReport.findOneAndDelete.mockRejectedValue(new Error("db"));
        const req = { params: { id: "r1" }, user: { userId: "rep1" } };
        const res = createRes();
        await reportController.deleteReport(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe("getReportsByDistrict", () => {
    describe("positive cases", () => {
      it("returns reports for district param", async () => {
        IllegalReport.find.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockResolvedValue([{ _id: "1" }]),
        });
        const req = { params: { district: "Galle" } };
        const res = createRes();
        await reportController.getReportsByDistrict(req, res);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            district: "Galle",
            count: 1,
          }),
        );
      });
    });

    describe("negative cases", () => {
      it("returns 500 on error", async () => {
        IllegalReport.find.mockImplementation(() => {
          throw new Error("fail");
        });
        const req = { params: { district: "X" } };
        const res = createRes();
        await reportController.getReportsByDistrict(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe("getAllReports", () => {
    describe("positive cases", () => {
      it("returns total and all reports", async () => {
        IllegalReport.find.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockResolvedValue([{ _id: "a" }, { _id: "b" }]),
        });
        const req = {};
        const res = createRes();
        await reportController.getAllReports(req, res);
        expect(res.json).toHaveBeenCalledWith({
          total: 2,
          reports: [{ _id: "a" }, { _id: "b" }],
        });
      });
    });

    describe("negative cases", () => {
      it("returns 500 on error", async () => {
        IllegalReport.find.mockImplementation(() => {
          throw new Error("fail");
        });
        const req = {};
        const res = createRes();
        await reportController.getAllReports(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });
});
