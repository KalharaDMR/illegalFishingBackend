process.env.TWILIO_ACCOUNT_SID = "ACtest123";
process.env.TWILIO_AUTH_TOKEN = "test-token";
process.env.TWILIO_PHONE_NUMBER = "+15550001111";

jest.mock("twilio", () => {
  const messagesCreate = jest.fn();
  const accountFetch = jest.fn().mockResolvedValue({
    friendlyName: "Test",
    status: "active",
    type: "Trial",
    dateCreated: new Date(),
  });
  return jest.fn(() => ({
    messages: { create: messagesCreate },
    api: {
      accounts: jest.fn(() => ({
        fetch: accountFetch,
      })),
    },
    outgoingCallerIds: {
      list: jest.fn().mockResolvedValue([]),
    },
    __messagesCreate: messagesCreate,
    __accountFetch: accountFetch,
  }));
});

jest.mock("dotenv", () => ({ config: jest.fn() }));

const twilio = require("twilio");
const TwilioSMSService = require("./twilio.service");

const investigation = {
  actionTaken: "FINE",
  illegalActivityFound: true,
  fineAmount: 5000,
  actionDescription: "Details here",
};
const report = {
  _id: { toString: () => "507f1f77bcf86cd799439011" },
  district: "South",
};
const officer = { name: "Officer A" };

describe("TwilioSMSService", () => {
  let svc;
  let messagesCreate;

  beforeEach(() => {
    jest.clearAllMocks();
    svc = new TwilioSMSService();
    const client = twilio.mock.results[twilio.mock.results.length - 1].value;
    messagesCreate = client.messages.create;
  });

  describe("formatInvestigationMessage", () => {
    describe("positive cases", () => {
      it("builds SMS body with key fields", () => {
        const text = svc.formatInvestigationMessage(investigation, report, officer);
        expect(text).toContain("INVESTIGATION COMPLETED");
        expect(text).toContain("South");
        expect(text).toContain("Officer A");
      });

      it("uses warning emoji and unknown district when missing", () => {
        const text = svc.formatInvestigationMessage(
          { ...investigation, actionTaken: "WARNING", fineAmount: 0 },
          { _id: report._id, district: undefined },
          { name: undefined },
        );
        expect(text).toContain("⚠️");
        expect(text).toMatch(/District: Unknown/);
      });
    });
  });

  describe("formatDetailedMessage", () => {
    describe("positive cases", () => {
      it("returns sms and details object", () => {
        const out = svc.formatDetailedMessage(investigation, report, officer);
        expect(out.sms).toBeDefined();
        expect(out.details.reportId).toBe(report._id);
        expect(out.details.district).toBe("South");
      });
    });
  });

  describe("sendInvestigationAlert", () => {
    describe("positive cases", () => {
      it("returns success payload when Twilio accepts message", async () => {
        messagesCreate.mockResolvedValue({
          sid: "SM123",
          status: "queued",
          price: null,
        });

        const result = await svc.sendInvestigationAlert(
          investigation,
          report,
          officer,
          "+94770000000",
        );

        expect(result.success).toBe(true);
        expect(result.messageId).toBe("SM123");
        expect(messagesCreate).toHaveBeenCalled();
      });

      it("includes formatted cost when price is present", async () => {
        messagesCreate.mockResolvedValue({
          sid: "SM999",
          status: "sent",
          price: "0.05",
          priceUnit: "USD",
        });

        const result = await svc.sendInvestigationAlert(
          investigation,
          report,
          officer,
          "+94770000000",
        );

        expect(result.cost).toBe("0.05 USD");
      });
    });

    describe("negative cases", () => {
      it("maps invalid number error code 21211", async () => {
        messagesCreate.mockRejectedValue({ code: 21211, message: "bad" });

        const result = await svc.sendInvestigationAlert(
          investigation,
          report,
          officer,
          "+bad",
        );

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/Invalid phone number format/);
      });

      it("maps trial restriction error code 21608", async () => {
        messagesCreate.mockRejectedValue({ code: 21608, message: "unverified" });

        const result = await svc.sendInvestigationAlert(
          investigation,
          report,
          officer,
          "+94770000000",
        );

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/not verified/);
      });

      it("returns generic error payload for other Twilio failures", async () => {
        messagesCreate.mockRejectedValue({ code: 99999, message: "rate limit" });

        const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        const result = await svc.sendInvestigationAlert(
          investigation,
          report,
          officer,
          "+94770000000",
        );
        errSpy.mockRestore();

        expect(result.success).toBe(false);
        expect(result.error).toBe("rate limit");
        expect(result.code).toBe(99999);
      });
    });
  });

  describe("sendBulkAlerts", () => {
    describe("positive cases", () => {
      it("aggregates per-number results", async () => {
        messagesCreate
          .mockResolvedValueOnce({ sid: "1", status: "sent", price: null })
          .mockResolvedValueOnce({ sid: "2", status: "sent", price: null });

        jest.spyOn(svc, "delay").mockResolvedValue(undefined);

        const result = await svc.sendBulkAlerts(
          ["+111", "+222"],
          investigation,
          report,
          officer,
        );

        expect(result.total).toBe(2);
        expect(result.successful).toBe(2);
        expect(messagesCreate).toHaveBeenCalledTimes(2);

        svc.delay.mockRestore();
      });
    });
  });

  describe("delay", () => {
    describe("positive cases", () => {
      it("resolves after timeout", async () => {
        jest.useFakeTimers();
        const p = svc.delay(1000);
        jest.advanceTimersByTime(1000);
        await expect(p).resolves.toBeUndefined();
        jest.useRealTimers();
      });
    });
  });

  describe("checkAccountInfo", () => {
    it("returns account metadata on success", async () => {
      const client = twilio.mock.results[twilio.mock.results.length - 1].value;
      const out = await svc.checkAccountInfo();
      expect(out.success).toBe(true);
      expect(out.friendlyName).toBe("Test");
      expect(client.api.accounts).toHaveBeenCalledWith("ACtest123");
    });

    it("returns error object when fetch fails", async () => {
      const client = twilio.mock.results[twilio.mock.results.length - 1].value;
      client.__accountFetch.mockRejectedValueOnce(new Error("api down"));
      const out = await svc.checkAccountInfo();
      expect(out.success).toBe(false);
      expect(out.error).toBe("api down");
    });
  });

  describe("getVerifiedNumbers", () => {
    it("maps outgoing caller ids", async () => {
      const client = twilio.mock.results[twilio.mock.results.length - 1].value;
      client.outgoingCallerIds.list.mockResolvedValueOnce([
        { phoneNumber: "+111", friendlyName: "A" },
      ]);
      const out = await svc.getVerifiedNumbers();
      expect(out.success).toBe(true);
      expect(out.verified).toEqual([{ number: "+111", friendlyName: "A" }]);
    });

    it("returns error when list fails", async () => {
      const client = twilio.mock.results[twilio.mock.results.length - 1].value;
      client.outgoingCallerIds.list.mockRejectedValueOnce(new Error("nope"));
      const out = await svc.getVerifiedNumbers();
      expect(out.success).toBe(false);
      expect(out.error).toBe("nope");
    });
  });

  describe("constructor without Twilio credentials", () => {
    it("skips client initialization when account SID is missing", () => {
      const savedSid = process.env.TWILIO_ACCOUNT_SID;
      delete process.env.TWILIO_ACCOUNT_SID;
      const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});

      jest.isolateModules(() => {
        const TwilioSMSService = require("./twilio.service");
        const instance = new TwilioSMSService();
        expect(instance.client).toBeUndefined();
        expect(errSpy).toHaveBeenCalledWith(
          expect.stringContaining("Twilio credentials missing"),
        );
      });

      errSpy.mockRestore();
      process.env.TWILIO_ACCOUNT_SID = savedSid;
    });
  });
});
