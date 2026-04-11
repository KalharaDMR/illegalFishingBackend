jest.mock("@sendgrid/mail", () => ({
  setApiKey: jest.fn(),
  send: jest.fn().mockResolvedValue([{ statusCode: 202 }]),
}));

const sgMail = require("@sendgrid/mail");
const sendEmail = require("./email.service");

describe("sendEmail", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("positive cases", () => {
    it("invokes SendGrid send with message payload", async () => {
      await sendEmail("user@test.com", "Hello", "Body text");
      expect(sgMail.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "user@test.com",
          subject: "Hello",
          text: "Body text",
        }),
      );
    });
  });

  describe("negative cases", () => {
    it("logs when send rejects", async () => {
      const spy = jest.spyOn(console, "error").mockImplementation(() => {});
      sgMail.send.mockRejectedValueOnce(new Error("network"));

      await sendEmail("a@b.com", "s", "t");

      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });
});
