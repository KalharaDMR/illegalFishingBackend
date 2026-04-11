const { EventEmitter } = require("events");

let mockStream;

jest.mock("fs", () => {
  const { EventEmitter: EE } = require("events");
  return {
    existsSync: jest.fn(() => true),
    mkdirSync: jest.fn(),
    createWriteStream: jest.fn(() => {
      mockStream = new EE();
      return mockStream;
    }),
  };
});

jest.mock("pdfkit", () =>
  jest.fn().mockImplementation(() => {
    const doc = {};
    doc.pipe = jest.fn().mockReturnValue(doc);
    doc.fontSize = jest.fn().mockReturnValue(doc);
    doc.text = jest.fn().mockReturnValue(doc);
    doc.moveDown = jest.fn().mockReturnValue(doc);
    doc.end = jest.fn(() => {
      setImmediate(() => {
        if (mockStream) mockStream.emit("finish");
      });
    });
    return doc;
  }),
);

const fs = require("fs");
const { generatePDF } = require("./pdf.service");

const baseInvestigation = (overrides = {}) => ({
  _id: "507f1f77bcf86cd799439011",
  reportId: {
    _id: "rep1",
    createdAt: new Date("2026-04-01"),
    location: "Sea",
    district: "Galle",
    description: "Initial report text",
  },
  officerId: {
    name: "Officer Name",
    email: "o@test.com",
    district: "Galle",
  },
  visitDate: new Date("2026-04-10"),
  visitTime: "14:30",
  visited: true,
  illegalActivityFound: true,
  actualSituation: "Boats spotted in restricted waters.",
  actionTaken: "FINE",
  actionDescription: "Issued fine",
  fineAmount: 5000,
  officerNotes: "Follow-up recommended.",
  evidenceImages: ["/data/uploads/img_a.jpg"],
  evidenceVideos: ["/data/vids/v1.mp4"],
  status: "COMPLETED",
  resolvedAt: new Date("2026-04-11"),
  ...overrides,
});

describe("pdf.service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    mockStream = undefined;
  });

  describe("generatePDF", () => {
    describe("positive cases", () => {
      it("resolves with generated file path when stream finishes", async () => {
        const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});

        const inv = baseInvestigation();
        const filePath = await generatePDF(inv);

        expect(filePath).toMatch(/investigation_507f1f77bcf86cd799439011_\d+\.pdf$/);
        expect(filePath).toContain("temp");
        expect(fs.createWriteStream).toHaveBeenCalled();
        logSpy.mockRestore();
      });

      it("creates temp directory when it does not exist", async () => {
        fs.existsSync.mockReturnValue(false);
        jest.spyOn(console, "log").mockImplementation(() => {});

        await generatePDF(baseInvestigation());

        expect(fs.mkdirSync).toHaveBeenCalledWith(
          expect.stringContaining("temp"),
          { recursive: true },
        );
      });

      it("generates PDF for investigation without populated reportId (else branch)", async () => {
        jest.spyOn(console, "log").mockImplementation(() => {});

        const inv = baseInvestigation({
          reportId: null,
        });

        const filePath = await generatePDF(inv);

        expect(filePath).toMatch(/\.pdf$/);
      });

      it("omits optional sections when data absent", async () => {
        jest.spyOn(console, "log").mockImplementation(() => {});

        const inv = baseInvestigation({
          officerNotes: undefined,
          evidenceImages: [],
          evidenceVideos: [],
          fineAmount: 0,
          actionDescription: undefined,
          resolvedAt: undefined,
        });

        await expect(generatePDF(inv)).resolves.toMatch(/\.pdf$/);
      });
    });

    describe("negative cases", () => {
      it("rejects when write stream emits error", async () => {
        const err = new Error("disk full");
        fs.createWriteStream.mockImplementationOnce(() => {
          const s = new EventEmitter();
          setImmediate(() => s.emit("error", err));
          return s;
        });

        const PDFDocument = require("pdfkit");
        PDFDocument.mockImplementationOnce(() => ({
          pipe: jest.fn().mockReturnThis(),
          fontSize: jest.fn().mockReturnThis(),
          text: jest.fn().mockReturnThis(),
          moveDown: jest.fn().mockReturnThis(),
          end: jest.fn(),
        }));

        const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        await expect(generatePDF(baseInvestigation())).rejects.toThrow("disk full");

        errSpy.mockRestore();
      });

      it("rejects when synchronous code throws before stream", async () => {
        fs.existsSync.mockImplementationOnce(() => {
          throw new Error("fs failure");
        });

        const errSpy = jest.spyOn(console, "error").mockImplementation(() => {});

        await expect(generatePDF(baseInvestigation())).rejects.toThrow("fs failure");

        errSpy.mockRestore();
      });
    });
  });
});
