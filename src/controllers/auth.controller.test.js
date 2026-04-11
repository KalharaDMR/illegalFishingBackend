jest.mock("../models/user", () => ({
  User: {
    findOne: jest.fn(),
    findById: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock("bcryptjs", () => ({
  hash: jest.fn(() => Promise.resolve("hashed")),
  compare: jest.fn(),
}));

jest.mock("../utils/jwt", () => jest.fn(() => "mock.jwt.token"));

const { User } = require("../models/user");
const bcrypt = require("bcryptjs");
const generateToken = require("../utils/jwt");
const auth = require("./auth.controller");

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe("auth.controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("signup", () => {
    describe("positive cases", () => {
      it("creates PUBLIC_USER as APPROVED without evidence", async () => {
        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue({
          _id: "u1",
          district: undefined,
        });

        const req = {
          body: {
            name: "Pub",
            email: "p@test.com",
            phone: "1",
            password: "secret12345",
            role: "PUBLIC_USER",
          },
          files: undefined,
        };
        const res = createRes();

        await auth.signup(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            message: "Signup successful",
            user: {},
          }),
        );
      });

      it("creates AUTHORIZED_PERSON with district and evidence", async () => {
        User.findOne.mockResolvedValue(null);
        User.create.mockResolvedValue({ _id: "u2", district: "Galle" });

        const req = {
          body: {
            name: "Auth",
            email: "a@test.com",
            phone: "2",
            password: "secret12345",
            role: "AUTHORIZED_PERSON",
            district: "Galle",
          },
          files: [{ filename: "id.pdf" }],
        };
        const res = createRes();

        await auth.signup(req, res);

        expect(res.status).toHaveBeenCalledWith(201);
        expect(User.create).toHaveBeenCalledWith(
          expect.objectContaining({
            district: "Galle",
            evidenceFiles: ["id.pdf"],
          }),
        );
      });
    });

    describe("negative cases", () => {
      it("returns 400 when email exists", async () => {
        User.findOne.mockResolvedValue({ _id: "x" });
        const req = {
          body: {
            name: "N",
            email: "t@test.com",
            phone: "1",
            password: "p",
            role: "PUBLIC_USER",
          },
        };
        const res = createRes();
        await auth.signup(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({ message: "Email already exists" });
      });

      it("returns 400 when evidence missing for non-public role", async () => {
        User.findOne.mockResolvedValue(null);
        const req = {
          body: {
            name: "Z",
            email: "z@test.com",
            phone: "1",
            password: "p",
            role: "ZOOLOGIST",
          },
          files: [],
        };
        const res = createRes();
        await auth.signup(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith({
          message: "Evidence is required for this role",
        });
      });

      it("returns 400 when AUTHORIZED_PERSON missing district", async () => {
        User.findOne.mockResolvedValue(null);
        const req = {
          body: {
            name: "A",
            email: "a@test.com",
            phone: "1",
            password: "p",
            role: "AUTHORIZED_PERSON",
          },
          files: [{ filename: "f.pdf" }],
        };
        const res = createRes();
        await auth.signup(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("returns 500 when User.create throws", async () => {
        User.findOne.mockResolvedValue(null);
        User.create.mockRejectedValue(new Error("db failure"));
        const req = {
          body: {
            name: "P",
            email: "p2@test.com",
            phone: "1",
            password: "secret12345",
            role: "PUBLIC_USER",
          },
        };
        const res = createRes();
        await auth.signup(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ message: "db failure" });
      });
    });
  });

  describe("login", () => {
    describe("positive cases", () => {
      it("returns token when credentials valid and user approved", async () => {
        User.findOne.mockResolvedValue({
          _id: "507f1f77bcf86cd799439011",
          name: "N",
          email: "e@test.com",
          phone: "1",
          password: "hashed",
          role: "PUBLIC_USER",
          status: "APPROVED",
        });
        bcrypt.compare.mockResolvedValue(true);

        const req = { body: { email: "e@test.com", password: "ok" } };
        const res = createRes();

        await auth.login(req, res);

        expect(generateToken).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            token: "mock.jwt.token",
            user: expect.objectContaining({ email: "e@test.com" }),
          }),
        );
      });

      it("includes district for AUTHORIZED_PERSON when set", async () => {
        User.findOne.mockResolvedValue({
          _id: "507f1f77bcf86cd799439011",
          name: "O",
          email: "o@test.com",
          phone: "1",
          password: "hashed",
          role: "AUTHORIZED_PERSON",
          district: "Matara",
          status: "APPROVED",
        });
        bcrypt.compare.mockResolvedValue(true);
        const req = { body: { email: "o@test.com", password: "ok" } };
        const res = createRes();
        await auth.login(req, res);
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            user: expect.objectContaining({ district: "Matara" }),
          }),
        );
      });
    });

    describe("negative cases", () => {
      it("returns 404 when user not found", async () => {
        User.findOne.mockResolvedValue(null);
        const req = { body: { email: "x@test.com", password: "p" } };
        const res = createRes();
        await auth.login(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
      });

      it("returns 403 when account not approved", async () => {
        User.findOne.mockResolvedValue({
          status: "PENDING",
          password: "h",
        });
        const req = { body: { email: "e@test.com", password: "p" } };
        const res = createRes();
        await auth.login(req, res);
        expect(res.status).toHaveBeenCalledWith(403);
      });

      it("returns 401 when password invalid", async () => {
        User.findOne.mockResolvedValue({
          _id: "1",
          status: "APPROVED",
          password: "h",
        });
        bcrypt.compare.mockResolvedValue(false);
        const req = { body: { email: "e@test.com", password: "wrong" } };
        const res = createRes();
        await auth.login(req, res);
        expect(res.status).toHaveBeenCalledWith(401);
      });

      it("returns 500 when findOne throws", async () => {
        User.findOne.mockRejectedValue(new Error("db"));
        const req = { body: { email: "e@test.com", password: "p" } };
        const res = createRes();
        await auth.login(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe("getProfile", () => {
    describe("positive cases", () => {
      it("returns user payload", async () => {
        User.findById.mockResolvedValue({
          _id: "1",
          name: "N",
          email: "e@test.com",
          phone: "p",
          role: "PUBLIC_USER",
        });
        const req = { user: { userId: "1" } };
        const res = createRes();
        await auth.getProfile(req, res);
        expect(res.json).toHaveBeenCalledWith({
          user: expect.objectContaining({ email: "e@test.com" }),
        });
      });

      it("includes district for AUTHORIZED_PERSON when set", async () => {
        User.findById.mockResolvedValue({
          _id: "1",
          name: "N",
          email: "e@test.com",
          phone: "p",
          role: "AUTHORIZED_PERSON",
          district: "Galle",
        });
        const req = { user: { userId: "1" } };
        const res = createRes();
        await auth.getProfile(req, res);
        expect(res.json).toHaveBeenCalledWith({
          user: expect.objectContaining({ district: "Galle" }),
        });
      });
    });

    describe("negative cases", () => {
      it("returns 404 when user missing", async () => {
        User.findById.mockResolvedValue(null);
        const req = { user: { userId: "1" } };
        const res = createRes();
        await auth.getProfile(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
      });

      it("returns 500 when findById throws", async () => {
        User.findById.mockRejectedValue(new Error("db"));
        const req = { user: { userId: "1" } };
        const res = createRes();
        await auth.getProfile(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });

  describe("updateProfile", () => {
    describe("positive cases", () => {
      it("updates email when unique", async () => {
        const save = jest.fn().mockResolvedValue();
        User.findById.mockResolvedValue({
          _id: "1",
          email: "old@test.com",
          name: "N",
          phone: "1",
          role: "PUBLIC_USER",
          password: "hp",
          save,
        });
        User.findOne.mockResolvedValue(null);

        const req = {
          user: { userId: "1" },
          body: { email: "new@test.com" },
        };
        const res = createRes();
        await auth.updateProfile(req, res);
        expect(save).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ message: "Profile updated successfully" }),
        );
      });

      it("updates password when current password valid", async () => {
        const save = jest.fn().mockResolvedValue();
        User.findById.mockResolvedValue({
          _id: "1",
          email: "a@test.com",
          name: "N",
          phone: "1",
          role: "PUBLIC_USER",
          password: "hp",
          save,
        });
        bcrypt.compare.mockResolvedValue(true);

        const req = {
          user: { userId: "1" },
          body: {
            password: "newsecret12345",
            currentPassword: "oldcorrect",
          },
        };
        const res = createRes();
        await auth.updateProfile(req, res);
        expect(bcrypt.hash).toHaveBeenCalled();
        expect(save).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({ message: "Profile updated successfully" }),
        );
      });

      it("updates phone when provided", async () => {
        const save = jest.fn().mockResolvedValue();
        User.findById.mockResolvedValue({
          _id: "1",
          email: "a@test.com",
          name: "N",
          phone: "1",
          role: "PUBLIC_USER",
          password: "hp",
          save,
        });
        const req = {
          user: { userId: "1" },
          body: { phone: "+94770000000" },
        };
        const res = createRes();
        await auth.updateProfile(req, res);
        expect(save).toHaveBeenCalled();
        expect(res.json).toHaveBeenCalledWith(
          expect.objectContaining({
            user: expect.objectContaining({ phone: "+94770000000" }),
          }),
        );
      });
    });

    describe("negative cases", () => {
      it("returns 404 when user not found", async () => {
        User.findById.mockResolvedValue(null);
        const req = { user: { userId: "1" }, body: {} };
        const res = createRes();
        await auth.updateProfile(req, res);
        expect(res.status).toHaveBeenCalledWith(404);
      });

      it("returns 400 when new email already taken", async () => {
        User.findById.mockResolvedValue({
          _id: "1",
          email: "a@test.com",
          save: jest.fn(),
        });
        User.findOne.mockResolvedValue({ _id: "other" });
        const req = {
          user: { userId: "1" },
          body: { email: "taken@test.com" },
        };
        const res = createRes();
        await auth.updateProfile(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("returns 400 when password change without current password", async () => {
        User.findById.mockResolvedValue({ _id: "1", email: "a@test.com", save: jest.fn() });
        const req = {
          user: { userId: "1" },
          body: { password: "newpass12345" },
        };
        const res = createRes();
        await auth.updateProfile(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("returns 400 when current password wrong", async () => {
        User.findById.mockResolvedValue({ _id: "1", email: "a@test.com", password: "hp", save: jest.fn() });
        bcrypt.compare.mockResolvedValue(false);
        const req = {
          user: { userId: "1" },
          body: { password: "newpass12345", currentPassword: "wrong" },
        };
        const res = createRes();
        await auth.updateProfile(req, res);
        expect(res.status).toHaveBeenCalledWith(400);
      });

      it("returns 500 when save throws", async () => {
        User.findById.mockResolvedValue({
          _id: "1",
          email: "a@test.com",
          save: jest.fn().mockRejectedValue(new Error("persist")),
        });
        const req = {
          user: { userId: "1" },
          body: { phone: "2" },
        };
        const res = createRes();
        await auth.updateProfile(req, res);
        expect(res.status).toHaveBeenCalledWith(500);
      });
    });
  });
});
