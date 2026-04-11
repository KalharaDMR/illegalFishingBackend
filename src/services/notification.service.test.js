var mockSendBulkAlerts;

jest.mock("./twilio.service", () => {
  mockSendBulkAlerts = jest.fn().mockResolvedValue({
    success: true,
    successful: 2,
    failed: 0,
    details: [],
  });
  return jest.fn(function MockTwilio() {
    this.sendBulkAlerts = mockSendBulkAlerts;
  });
});

jest.mock("dotenv", () => ({ config: jest.fn() }));

process.env.ADMIN_PHONE_NUMBERS = "+947111111111,+947222222222,+947333333333";

const notificationService = require("./notification.service");

const baseInvestigation = (overrides = {}) => ({
  _id: "507f1f77bcf86cd799439011",
  actionTaken: "WARNING",
  fineAmount: 0,
  ...overrides,
});
const report = { _id: "r1", district: "D1" };
const officer = { name: "O" };

describe("NotificationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("sendInvestigationCompletedNotification", () => {
    describe("positive cases", () => {
      it("calls sendBulkAlerts for all admins on ARREST", async () => {
        const inv = baseInvestigation({ actionTaken: "ARREST" });
        const result = await notificationService.sendInvestigationCompletedNotification(
          inv,
          report,
          officer,
        );
        expect(mockSendBulkAlerts).toHaveBeenCalledTimes(1);
        const recipients = mockSendBulkAlerts.mock.calls[0][0];
        expect(recipients).toHaveLength(3);
        expect(result.sms.success).toBe(true);
      });

      it("limits recipients for high FINE amount", async () => {
        const inv = baseInvestigation({ actionTaken: "FINE", fineAmount: 15000 });
        await notificationService.sendInvestigationCompletedNotification(inv, report, officer);
        const recipients = mockSendBulkAlerts.mock.calls[0][0];
        expect(recipients).toHaveLength(2);
      });

      it("notifies only primary admin for low-severity actions", async () => {
        const inv = baseInvestigation({ actionTaken: "WARNING" });
        await notificationService.sendInvestigationCompletedNotification(inv, report, officer);
        const recipients = mockSendBulkAlerts.mock.calls[0][0];
        expect(recipients).toEqual(["+947111111111"]);
      });

      it("notifies only primary admin for FINE at or below threshold", async () => {
        const inv = baseInvestigation({ actionTaken: "FINE", fineAmount: 5000 });
        await notificationService.sendInvestigationCompletedNotification(inv, report, officer);
        const recipients = mockSendBulkAlerts.mock.calls[0][0];
        expect(recipients).toEqual(["+947111111111"]);
      });

      it("notifies all admins for EQUIPMENT_CONFISCATED", async () => {
        const inv = baseInvestigation({ actionTaken: "EQUIPMENT_CONFISCATED" });
        await notificationService.sendInvestigationCompletedNotification(inv, report, officer);
        const recipients = mockSendBulkAlerts.mock.calls[0][0];
        expect(recipients).toHaveLength(3);
      });
    });

    describe("SMS result handling", () => {
      it("warns when bulk SMS reports failure", async () => {
        mockSendBulkAlerts.mockResolvedValueOnce({
          success: false,
          error: "twilio down",
          successful: 0,
        });
        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

        await notificationService.sendInvestigationCompletedNotification(
          baseInvestigation(),
          report,
          officer,
        );

        expect(warnSpy).toHaveBeenCalledWith(
          "⚠️ SMS alerts had issues:",
          "twilio down",
        );
        warnSpy.mockRestore();
      });
    });

  });

  describe("sendNotification", () => {
    describe("positive cases", () => {
      it("dispatches INVESTIGATION_COMPLETED", async () => {
        await notificationService.sendNotification({
          type: "INVESTIGATION_COMPLETED",
          data: {
            investigation: baseInvestigation(),
            report,
            officer,
          },
        });
        expect(mockSendBulkAlerts).toHaveBeenCalled();
      });
    });

    describe("negative cases", () => {
      it("returns error for unknown type", async () => {
        const result = await notificationService.sendNotification({
          type: "UNKNOWN_TYPE",
          data: {},
        });
        expect(result.success).toBe(false);
        expect(result.error).toBe("Unknown notification type");
      });
    });
  });

  describe("no admin numbers configured", () => {
    it("returns stub result and warns when env has no numbers", async () => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const savedList = process.env.ADMIN_PHONE_NUMBERS;
      const savedSingle = process.env.ADMIN_PHONE_NUMBER;
      delete process.env.ADMIN_PHONE_NUMBERS;
      delete process.env.ADMIN_PHONE_NUMBER;

      jest.resetModules();
      const freshNotification = require("./notification.service");

      const result = await freshNotification.sendInvestigationCompletedNotification(
        baseInvestigation(),
        report,
        officer,
      );

      expect(result.sms.success).toBe(false);
      expect(result.sms.error).toMatch(/No admin phone numbers/);
      expect(warnSpy).toHaveBeenCalled();

      process.env.ADMIN_PHONE_NUMBERS = savedList;
      process.env.ADMIN_PHONE_NUMBER = savedSingle;
      jest.resetModules();
      require("./notification.service");
      warnSpy.mockRestore();
    });
  });
});
