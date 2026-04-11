jest.mock("../models/user", () => ({
  User: {
    find: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  },
}));

const { User } = require("../models/user");
const admin = require("./admin.controller");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("admin.controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getPendingUsers", () => {
    describe("positive cases", () => {
      it("returns list of pending users", async () => {
        const list = [{ _id: "1", status: "PENDING" }];
        User.find.mockReturnValue({ select: jest.fn().mockResolvedValue(list) });
        const req = {};
        const res = createRes();
        await admin.getPendingUsers(req, res);
        expect(User.find).toHaveBeenCalledWith({ status: "PENDING" });
        expect(res.json).toHaveBeenCalledWith(list);
      });
    });
  });

  describe("approveUser", () => {
    describe("positive cases", () => {
      it("updates status to APPROVED", async () => {
        const updated = { _id: "1", status: "APPROVED" };
        User.findByIdAndUpdate.mockReturnValue({
          select: jest.fn().mockResolvedValue(updated),
        });
        const req = { params: { id: "1" } };
        const res = createRes();
        await admin.approveUser(req, res);
        expect(res.json).toHaveBeenCalledWith({
          message: "User approved",
          user: updated,
        });
      });
    });
  });

  describe("rejectUser", () => {
    describe("positive cases", () => {
      it("updates status to REJECTED", async () => {
        const updated = { _id: "1", status: "REJECTED" };
        User.findByIdAndUpdate.mockReturnValue({
          select: jest.fn().mockResolvedValue(updated),
        });
        const req = { params: { id: "1" } };
        const res = createRes();
        await admin.rejectUser(req, res);
        expect(res.json).toHaveBeenCalledWith({
          message: "User rejected",
          user: updated,
        });
      });
    });
  });

  describe("getAllUsers", () => {
    describe("positive cases", () => {
      it("returns non-admin users", async () => {
        User.find.mockReturnValue({ select: jest.fn().mockResolvedValue([]) });
        const req = {};
        const res = createRes();
        await admin.getAllUsers(req, res);
        expect(User.find).toHaveBeenCalledWith({ role: { $ne: "ADMIN" } });
        expect(res.json).toHaveBeenCalledWith([]);
      });
    });

    describe("negative cases", () => {
      it("returns 500 on error", async () => {
        User.find.mockImplementation(() => {
          throw new Error("db");
        });
        const req = {};
        const res = createRes();
        await admin.getAllUsers(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe("deleteUser", () => {
    describe("positive cases", () => {
      it("deletes and confirms", async () => {
        User.findByIdAndDelete.mockResolvedValue({ _id: "1" });
        const req = { params: { id: "1" } };
        const res = createRes();
        await admin.deleteUser(req, res);
        expect(res.json).toHaveBeenCalledWith({ message: "User removed successfully" });
      });
    });

    describe("negative cases", () => {
      it("returns 404 when user not found", async () => {
        User.findByIdAndDelete.mockResolvedValue(null);
        const req = { params: { id: "1" } };
        const res = createRes();
        await admin.deleteUser(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
      });

      it("returns 500 when delete throws", async () => {
        User.findByIdAndDelete.mockRejectedValue(new Error("db error"));
        const req = { params: { id: "1" } };
        const res = createRes();
        await admin.deleteUser(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: "db error" });
      });
    });
  });
});
