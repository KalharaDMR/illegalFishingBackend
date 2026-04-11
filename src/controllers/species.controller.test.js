jest.mock("../models/Species.model", () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  countDocuments: jest.fn(),
}));

jest.mock("../config/cloudinary", () => ({
  uploadToCloudinary: jest.fn(),
  deleteFromCloudinary: jest.fn(),
}));

jest.mock("../utils/geoUtils", () => ({
  calculateDistance: jest.fn(),
}));

const mongoose = require("mongoose");
const Species = require("../models/Species.model");
const { uploadToCloudinary, deleteFromCloudinary } = require("../config/cloudinary");
const { calculateDistance } = require("../utils/geoUtils");

const {
  createEndaneredSpeciesEntry,
  getAllEndangeredSpeciesEntryByPagination,
  getEndangeredSpeciesDetailsByLocation,
  updateEndangeredSpeciesEntry,
  deleteEndangeredSpeciesEntry,
  getNearbyEndangeredSpeciesPlaces,
  getAllEndangeredSpeciesEntry,
} = require("./species.controller");

const VALID_OBJECT_ID = "507f1f77bcf86cd799439011";

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const baseFish = {
  scientificName: "Testus fishus",
  localName: "Test fish",
  conservationStatus: "Endangered",
};

const validBody = {
  fishes: [baseFish],
  description: "This is a valid description with enough length.",
  location: {
    type: "Point",
    coordinates: [79.9, 6.9],
    address: "Coast",
    city: "Colombo",
    country: "LK",
  },
  threats: ["pollution"],
  tags: ["tag1"],
};

describe("species.controller (zoologist routes)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createEndaneredSpeciesEntry", () => {
    const setupSuccessPath = () => {
      Species.findOne.mockResolvedValue(null);
      uploadToCloudinary.mockResolvedValue({
        url: "https://cloud.test/img.jpg",
        publicId: "pid",
        format: "jpg",
      });
      const created = { _id: VALID_OBJECT_ID, ...validBody };
      Species.create.mockResolvedValue(created);
    };

    describe("positive cases", () => {
      it("returns 201 with object body (non-stringified fields)", async () => {
        setupSuccessPath();
        const req = {
          body: validBody,
          file: { path: "/tmp/x" },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await createEndaneredSpeciesEntry(req, res);
        expect(Species.create).toHaveBeenCalledWith(
          expect.objectContaining({
            fishes: validBody.fishes,
            isVerified: true,
            submittedBy: VALID_OBJECT_ID,
          }),
        );
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: "Species created successfully",
          }),
        );
      });

      it("returns 201 when description is omitted (optional field)", async () => {
        setupSuccessPath();
        const { description: _d, ...bodyWithoutDesc } = validBody;
        const req = {
          body: bodyWithoutDesc,
          file: { path: "/tmp/x" },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await createEndaneredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(201);
        expect(Species.create).toHaveBeenCalledWith(
          expect.objectContaining({ description: undefined }),
        );
      });

      it("returns 201 when multipart fields are JSON strings", async () => {
        setupSuccessPath();
        const req = {
          body: {
            fishes: JSON.stringify([baseFish]),
            description: validBody.description,
            location: JSON.stringify(validBody.location),
            threats: JSON.stringify(["pollution"]),
            tags: JSON.stringify(["tag1"]),
          },
          file: { path: "/tmp/x" },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await createEndaneredSpeciesEntry(req, res);
        expect(uploadToCloudinary).toHaveBeenCalledWith("/tmp/x", "marine-species/evidence");
        expect(Species.create).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: "Species created successfully",
          }),
        );
      });
    });

    describe("negative cases", () => {
      it("returns 400 when fishes is missing or empty", async () => {
        const req = {
          body: { ...validBody, fishes: [] },
          file: { path: "/tmp/x" },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await createEndaneredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: "At least one fish entry is required",
        });
      });

      it("returns 400 when fishes is not an array", async () => {
        Species.findOne.mockResolvedValue(null);
        const req = {
          body: { ...validBody, fishes: { not: "array" } },
          file: { path: "/tmp/x" },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await createEndaneredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: "At least one fish entry is required",
        });
      });

      it("returns 400 when a fish entry lacks required fields", async () => {
        const req = {
          body: {
            ...validBody,
            fishes: [{ scientificName: "A", localName: "B" }],
          },
          file: { path: "/tmp/x" },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await createEndaneredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error:
            "All fish entries must have scientific name, local name, and conservation status",
        });
      });

      it("returns 400 when description is too short", async () => {
        const req = {
          body: { ...validBody, description: "short" },
          file: { path: "/tmp/x" },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await createEndaneredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: "Description must be at least 20 characters long",
        });
      });

      it("returns 400 when description exceeds 2000 characters", async () => {
        const req = {
          body: { ...validBody, description: "x".repeat(2001) },
          file: { path: "/tmp/x" },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await createEndaneredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: "Description must not exceed 2000 characters",
        });
      });

      it("returns 400 when location coordinates are invalid", async () => {
        const req = {
          body: {
            ...validBody,
            location: { coordinates: [79.9] },
          },
          file: { path: "/tmp/x" },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await createEndaneredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: "Valid location coordinates (longitude, latitude) are required",
        });
      });

      it("returns 400 when coordinates are out of range", async () => {
        const req = {
          body: {
            ...validBody,
            location: { coordinates: [200, 6.9] },
          },
          file: { path: "/tmp/x" },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await createEndaneredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error:
            "Invalid coordinates. Longitude must be between -180 and 180, latitude between -90 and 90",
        });
      });

      it("returns 400 when location already has an entry", async () => {
        Species.findOne.mockResolvedValue({ _id: "existing" });
        const req = {
          body: validBody,
          file: { path: "/tmp/x" },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await createEndaneredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json.mock.calls[0][0].error).toMatch(/already has an endangered species/i);
      });

      it("returns 400 when evidence file is missing", async () => {
        Species.findOne.mockResolvedValue(null);
        const req = {
          body: validBody,
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await createEndaneredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: "Evidence image is required",
        });
      });

      it("returns 500 when Cloudinary upload fails", async () => {
        Species.findOne.mockResolvedValue(null);
        uploadToCloudinary.mockRejectedValue(new Error("upload failed"));
        const req = {
          body: validBody,
          file: { path: "/tmp/x" },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await createEndaneredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          error: "Image upload failed: upload failed",
        });
      });

      it("returns 500 when fishes JSON string is invalid", async () => {
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        Species.findOne.mockResolvedValue(null);
        const req = {
          body: { ...validBody, fishes: "{invalid json" },
          file: { path: "/tmp/x" },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await createEndaneredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json.mock.calls[0][0].error).toBeDefined();
        consoleSpy.mockRestore();
      });

      it("returns 500 when unexpected error is thrown", async () => {
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        Species.findOne.mockRejectedValue(new Error("db down"));
        const req = {
          body: validBody,
          file: { path: "/tmp/x" },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await createEndaneredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: "db down" });
        consoleSpy.mockRestore();
      });
    });
  });

  describe("getAllEndangeredSpeciesEntryByPagination", () => {
    const chainFind = (resolvedItems) => {
      const selectMock = jest.fn().mockResolvedValue(resolvedItems);
      const skipMock = jest.fn().mockReturnValue({ select: selectMock });
      const limitMock = jest.fn().mockReturnValue({ skip: skipMock });
      const sortMock = jest.fn().mockReturnValue({ limit: limitMock });
      Species.find.mockReturnValue({ sort: sortMock });
    };

    describe("positive cases", () => {
      it("returns 200 with paginated list and metadata", async () => {
        const items = [{ _id: "1" }];
        chainFind(items);
        Species.countDocuments.mockResolvedValue(25);

        const req = {
          query: { page: "2", limit: "10", sortBy: "createdAt", order: "desc" },
        };
        const res = createRes();
        await getAllEndangeredSpeciesEntryByPagination(req, res);

        expect(Species.find).toHaveBeenCalledWith(
          expect.objectContaining({ isVerified: true }),
        );
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          count: 1,
          total: 25,
          currentPage: 2,
          totalPages: 3,
          data: items,
        });
      });

      it("uses default page and limit when query is empty", async () => {
        chainFind([]);
        Species.countDocuments.mockResolvedValue(0);
        const req = { query: {} };
        const res = createRes();
        await getAllEndangeredSpeciesEntryByPagination(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            currentPage: 1,
            totalPages: 0,
            data: [],
          }),
        );
      });

      it("applies ascending sort when order is asc", async () => {
        const sortMock = jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              select: jest.fn().mockResolvedValue([]),
            }),
          }),
        });
        Species.find.mockReturnValue({ sort: sortMock });
        Species.countDocuments.mockResolvedValue(0);
        const req = { query: { order: "asc", sortBy: "createdAt" } };
        const res = createRes();
        await getAllEndangeredSpeciesEntryByPagination(req, res);
        expect(sortMock).toHaveBeenCalledWith({ createdAt: 1 });
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it("applies status and search filters", async () => {
        chainFind([]);
        Species.countDocuments.mockResolvedValue(0);

        const req = {
          query: { status: "Endangered", search: "shark" },
        };
        const res = createRes();
        await getAllEndangeredSpeciesEntryByPagination(req, res);

        expect(Species.find).toHaveBeenCalledWith(
          expect.objectContaining({
            "fishes.conservationStatus": "Endangered",
            $or: expect.any(Array),
            isVerified: true,
          }),
        );
        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe("negative cases", () => {
      it("returns 500 when find throws", async () => {
        Species.find.mockImplementation(() => {
          throw new Error("query failed");
        });
        const req = { query: {} };
        const res = createRes();
        await getAllEndangeredSpeciesEntryByPagination(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: "query failed",
        });
      });

      it("returns 500 when countDocuments throws", async () => {
        chainFind([]);
        Species.countDocuments.mockRejectedValue(new Error("count failed"));
        const req = { query: {} };
        const res = createRes();
        await getAllEndangeredSpeciesEntryByPagination(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          error: "count failed",
        });
      });
    });
  });

  describe("getEndangeredSpeciesDetailsByLocation", () => {
    describe("positive cases", () => {
      it("returns 200 with species data", async () => {
        const doc = { _id: VALID_OBJECT_ID, fishes: [baseFish] };
        Species.findOne.mockReturnValue({
          select: jest.fn().mockResolvedValue(doc),
        });
        const req = {
          body: { location: { coordinates: [79.9, 6.9] } },
        };
        const res = createRes();
        await getEndangeredSpeciesDetailsByLocation(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          data: doc,
        });
      });
    });

    describe("negative cases", () => {
      it("returns 400 when location is invalid (single coordinate)", async () => {
        const req = { body: { location: { coordinates: [1] } } };
        const res = createRes();
        await getEndangeredSpeciesDetailsByLocation(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: "Valid location coordinates (longitude, latitude) are required",
        });
      });

      it("returns 400 when location is missing", async () => {
        const req = { body: {} };
        const res = createRes();
        await getEndangeredSpeciesDetailsByLocation(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("returns 404 when no species at location", async () => {
        Species.findOne.mockReturnValue({
          select: jest.fn().mockResolvedValue(null),
        });
        const req = {
          body: { location: { coordinates: [79.9, 6.9] } },
        };
        const res = createRes();
        await getEndangeredSpeciesDetailsByLocation(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
        expect(res.json).toHaveBeenCalledWith({
          error: "Endangered species entry not found",
        });
      });
    });
  });

  describe("updateEndangeredSpeciesEntry", () => {
    const makeSpeciesDoc = () => {
      const id = new mongoose.Types.ObjectId(VALID_OBJECT_ID);
      return {
        _id: id,
        submittedBy: id,
        evidence: { publicId: "old-pid", url: "old-url" },
        description: "Old description that is long enough.",
        fishes: [baseFish],
        location: {
          type: "Point",
          coordinates: [79.9, 6.9],
          address: "A",
          city: "C",
          country: "LK",
          formattedAddress: "FA",
        },
        threats: [],
        tags: [],
        save: jest.fn().mockResolvedValue(true),
      };
    };

    describe("positive cases", () => {
      it("returns 200 when updating description only", async () => {
        const doc = makeSpeciesDoc();
        Species.findById.mockResolvedValue(doc);
        const req = {
          params: { id: VALID_OBJECT_ID },
          body: {
            description: "Updated description with enough characters here.",
          },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await updateEndangeredSpeciesEntry(req, res);
        expect(doc.save).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            message: "Species updated successfully",
          }),
        );
      });

      it("returns 200 when updating location coordinates", async () => {
        const doc = makeSpeciesDoc();
        Species.findById.mockResolvedValue(doc);
        const req = {
          params: { id: VALID_OBJECT_ID },
          body: {
            location: {
              coordinates: [80.0, 7.0],
              address: "New",
              city: "Galle",
              country: "LK",
            },
          },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await updateEndangeredSpeciesEntry(req, res);
        expect(doc.location.coordinates).toEqual([80, 7]);
        expect(res.status).toHaveBeenCalledWith(200);
      });

      it("returns 200 and replaces evidence when new file is uploaded", async () => {
        const doc = makeSpeciesDoc();
        Species.findById.mockResolvedValue(doc);
        deleteFromCloudinary.mockResolvedValue(undefined);
        uploadToCloudinary.mockResolvedValue({
          url: "https://new",
          publicId: "new-pid",
          format: "png",
        });
        const req = {
          params: { id: VALID_OBJECT_ID },
          body: {
            description: "Updated description with enough characters here.",
          },
          file: { path: "/tmp/new" },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await updateEndangeredSpeciesEntry(req, res);
        expect(deleteFromCloudinary).toHaveBeenCalledWith("old-pid");
        expect(doc.evidence.publicId).toBe("new-pid");
        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe("negative cases", () => {
      it("returns 400 for invalid ObjectId", async () => {
        const req = { params: { id: "not-an-id" }, body: {}, user: { userId: VALID_OBJECT_ID } };
        const res = createRes();
        await updateEndangeredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          success: false,
          message: "Invalid Endangered Species ID",
        });
      });

      it("returns 404 when species not found", async () => {
        Species.findById.mockResolvedValue(null);
        const req = {
          params: { id: VALID_OBJECT_ID },
          body: {},
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await updateEndangeredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
      });

      it("returns 403 when user is not the submitter", async () => {
        const doc = makeSpeciesDoc();
        doc.submittedBy = new mongoose.Types.ObjectId();
        Species.findById.mockResolvedValue(doc);
        const req = {
          params: { id: VALID_OBJECT_ID },
          body: {},
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await updateEndangeredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
      });

      it("returns 400 when JSON parsing fails for string fields", async () => {
        const doc = makeSpeciesDoc();
        Species.findById.mockResolvedValue(doc);
        const req = {
          params: { id: VALID_OBJECT_ID },
          body: { fishes: "not-json" },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await updateEndangeredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: "Invalid JSON format for fishes, location, threats, or tags",
        });
      });

      it("returns 400 when fishes is empty array when provided", async () => {
        const doc = makeSpeciesDoc();
        Species.findById.mockResolvedValue(doc);
        const req = {
          params: { id: VALID_OBJECT_ID },
          body: { fishes: [] },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await updateEndangeredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("returns 400 when threats is not an array", async () => {
        const doc = makeSpeciesDoc();
        Species.findById.mockResolvedValue(doc);
        const req = {
          params: { id: VALID_OBJECT_ID },
          body: { threats: { pollution: true } },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await updateEndangeredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: "Threats must be an array",
        });
      });

      it("returns 400 when tags is not an array", async () => {
        const doc = makeSpeciesDoc();
        Species.findById.mockResolvedValue(doc);
        const req = {
          params: { id: VALID_OBJECT_ID },
          body: { tags: { invalid: true } },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await updateEndangeredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: "Tags must be an array",
        });
      });

      it("returns 400 when description is too short", async () => {
        const doc = makeSpeciesDoc();
        Species.findById.mockResolvedValue(doc);
        const req = {
          params: { id: VALID_OBJECT_ID },
          body: { description: "too short" },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await updateEndangeredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: "Description must be at least 20 characters long",
        });
      });

      it("returns 400 when description exceeds 2000 characters", async () => {
        const doc = makeSpeciesDoc();
        Species.findById.mockResolvedValue(doc);
        const req = {
          params: { id: VALID_OBJECT_ID },
          body: { description: "x".repeat(2001) },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await updateEndangeredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: "Description must not exceed 2000 characters",
        });
      });

      it("returns 500 when image re-upload fails", async () => {
        const doc = makeSpeciesDoc();
        Species.findById.mockResolvedValue(doc);
        deleteFromCloudinary.mockResolvedValue(undefined);
        uploadToCloudinary.mockRejectedValue(new Error("fail upload"));
        const req = {
          params: { id: VALID_OBJECT_ID },
          body: {},
          file: { path: "/tmp/new" },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await updateEndangeredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json.mock.calls[0][0].error).toMatch(/Image upload failed/);
      });

      it("returns 500 when save fails", async () => {
        const doc = makeSpeciesDoc();
        doc.save.mockRejectedValue(new Error("save failed"));
        Species.findById.mockResolvedValue(doc);
        const req = {
          params: { id: VALID_OBJECT_ID },
          body: { description: "Updated description with enough characters here." },
          user: { userId: VALID_OBJECT_ID },
        };
        const res = createRes();
        await updateEndangeredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: "save failed" });
      });
    });
  });

  describe("deleteEndangeredSpeciesEntry", () => {
    describe("positive cases", () => {
      it("returns 200 and deletes species with evidence on Cloudinary", async () => {
        const id = new mongoose.Types.ObjectId(VALID_OBJECT_ID);
        const doc = {
          submittedBy: id,
          evidence: { publicId: "pid" },
          deleteOne: jest.fn().mockResolvedValue({}),
        };
        Species.findById.mockResolvedValue(doc);
        deleteFromCloudinary.mockResolvedValue(undefined);
        const req = { params: { id: VALID_OBJECT_ID }, user: { userId: id.toString() } };
        const res = createRes();
        await deleteEndangeredSpeciesEntry(req, res);
        expect(deleteFromCloudinary).toHaveBeenCalledWith("pid");
        expect(doc.deleteOne).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          message: "Species deleted successfully",
        });
      });

      it("returns 200 without calling Cloudinary when no publicId", async () => {
        const id = new mongoose.Types.ObjectId(VALID_OBJECT_ID);
        const doc = {
          submittedBy: id,
          evidence: {},
          deleteOne: jest.fn().mockResolvedValue({}),
        };
        Species.findById.mockResolvedValue(doc);
        const req = { params: { id: VALID_OBJECT_ID }, user: { userId: id.toString() } };
        const res = createRes();
        await deleteEndangeredSpeciesEntry(req, res);
        expect(deleteFromCloudinary).not.toHaveBeenCalled();
        expect(doc.deleteOne).toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(200);
      });
    });

    describe("negative cases", () => {
      it("returns 404 when species missing", async () => {
        Species.findById.mockResolvedValue(null);
        const req = { params: { id: VALID_OBJECT_ID }, user: { userId: VALID_OBJECT_ID } };
        const res = createRes();
        await deleteEndangeredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
      });

      it("returns 403 when user is not submitter", async () => {
        const doc = {
          submittedBy: new mongoose.Types.ObjectId(),
          evidence: {},
          deleteOne: jest.fn(),
        };
        Species.findById.mockResolvedValue(doc);
        const req = { params: { id: VALID_OBJECT_ID }, user: { userId: VALID_OBJECT_ID } };
        const res = createRes();
        await deleteEndangeredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
      });

      it("returns 500 when Cloudinary delete fails", async () => {
        const id = new mongoose.Types.ObjectId(VALID_OBJECT_ID);
        const doc = {
          submittedBy: id,
          evidence: { publicId: "pid" },
          deleteOne: jest.fn().mockResolvedValue({}),
        };
        Species.findById.mockResolvedValue(doc);
        deleteFromCloudinary.mockRejectedValue(new Error("cloud error"));
        const req = { params: { id: VALID_OBJECT_ID }, user: { userId: VALID_OBJECT_ID } };
        const res = createRes();
        await deleteEndangeredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json.mock.calls[0][0].error).toMatch(/Failed to delete evidence/);
      });
    });
  });

  describe("getNearbyEndangeredSpeciesPlaces", () => {
    describe("positive cases", () => {
      it("returns 200 with distances sorted ascending by km", async () => {
        const s1 = {
          location: { coordinates: [80.1, 7.1] },
          toObject: () => ({ _id: "a", location: { coordinates: [80.1, 7.1] } }),
        };
        const s2 = {
          location: { coordinates: [79.0, 6.5] },
          toObject: () => ({ _id: "b", location: { coordinates: [79.0, 6.5] } }),
        };
        calculateDistance.mockImplementation((lat1, lon1, lat2, lon2) => {
          if (lat2 === 7.1) return 2;
          if (lat2 === 6.5) return 10;
          return 0;
        });

        Species.find.mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([s2, s1]),
          }),
        });

        const req = {
          body: { longitude: 80, latitude: 7, maxDistance: 10000 },
        };
        const res = createRes();
        await getNearbyEndangeredSpeciesPlaces(req, res);

        expect(res.status).toHaveBeenCalledWith(200);
        const payload = res.json.mock.calls[0][0];
        expect(payload.success).toBe(true);
        expect(payload.count).toBe(2);
        expect(payload.userLocation).toEqual({ latitude: 7, longitude: 80 });
        expect(payload.maxDistanceKm).toBe("10.00");
        expect(payload.data[0].distanceKm).toBeLessThan(payload.data[1].distanceKm);
      });

      it("returns 200 with empty data when no nearby species", async () => {
        calculateDistance.mockReturnValue(1);
        Species.find.mockReturnValue({
          select: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        });
        const req = { body: { longitude: 80, latitude: 7 } };
        const res = createRes();
        await getNearbyEndangeredSpeciesPlaces(req, res);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            success: true,
            count: 0,
            data: [],
          }),
        );
      });
    });

    describe("negative cases", () => {
      it("returns 400 when longitude or latitude missing", async () => {
        const req = { body: { longitude: 79.9 } };
        const res = createRes();
        await getNearbyEndangeredSpeciesPlaces(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error: "Longitude and latitude are required",
        });
      });

      it("returns 400 when longitude is 0 (falsy check rejects valid coordinate)", async () => {
        const req = { body: { longitude: 0, latitude: 7 } };
        const res = createRes();
        await getNearbyEndangeredSpeciesPlaces(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("returns 400 when coordinates out of range", async () => {
        const req = { body: { longitude: 200, latitude: 6 } };
        const res = createRes();
        await getNearbyEndangeredSpeciesPlaces(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          error:
            "Invalid coordinates. Longitude must be between -180 and 180, latitude between -90 and 90",
        });
      });

      it("returns 500 when query throws", async () => {
        Species.find.mockImplementation(() => {
          throw new Error("geo error");
        });
        const req = { body: { longitude: 80, latitude: 7 } };
        const res = createRes();
        await getNearbyEndangeredSpeciesPlaces(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json.mock.calls[0][0].error).toMatch(/Error finding nearby species/);
      });
    });
  });

  describe("getAllEndangeredSpeciesEntry", () => {
    describe("positive cases", () => {
      it("returns 200 with all verified species", async () => {
        const list = [{ _id: "1" }];
        Species.find.mockReturnValue({
          select: jest.fn().mockResolvedValue(list),
        });
        const req = {};
        const res = createRes();
        await getAllEndangeredSpeciesEntry(req, res);
        expect(Species.find).toHaveBeenCalledWith({ isVerified: true });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
          success: true,
          count: 1,
          data: list,
        });
      });
    });

    describe("negative cases", () => {
      it("returns 500 when find fails", async () => {
        Species.find.mockReturnValue({
          select: jest.fn().mockRejectedValue(new Error("fail")),
        });
        const req = {};
        const res = createRes();
        await getAllEndangeredSpeciesEntry(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: "fail" });
      });
    });
  });
});
