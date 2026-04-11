process.env.JWT_SECRET = "unit-test-secret";

const jwt = require("jsonwebtoken");
const generateToken = require("./jwt");

describe("generateToken", () => {
  describe("positive cases", () => {
    it("returns a verifiable JWT with user claims", () => {
      const user = {
        _id: "507f1f77bcf86cd799439011",
        role: "ZOOLOGIST",
        district: "Colombo",
      };
      const token = generateToken(user);
      const decoded = jwt.verify(token, "unit-test-secret");
      expect(decoded.userId).toBe(user._id);
      expect(decoded.role).toBe("ZOOLOGIST");
      expect(decoded.district).toBe("Colombo");
    });
  });
});
