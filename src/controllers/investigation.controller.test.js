jest.mock("../models/Investigation", () => {
  const mockSave = jest.fn().mockResolvedValue(undefined);
  const Constructor = jest.fn(function Investigation(data) {
    Object.assign(this, data);
    this.save = mockSave;
  });
  Constructor.mockSave = mockSave;
  Constructor.find = jest.fn();
  Constructor.findOne = jest.fn();
  Constructor.findById = jest.fn();
  Constructor.findByIdAndDelete = jest.fn();
  Constructor.deleteMany = jest.fn();
  return Constructor;
});

jest.mock("../models/IllegalReport", () => ({
  IllegalReport: {
    find: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.mock("../models/user", () => ({
  User: {
    findById: jest.fn(),
  },
}));

jest.mock("../services/notification.service", () => ({
  sendInvestigationCompletedNotification: jest.fn().mockResolvedValue({
    sms: { success: true, successful: 1 },
  }),
}));

jest.mock("../services/pdf.service", () => ({
  generatePDF: jest.fn().mockResolvedValue("/tmp/report.pdf"),
}));

jest.mock("fs", () => ({
  unlink: jest.fn((path, cb) => cb && cb(null)),
}));

const Investigation = require("../models/Investigation");
const { IllegalReport } = require("../models/IllegalReport");
const { User } = require("../models/user");
const notificationService = require("../services/notification.service");
const { generatePDF } = require("../services/pdf.service");
const fs = require("fs");

const investigationController = require("./investigation.controller");

const VALID_ID = "507f1f77bcf86cd799439011";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.download = jest.fn();
  return res;
};

describe("investigation.controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.ADMIN_PHONE_NUMBERS = "+111,+222";
    process.env.TWILIO_ACCOUNT_SID = "ACx";
    process.env.TWILIO_PHONE_NUMBER = "+1555";
    notificationService.sendInvestigationCompletedNotification.mockReset();
    notificationService.sendInvestigationCompletedNotification.mockResolvedValue({
      sms: { success: true, successful: 1 },
    });
    generatePDF.mockResolvedValue("/tmp/report.pdf");
  });

  describe("getAssignedReports", () => {
    describe("positive cases", () => {
      it("returns reports with investigation status for officer district", async () => {
        const reportDoc = {
          _id: { toString: () => "rep1" },
          district: "Galle",
          toObject: () => ({ _id: "rep1", district: "Galle" }),
        };
        IllegalReport.find.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockResolvedValue([reportDoc]),
        });
        Investigation.find.mockReturnValue({
          select: jest.fn().mockResolvedValue([]),
        });

        const req = { user: { district: "Galle" } };
        const res = createRes();

        await investigationController.getAssignedReports(req, res);

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            district: "Galle",
            total: 1,
            reports: expect.arrayContaining([
              expect.objectContaining({ investigationStatus: "NOT_STARTED" }),
            ]),
          }),
        );
      });
    });

    describe("negative cases", () => {
      it("returns 400 when officer has no district", async () => {
        const req = { user: {} };
        const res = createRes();
        await investigationController.getAssignedReports(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("returns 500 when find throws", async () => {
        IllegalReport.find.mockImplementation(() => {
          throw new Error("db");
        });
        const req = { user: { district: "Galle" } };
        const res = createRes();
        const spy = jest.spyOn(console, "error").mockImplementation(() => {});
        await investigationController.getAssignedReports(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        spy.mockRestore();
      });
    });

    describe("additional positive cases", () => {
      it("maps existing investigation status onto reports", async () => {
        const reportDoc = {
          _id: { toString: () => "rep9" },
          toObject: () => ({ _id: "rep9" }),
        };
        IllegalReport.find.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockResolvedValue([reportDoc]),
        });
        Investigation.find.mockReturnValue({
          select: jest.fn().mockResolvedValue([
            {
              reportId: { toString: () => "rep9" },
              status: "INVESTIGATING",
            },
          ]),
        });

        const req = { user: { district: "Galle" } };
        const res = createRes();
        await investigationController.getAssignedReports(req, res);

        const payload = res.json.mock.calls[0][0];
        expect(payload.reports[0].investigationStatus).toBe("INVESTIGATING");
      });

      it("returns empty reports when none pending", async () => {
        IllegalReport.find.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockResolvedValue([]),
        });
        Investigation.find.mockReturnValue({
          select: jest.fn().mockResolvedValue([]),
        });
        const req = { user: { district: "Galle" } };
        const res = createRes();
        await investigationController.getAssignedReports(req, res);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ total: 0, reports: [] }),
        );
      });
    });
  });

  describe("startInvestigation", () => {
    describe("positive cases", () => {
      it("creates investigation and sets report to INVESTIGATING", async () => {
        const report = {
          _id: VALID_ID,
          district: "Galle",
          status: "PENDING",
          save: jest.fn().mockResolvedValue(),
        };
        IllegalReport.findById.mockResolvedValue(report);
        Investigation.findOne.mockResolvedValue(null);

        const req = {
          params: { reportId: VALID_ID },
          user: { userId: "off1", district: "Galle" },
        };
        const res = createRes();

        await investigationController.startInvestigation(req, res);

        expect(Investigation).toHaveBeenCalled();
        expect(Investigation.mockSave).toHaveBeenCalled();
        expect(report.save).toHaveBeenCalled();
        expect(report.status).toBe("INVESTIGATING");
        expect(res.status).toHaveBeenCalledWith(201);
      });
    });

    describe("negative cases", () => {
      it("returns 404 when report not found", async () => {
        IllegalReport.findById.mockResolvedValue(null);
        const req = { params: { reportId: VALID_ID }, user: { district: "Galle" } };
        const res = createRes();
        await investigationController.startInvestigation(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
      });

      it("returns 403 when district mismatch", async () => {
        IllegalReport.findById.mockResolvedValue({
          _id: VALID_ID,
          district: "Matara",
        });
        const req = { params: { reportId: VALID_ID }, user: { district: "Galle" } };
        const res = createRes();
        await investigationController.startInvestigation(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
      });

      it("returns 400 when investigation already exists", async () => {
        IllegalReport.findById.mockResolvedValue({
          _id: VALID_ID,
          district: "Galle",
        });
        Investigation.findOne.mockResolvedValue({ _id: "inv1" });
        const req = { params: { reportId: VALID_ID }, user: { userId: "off1", district: "Galle" } };
        const res = createRes();
        await investigationController.startInvestigation(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("returns 500 when save fails", async () => {
        const report = {
          _id: VALID_ID,
          district: "Galle",
          status: "PENDING",
          save: jest.fn().mockResolvedValue(),
        };
        IllegalReport.findById.mockResolvedValue(report);
        Investigation.findOne.mockResolvedValue(null);
        Investigation.mockSave.mockRejectedValueOnce(new Error("save failed"));

        const req = {
          params: { reportId: VALID_ID },
          user: { userId: "off1", district: "Galle" },
        };
        const res = createRes();
        const spy = jest.spyOn(console, "error").mockImplementation(() => {});

        await investigationController.startInvestigation(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        spy.mockRestore();
      });
    });
  });

  describe("submitInvestigation", () => {
    const buildInvestigation = () => ({
      _id: VALID_ID,
      reportId: "rep1",
      officerId: "off1",
      save: jest.fn().mockResolvedValue(),
    });

    describe("positive cases", () => {
      it("completes investigation and sends notification", async () => {
        const inv = buildInvestigation();
        Investigation.findOne.mockResolvedValue(inv);
        IllegalReport.findByIdAndUpdate.mockResolvedValue({});
        IllegalReport.findById.mockResolvedValue({ _id: "rep1" });
        User.findById.mockReturnValue({
          select: jest.fn().mockResolvedValue({ name: "O", email: "e", phone: "p" }),
        });

        const req = {
          params: { investigationId: VALID_ID },
          user: { userId: "off1" },
          body: {
            visited: "true",
            actualSituation: "Observed activity",
            illegalActivityFound: "true",
            actionTaken: "WARNING",
            actionDescription: "Warned",
            fineAmount: "0",
            visitDate: "2026-01-01",
            visitTime: "10:00",
            officerNotes: "notes",
          },
          files: {},
        };
        const res = createRes();
        const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

        await investigationController.submitInvestigation(req, res);

        expect(inv.status).toBe("COMPLETED");
        expect(notificationService.sendInvestigationCompletedNotification).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ message: "Investigation submitted successfully" }),
        );
        logSpy.mockRestore();
      });

      it("normalizes evidence image and video paths from uploads", async () => {
        const inv = buildInvestigation();
        Investigation.findOne.mockResolvedValue(inv);
        IllegalReport.findByIdAndUpdate.mockResolvedValue({});
        IllegalReport.findById.mockResolvedValue({ _id: "rep1" });
        User.findById.mockReturnValue({
          select: jest.fn().mockResolvedValue({ name: "O" }),
        });

        const req = {
          params: { investigationId: VALID_ID },
          user: { userId: "off1" },
          body: {
            visited: true,
            actualSituation: "Situation text here",
            illegalActivityFound: false,
            actionTaken: "NO_ACTION",
            actionDescription: "",
          },
          files: {
            images: [{ path: "C:\\uploads\\a.jpg" }],
            videos: [{ path: "C:\\uploads\\b.mp4" }],
          },
        };
        const res = createRes();
        jest.spyOn(console, "log").mockImplementation(() => {});

        await investigationController.submitInvestigation(req, res);

        expect(inv.evidenceImages).toEqual(["C:/uploads/a.jpg"]);
        expect(inv.evidenceVideos).toEqual(["C:/uploads/b.mp4"]);
        expect(res.json).toHaveBeenCalled();
      });

      it("still returns 200 when notification service throws", async () => {
        const inv = buildInvestigation();
        Investigation.findOne.mockResolvedValue(inv);
        IllegalReport.findByIdAndUpdate.mockResolvedValue({});
        IllegalReport.findById.mockResolvedValue({ _id: "rep1" });
        User.findById.mockReturnValue({
          select: jest.fn().mockResolvedValue({ name: "O" }),
        });
        notificationService.sendInvestigationCompletedNotification.mockRejectedValueOnce(
          new Error("SMS down"),
        );

        const req = {
          params: { investigationId: VALID_ID },
          user: { userId: "off1" },
          body: {
            visited: true,
            actualSituation: "text",
            illegalActivityFound: false,
            actionTaken: "NO_ACTION",
          },
          files: {},
        };
        const res = createRes();
        jest.spyOn(console, "log").mockImplementation(() => {});
        const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        await investigationController.submitInvestigation(req, res);

        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            notifications: expect.objectContaining({
              success: false,
              error: "SMS down",
            }),
          }),
        );
        errSpy.mockRestore();
      });

      it("parses fineAmount from string body", async () => {
        const inv = buildInvestigation();
        Investigation.findOne.mockResolvedValue(inv);
        IllegalReport.findByIdAndUpdate.mockResolvedValue({});
        IllegalReport.findById.mockResolvedValue({});
        User.findById.mockReturnValue({
          select: jest.fn().mockResolvedValue({ name: "O" }),
        });

        const req = {
          params: { investigationId: VALID_ID },
          user: { userId: "off1" },
          body: {
            visited: true,
            actualSituation: "text",
            illegalActivityFound: true,
            actionTaken: "FINE",
            fineAmount: "2500.5",
          },
          files: {},
        };
        const res = createRes();
        jest.spyOn(console, "log").mockImplementation(() => {});

        await investigationController.submitInvestigation(req, res);

        expect(inv.fineAmount).toBe(2500.5);
        expect(res.json).toHaveBeenCalled();
      });
    });

    describe("negative cases", () => {
      it("returns 404 when investigation not found", async () => {
        Investigation.findOne.mockResolvedValue(null);
        const req = {
          params: { investigationId: VALID_ID },
          user: { userId: "off1" },
          body: {},
        };
        const res = createRes();
        await investigationController.submitInvestigation(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
      });

      it("returns 500 when investigation save fails before notification", async () => {
        const inv = buildInvestigation();
        inv.save.mockRejectedValueOnce(new Error("cannot save"));
        Investigation.findOne.mockResolvedValue(inv);

        const req = {
          params: { investigationId: VALID_ID },
          user: { userId: "off1" },
          body: {
            visited: true,
            actualSituation: "x",
            illegalActivityFound: false,
            actionTaken: "NO_ACTION",
          },
          files: {},
        };
        const res = createRes();
        const spy = jest.spyOn(console, "error").mockImplementation(() => {});

        await investigationController.submitInvestigation(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        spy.mockRestore();
      });
    });
  });

  describe("getInvestigationDetails", () => {
    describe("positive cases", () => {
      it("returns investigation for admin", async () => {
        const doc = {
          officerId: { _id: { toString: () => "other" } },
        };
        Investigation.findById.mockReturnValue({
          populate: jest.fn().mockImplementation(() => ({
            populate: jest.fn().mockResolvedValue(doc),
          })),
        });

        const req = { params: { investigationId: VALID_ID }, user: { role: "ADMIN", userId: "admin" } };
        const res = createRes();
        await investigationController.getInvestigationDetails(req, res);
        expect(res.json).toHaveBeenCalledWith(doc);
      });

      it("allows AUTHORIZED_PERSON to view own investigation", async () => {
        const officerMongoId = "507f1f77bcf86cd799439099";
        const doc = {
          officerId: { _id: { toString: () => officerMongoId } },
        };
        Investigation.findById.mockReturnValue({
          populate: jest.fn().mockImplementation(() => ({
            populate: jest.fn().mockResolvedValue(doc),
          })),
        });
        const req = {
          params: { investigationId: VALID_ID },
          user: { role: "AUTHORIZED_PERSON", userId: officerMongoId },
        };
        const res = createRes();
        await investigationController.getInvestigationDetails(req, res);
        expect(res.json).toHaveBeenCalledWith(doc);
        expect(res.status).not.toHaveBeenCalledWith(403);
      });
    });

    describe("negative cases", () => {
      it("returns 404 when not found", async () => {
        Investigation.findById.mockReturnValue({
          populate: jest.fn().mockImplementation(() => ({
            populate: jest.fn().mockResolvedValue(null),
          })),
        });
        const req = { params: { investigationId: VALID_ID }, user: { role: "ADMIN" } };
        const res = createRes();
        await investigationController.getInvestigationDetails(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
      });

      it("returns 403 when officer tries to view another officers investigation", async () => {
        const doc = {
          officerId: { _id: { toString: () => "other" } },
        };
        Investigation.findById.mockReturnValue({
          populate: jest.fn().mockImplementation(() => ({
            populate: jest.fn().mockResolvedValue(doc),
          })),
        });
        const req = {
          params: { investigationId: VALID_ID },
          user: { role: "AUTHORIZED_PERSON", userId: "me" },
        };
        const res = createRes();
        await investigationController.getInvestigationDetails(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
      });

      it("returns 500 when populate chain throws", async () => {
        Investigation.findById.mockReturnValue({
          populate: jest.fn().mockImplementation(() => ({
            populate: jest.fn().mockRejectedValue(new Error("db")),
          })),
        });
        const req = { params: { investigationId: VALID_ID }, user: { role: "ADMIN" } };
        const res = createRes();
        const spy = jest.spyOn(console, "error").mockImplementation(() => {});
        await investigationController.getInvestigationDetails(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        spy.mockRestore();
      });
    });
  });

  describe("getMyInvestigations", () => {
    describe("positive cases", () => {
      it("returns summary and list", async () => {
        Investigation.find.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockResolvedValue([
            { status: "COMPLETED" },
            { status: "INVESTIGATING" },
          ]),
        });
        const req = { user: { userId: VALID_ID } };
        const res = createRes();
        await investigationController.getMyInvestigations(req, res);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            total: 2,
            completed: 1,
            investigating: 1,
          }),
        );
      });
    });

    describe("negative cases", () => {
      it("returns 500 on database error", async () => {
        Investigation.find.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockRejectedValue(new Error("timeout")),
        });
        const req = { user: { userId: VALID_ID } };
        const res = createRes();
        const spy = jest.spyOn(console, "error").mockImplementation(() => {});
        await investigationController.getMyInvestigations(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        spy.mockRestore();
      });
    });
  });

  describe("getAllInvestigations", () => {
    describe("positive cases", () => {
      it("returns stats and investigations", async () => {
        IllegalReport.find.mockReturnValue({
          select: jest.fn().mockResolvedValue([{ _id: "r1" }]),
        });
        Investigation.find.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockResolvedValue([
            { status: "COMPLETED", actionTaken: "FINE", fineAmount: 100, illegalActivityFound: true },
          ]),
        });
        const req = { query: { district: "Galle", status: "COMPLETED" } };
        const res = createRes();
        await investigationController.getAllInvestigations(req, res);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            stats: expect.objectContaining({ total: 1, completed: 1 }),
          }),
        );
      });

      it("applies startDate and endDate filters", async () => {
        IllegalReport.find.mockReturnValue({
          select: jest.fn().mockResolvedValue([]),
        });
        Investigation.find.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockResolvedValue([]),
        });
        const req = {
          query: {
            startDate: "2026-01-01",
            endDate: "2026-12-31",
          },
        };
        const res = createRes();
        await investigationController.getAllInvestigations(req, res);
        expect(Investigation.find).toHaveBeenCalledWith(
          expect.objectContaining({
            createdAt: expect.objectContaining({
              $gte: expect.any(Date),
              $lte: expect.any(Date),
            }),
          }),
        );
      });

      it("returns stats including RESOLVED count when present", async () => {
        IllegalReport.find.mockReturnValue({
          select: jest.fn().mockResolvedValue([]),
        });
        Investigation.find.mockReturnValue({
          populate: jest.fn().mockReturnThis(),
          sort: jest.fn().mockResolvedValue([
            { status: "RESOLVED", actionTaken: "OTHER", illegalActivityFound: false },
          ]),
        });
        const req = { query: {} };
        const res = createRes();
        await investigationController.getAllInvestigations(req, res);
        const payload = res.json.mock.calls[0][0];
        expect(payload.stats.resolved).toBe(1);
      });
    });

    describe("negative cases", () => {
      it("returns 500 on error", async () => {
        Investigation.find.mockImplementationOnce(() => {
          throw new Error("fail");
        });
        const req = { query: {} };
        const res = createRes();
        const spy = jest.spyOn(console, "error").mockImplementation(() => {});
        await investigationController.getAllInvestigations(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        spy.mockRestore();
      });
    });
  });

  describe("generateReportPDF", () => {
    describe("positive cases", () => {
      it("generates PDF and triggers download", async () => {
        const inv = { _id: VALID_ID };
        Investigation.findById.mockReturnValue({
          populate: jest.fn().mockImplementation(() => ({
            populate: jest.fn().mockResolvedValue(inv),
          })),
        });
        const req = { params: { investigationId: VALID_ID } };
        const res = createRes();
        res.download.mockImplementation((p, name, cb) => cb(null));

        await investigationController.generateReportPDF(req, res);

        expect(generatePDF).toHaveBeenCalledWith(inv);
        expect(res.download).toHaveBeenCalled();
        expect(fs.unlink).toHaveBeenCalled();
      });
    });

    describe("negative cases", () => {
      it("returns 404 when investigation missing", async () => {
        Investigation.findById.mockReturnValue({
          populate: jest.fn().mockImplementation(() => ({
            populate: jest.fn().mockResolvedValue(null),
          })),
        });
        const req = { params: { investigationId: VALID_ID } };
        const res = createRes();
        await investigationController.generateReportPDF(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
      });

      it("returns 500 when generatePDF throws", async () => {
        Investigation.findById.mockReturnValue({
          populate: jest.fn().mockImplementation(() => ({
            populate: jest.fn().mockResolvedValue({ _id: VALID_ID }),
          })),
        });
        generatePDF.mockRejectedValueOnce(new Error("disk full"));
        const req = { params: { investigationId: VALID_ID } };
        const res = createRes();
        const spy = jest.spyOn(console, "error").mockImplementation(() => {});

        await investigationController.generateReportPDF(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        spy.mockRestore();
      });

      it("returns 500 from download callback when send fails", async () => {
        Investigation.findById.mockReturnValue({
          populate: jest.fn().mockImplementation(() => ({
            populate: jest.fn().mockResolvedValue({ _id: VALID_ID }),
          })),
        });
        const req = { params: { investigationId: VALID_ID } };
        const res = createRes();
        res.download.mockImplementation((p, name, cb) => cb(new Error("network")));

        const spy = jest.spyOn(console, "error").mockImplementation(() => {});
        await investigationController.generateReportPDF(req, res);

        expect(res.status).toHaveBeenCalledWith(500);
        spy.mockRestore();
      });
    });
  });

  describe("getNotificationStatus", () => {
    describe("positive cases", () => {
      it("returns status payload", async () => {
        const inv = {
          _id: VALID_ID,
          reportId: { _id: "r1", district: "D" },
          officerId: { name: "Off" },
          actionTaken: "FINE",
          fineAmount: 500,
          notifications: { sms: { success: true } },
        };
        Investigation.findById.mockReturnValue({
          populate: jest.fn().mockImplementation(() => ({
            populate: jest.fn().mockResolvedValue(inv),
          })),
        });
        const req = { params: { investigationId: VALID_ID } };
        const res = createRes();
        await investigationController.getNotificationStatus(req, res);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            investigationId: inv._id,
            notifications: inv.notifications,
          }),
        );
      });

      it("uses default notification placeholder when none stored", async () => {
        const inv = {
          _id: VALID_ID,
          reportId: { district: "D" },
          officerId: { name: "X" },
          actionTaken: "WARNING",
          fineAmount: 0,
        };
        Investigation.findById.mockReturnValue({
          populate: jest.fn().mockImplementation(() => ({
            populate: jest.fn().mockResolvedValue(inv),
          })),
        });
        const req = { params: { investigationId: VALID_ID } };
        const res = createRes();

        await investigationController.getNotificationStatus(req, res);

        const payload = res.json.mock.calls[0][0];
        expect(payload.notifications.sms.error).toMatch(/No notifications sent/);
      });
    });

    describe("negative cases", () => {
      it("returns 404 when investigation missing", async () => {
        Investigation.findById.mockReturnValue({
          populate: jest.fn().mockImplementation(() => ({
            populate: jest.fn().mockResolvedValue(null),
          })),
        });
        const req = { params: { investigationId: VALID_ID } };
        const res = createRes();
        await investigationController.getNotificationStatus(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
      });

      it("returns 500 on error", async () => {
        Investigation.findById.mockReturnValue({
          populate: jest.fn().mockImplementation(() => ({
            populate: jest.fn().mockRejectedValue(new Error("db")),
          })),
        });
        const req = { params: { investigationId: VALID_ID } };
        const res = createRes();
        const spy = jest.spyOn(console, "error").mockImplementation(() => {});
        await investigationController.getNotificationStatus(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        spy.mockRestore();
      });
    });
  });

  describe("deleteInvestigation", () => {
    describe("positive cases", () => {
      it("resets report and deletes investigation", async () => {
        Investigation.findById.mockResolvedValue({ reportId: "rep1" });
        Investigation.findByIdAndDelete.mockResolvedValue({});
        const req = { params: { investigationId: VALID_ID } };
        const res = createRes();
        await investigationController.deleteInvestigation(req, res);
        expect(IllegalReport.findByIdAndUpdate).toHaveBeenCalledWith("rep1", { status: "PENDING" });
        expect(Investigation.findByIdAndDelete).toHaveBeenCalledWith(VALID_ID);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ message: "Investigation deleted successfully" }),
        );
      });
    });

    describe("negative cases", () => {
      it("returns 404 when not found", async () => {
        Investigation.findById.mockResolvedValue(null);
        const req = { params: { investigationId: VALID_ID } };
        const res = createRes();
        await investigationController.deleteInvestigation(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
      });

      it("returns 500 on error", async () => {
        Investigation.findById.mockRejectedValue(new Error("db"));
        const req = { params: { investigationId: VALID_ID } };
        const res = createRes();
        const spy = jest.spyOn(console, "error").mockImplementation(() => {});
        await investigationController.deleteInvestigation(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        spy.mockRestore();
      });
    });
  });

  describe("cancelInvestigation", () => {
    describe("positive cases", () => {
      it("cancels INVESTIGATING investigation", async () => {
        Investigation.findOne.mockResolvedValue({
          _id: VALID_ID,
          reportId: "rep1",
          status: "INVESTIGATING",
        });
        Investigation.findByIdAndDelete.mockResolvedValue({});
        const req = { params: { investigationId: VALID_ID }, user: { userId: "off1" } };
        const res = createRes();
        await investigationController.cancelInvestigation(req, res);
        expect(IllegalReport.findByIdAndUpdate).toHaveBeenCalledWith("rep1", { status: "PENDING" });
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ message: "Investigation cancelled successfully" }),
        );
      });
    });

    describe("negative cases", () => {
      it("returns 400 when status is not INVESTIGATING", async () => {
        Investigation.findOne.mockResolvedValue({
          status: "COMPLETED",
          reportId: "r1",
        });
        const req = { params: { investigationId: VALID_ID }, user: { userId: "off1" } };
        const res = createRes();
        await investigationController.cancelInvestigation(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("returns 404 when investigation not found for officer", async () => {
        Investigation.findOne.mockResolvedValue(null);
        const req = { params: { investigationId: VALID_ID }, user: { userId: "off1" } };
        const res = createRes();
        await investigationController.cancelInvestigation(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
      });
    });
  });

  describe("bulkDeleteInvestigations", () => {
    describe("positive cases", () => {
      it("deletes many and resets reports", async () => {
        Investigation.find.mockResolvedValue([{ reportId: "r1" }, { reportId: "r2" }]);
        Investigation.deleteMany.mockResolvedValue({ deletedCount: 2 });
        const req = { body: { investigationIds: [VALID_ID, "507f1f77bcf86cd799439012"] } };
        const res = createRes();
        await investigationController.bulkDeleteInvestigations(req, res);
        expect(Investigation.deleteMany).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ deletedCount: 2 }),
        );
      });
    });

    describe("negative cases", () => {
      it("returns 400 when body invalid", async () => {
        const req = { body: {} };
        const res = createRes();
        await investigationController.bulkDeleteInvestigations(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("returns 400 when investigationIds is not an array", async () => {
        const req = { body: { investigationIds: "not-array" } };
        const res = createRes();
        await investigationController.bulkDeleteInvestigations(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("returns 500 on error", async () => {
        Investigation.find.mockRejectedValueOnce(new Error("db"));
        const req = { body: { investigationIds: [VALID_ID] } };
        const res = createRes();
        const spy = jest.spyOn(console, "error").mockImplementation(() => {});
        await investigationController.bulkDeleteInvestigations(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        spy.mockRestore();
      });
    });

    describe("additional positive cases", () => {
      it("completes with zero deletions when ids array empty", async () => {
        Investigation.find.mockResolvedValue([]);
        Investigation.deleteMany.mockResolvedValue({ deletedCount: 0 });
        const req = { body: { investigationIds: [] } };
        const res = createRes();
        await investigationController.bulkDeleteInvestigations(req, res);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ deletedCount: 0 }),
        );
      });
    });
  });
});
