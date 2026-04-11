/**
 * HTTP integration tests: real Express app + in-memory MongoDB.
 * External I/O is mocked (email, Cloudinary uploads, Gemini advisory) so tests stay fast and deterministic.
 *
 * Run: npm run test:integration
 * Coverage: npm run test:integration:coverage
 */

jest.mock("../utils/email.service", () => jest.fn().mockResolvedValue(undefined));

jest.mock("../config/cloudinary", () => ({
  uploadToCloudinary: jest.fn().mockResolvedValue({
    url: "https://res.cloudinary.com/demo/image.jpg",
    publicId: "integration-test-public-id",
    format: "jpg",
  }),
  deleteFromCloudinary: jest.fn().mockResolvedValue({}),
}));

jest.mock("../services/gemini.service", () => ({
  generateAdvisory: jest.fn().mockResolvedValue({
    generatedAt: new Date().toISOString(),
    zoneCount: 1,
    activeNowCount: 0,
    advisory: {
      overallRiskLevel: "LOW",
      executiveSummary: "Integration test advisory",
    },
    zoneFacts: [
      {
        zoneId: "z1",
        zoneName: "Zone A",
        preliminaryRiskScore: 5,
        preliminaryRiskLevel: "MEDIUM",
        isCurrentlyActive: true,
        restrictedTime: "All Day",
      },
    ],
  }),
}));

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");
const bcrypt = require("bcryptjs");
const request = require("supertest");

const { User } = require("../models/user");
const { IllegalReport } = require("../models/IllegalReport");
const Species = require("../models/Species.model");

let app;
let mongoServer;

const uniqueEmail = () =>
  `u-${Date.now()}-${Math.random().toString(36).slice(2, 9)}@integration.test`;

const PASS = "password12345";

async function createApprovedUser(role, extra = {}) {
  const email = uniqueEmail();
  const hashed = await bcrypt.hash(PASS, 10);
  const user = await User.create({
    name: "Integration User",
    email,
    phone: "0777777777",
    password: hashed,
    role,
    status: "APPROVED",
    ...extra,
  });
  return { user, email };
}

async function loginToken(email) {
  const res = await request(app)
    .post("/api/auth/login")
    .send({ email, password: PASS })
    .set("Content-Type", "application/json")
    .expect(200);
  return res.body.token;
}

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  process.env.JWT_SECRET = "integration-test-jwt-secret-key-min-32-chars";
  process.env.MONGO_URI = mongoServer.getUri();

  process.env.GEMINI_API_KEY = "integration-test-gemini-api-key-placeholder";
  process.env.SENDGRID_API_KEY = "SG.integration_test_dummy_sendgrid_key_placeholder";
  process.env.TWILIO_ACCOUNT_SID = "ACintegration_test_sid";
  process.env.TWILIO_AUTH_TOKEN = "integration_test_token";
  process.env.TWILIO_PHONE_NUMBER = "+15550001111";

  await mongoose.connect(process.env.MONGO_URI);
  try {
    await Species.syncIndexes();
  } catch (e) {
    /* ignore index sync issues in test env */
  }
  app = require("../app");
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
});

afterEach(async () => {
  if (mongoose.connection.db) {
    await mongoose.connection.db.dropDatabase();
    // Geo queries need 2dsphere; dropDatabase removes all indexes
    try {
      await Species.syncIndexes();
    } catch (e) {
      /* ignore */
    }
  }
});

describe("API integration", () => {
  describe("GET /api/districts", () => {
    it("returns the list of Sri Lankan districts", async () => {
      const res = await request(app).get("/api/districts").expect(200);

      expect(Array.isArray(res.body.districts)).toBe(true);
      expect(res.body.districts).toContain("Galle");
    });
  });

  describe("POST /api/auth/signup + POST /api/auth/login", () => {
    it("registers a PUBLIC_USER and logs in with JSON token", async () => {
      const email = uniqueEmail();

      const signup = await request(app)
        .post("/api/auth/signup")
        .field("name", "Integration User")
        .field("email", email)
        .field("phone", "0777777777")
        .field("password", PASS)
        .field("role", "PUBLIC_USER")
        .expect(201);

      expect(signup.body.message).toMatch(/signup/i);

      const login = await request(app)
        .post("/api/auth/login")
        .send({ email, password: PASS })
        .set("Content-Type", "application/json")
        .expect(200);

      expect(login.body.token).toBeDefined();
      expect(login.body.user.email).toBe(email);
    });

    it("returns 400 when email is already registered", async () => {
      const email = uniqueEmail();

      await request(app)
        .post("/api/auth/signup")
        .field("name", "First")
        .field("email", email)
        .field("phone", "0771111111")
        .field("password", PASS)
        .field("role", "PUBLIC_USER")
        .expect(201);

      const second = await request(app)
        .post("/api/auth/signup")
        .field("name", "Second")
        .field("email", email)
        .field("phone", "0772222222")
        .field("password", PASS)
        .field("role", "PUBLIC_USER")
        .expect(400);

      expect(second.body.message).toMatch(/already exists/i);
    });
  });

  describe("Protected routes (profile)", () => {
    it("returns 401 when Authorization is missing", async () => {
      await request(app).get("/api/profile/public/me").expect(401);
    });

    it("returns 401 when Bearer token is invalid", async () => {
      await request(app)
        .get("/api/profile/public/me")
        .set("Authorization", "Bearer not-a-real-jwt")
        .expect(401);
    });

    it("returns public profile for a valid PUBLIC_USER token", async () => {
      const { email } = await createApprovedUser("PUBLIC_USER");
      const token = await loginToken(email);

      const profile = await request(app)
        .get("/api/profile/public/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(profile.body.email).toBe(email);
      expect(profile.body.role).toBe("PUBLIC_USER");
    });

    it("updates public profile fields", async () => {
      const { email } = await createApprovedUser("PUBLIC_USER");
      const token = await loginToken(email);

      const res = await request(app)
        .put("/api/profile/public/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Updated Name", phone: "0779999999" })
        .expect(200);

      expect(res.body.message).toMatch(/success/i);
      expect(res.body.user.name).toBe("Updated Name");
    });

    it("returns AUTHORIZED_PERSON profile from /api/profile/me", async () => {
      const { email } = await createApprovedUser("AUTHORIZED_PERSON", {
        district: "Galle",
        evidenceFiles: ["id.pdf"],
      });
      const token = await loginToken(email);

      const res = await request(app)
        .get("/api/profile/me")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.role).toBe("AUTHORIZED_PERSON");
      expect(res.body.district).toBe("Galle");
    });
  });

  describe("Admin routes", () => {
    it("returns 401 for /api/admin/pending-users without token", async () => {
      await request(app).get("/api/admin/pending-users").expect(401);
    });

    it("returns pending users for ADMIN token", async () => {
      const adminEmail = uniqueEmail();
      const hashed = await bcrypt.hash("admin12345678", 10);
      await User.create({
        name: "Admin",
        email: adminEmail,
        phone: "0111111111",
        password: hashed,
        role: "ADMIN",
        status: "APPROVED",
      });

      await User.create({
        name: "Pending",
        email: uniqueEmail(),
        phone: "0222222222",
        password: hashed,
        role: "PUBLIC_USER",
        status: "PENDING",
      });

      const login = await request(app)
        .post("/api/auth/login")
        .send({ email: adminEmail, password: "admin12345678" })
        .set("Content-Type", "application/json")
        .expect(200);

      const res = await request(app)
        .get("/api/admin/pending-users")
        .set("Authorization", `Bearer ${login.body.token}`)
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBe(1);
      expect(res.body[0].status).toBe("PENDING");
    });

    it("returns 403 when non-admin accesses admin route", async () => {
      const { email } = await createApprovedUser("PUBLIC_USER");
      const token = await loginToken(email);

      await request(app)
        .get("/api/admin/pending-users")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });

    it("approves a user and lists non-admin users", async () => {
      const adminEmail = uniqueEmail();
      const hashed = await bcrypt.hash("adminpass12345", 10);
      await User.create({
        name: "Admin",
        email: adminEmail,
        phone: "0111111111",
        password: hashed,
        role: "ADMIN",
        status: "APPROVED",
      });

      const pending = await User.create({
        name: "ToApprove",
        email: uniqueEmail(),
        phone: "0222222222",
        password: hashed,
        role: "PUBLIC_USER",
        status: "PENDING",
      });

      const login = await request(app)
        .post("/api/auth/login")
        .send({ email: adminEmail, password: "adminpass12345" })
        .set("Content-Type", "application/json")
        .expect(200);

      const approve = await request(app)
        .put(`/api/admin/approve/${pending._id}`)
        .set("Authorization", `Bearer ${login.body.token}`)
        .expect(200);

      expect(approve.body.user.status).toBe("APPROVED");

      const allUsers = await request(app)
        .get("/api/admin/users")
        .set("Authorization", `Bearer ${login.body.token}`)
        .expect(200);

      expect(Array.isArray(allUsers.body)).toBe(true);
      expect(allUsers.body.some((u) => u.email === pending.email)).toBe(true);
    });

    it("rejects a pending user", async () => {
      const adminEmail = uniqueEmail();
      const hashed = await bcrypt.hash("adminpass12345", 10);
      await User.create({
        name: "Admin",
        email: adminEmail,
        phone: "0111111111",
        password: hashed,
        role: "ADMIN",
        status: "APPROVED",
      });

      const pending = await User.create({
        name: "ToReject",
        email: uniqueEmail(),
        phone: "0333333333",
        password: hashed,
        role: "PUBLIC_USER",
        status: "PENDING",
      });

      const login = await request(app)
        .post("/api/auth/login")
        .send({ email: adminEmail, password: "adminpass12345" })
        .set("Content-Type", "application/json")
        .expect(200);

      const rej = await request(app)
        .put(`/api/admin/reject/${pending._id}`)
        .set("Authorization", `Bearer ${login.body.token}`)
        .expect(200);

      expect(rej.body.user.status).toBe("REJECTED");
    });

    it("deletes a user by id", async () => {
      const adminEmail = uniqueEmail();
      const hashed = await bcrypt.hash("adminpass12345", 10);
      await User.create({
        name: "Admin",
        email: adminEmail,
        phone: "0111111111",
        password: hashed,
        role: "ADMIN",
        status: "APPROVED",
      });

      const victim = await User.create({
        name: "DeleteMe",
        email: uniqueEmail(),
        phone: "0444444444",
        password: hashed,
        role: "PUBLIC_USER",
        status: "APPROVED",
      });

      const login = await request(app)
        .post("/api/auth/login")
        .send({ email: adminEmail, password: "adminpass12345" })
        .set("Content-Type", "application/json")
        .expect(200);

      await request(app)
        .delete(`/api/admin/users/${victim._id}`)
        .set("Authorization", `Bearer ${login.body.token}`)
        .expect(200);

      const gone = await User.findById(victim._id);
      expect(gone).toBeNull();
    });
  });

  describe("Reports", () => {
    it("creates a report and lists it under my reports", async () => {
      const { user, email } = await createApprovedUser("PUBLIC_USER");
      const token = await loginToken(email);

      const res = await request(app)
        .post("/api/reports")
        .set("Authorization", `Bearer ${token}`)
        .field("district", "Galle")
        .field("reportDate", "2026-04-01")
        .field("reportTime", "14:30")
        .field("location", "Near harbor")
        .field("latitude", "6.0")
        .field("longitude", "80.2")
        .field("description", "Illegal nets observed")
        .expect(201);

      expect(res.body.report).toBeDefined();
      expect(res.body.report.district).toBe("Galle");

      const mine = await request(app)
        .get("/api/reports/my")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(mine.body)).toBe(true);
      expect(mine.body.length).toBe(1);
      expect(mine.body[0].reporter._id || mine.body[0].reporter).toBeDefined();
    });

    it("returns statistics for authenticated user", async () => {
      const { email } = await createApprovedUser("PUBLIC_USER");
      const token = await loginToken(email);

      await request(app)
        .post("/api/reports")
        .set("Authorization", `Bearer ${token}`)
        .field("district", "Matara")
        .field("reportDate", "2026-04-02")
        .field("reportTime", "09:00")
        .field("location", "Coast")
        .field("latitude", "5.9")
        .field("longitude", "80.5")
        .field("description", "Report text here")
        .expect(201);

      const stats = await request(app)
        .get("/api/reports/statistics")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(stats.body)).toBe(true);
    });

    it("lets AUTHORIZED_PERSON see district reports and ADMIN see all district reports", async () => {
      const hashed = await bcrypt.hash(PASS, 10);
      const reporterEmail = uniqueEmail();
      await User.create({
        name: "Reporter",
        email: reporterEmail,
        phone: "0551111111",
        password: hashed,
        role: "PUBLIC_USER",
        status: "APPROVED",
      });

      const officerEmail = uniqueEmail();
      await User.create({
        name: "Officer",
        email: officerEmail,
        phone: "0552222222",
        password: hashed,
        role: "AUTHORIZED_PERSON",
        district: "Colombo",
        status: "APPROVED",
        evidenceFiles: ["e.pdf"],
      });

      const adminEmail = uniqueEmail();
      await User.create({
        name: "Admin",
        email: adminEmail,
        phone: "0553333333",
        password: hashed,
        role: "ADMIN",
        status: "APPROVED",
      });

      const repToken = await loginToken(reporterEmail);
      await request(app)
        .post("/api/reports")
        .set("Authorization", `Bearer ${repToken}`)
        .field("district", "Colombo")
        .field("reportDate", "2026-05-01")
        .field("reportTime", "10:00")
        .field("location", "Sea")
        .field("latitude", "6.9")
        .field("longitude", "79.9")
        .field("description", "Illegal activity")
        .expect(201);

      const offToken = await loginToken(officerEmail);
      const districtReports = await request(app)
        .get("/api/reports/my-district")
        .set("Authorization", `Bearer ${offToken}`)
        .expect(200);

      expect(districtReports.body.district).toBe("Colombo");
      expect(districtReports.body.count).toBe(1);

      const adminLogin = await request(app)
        .post("/api/auth/login")
        .send({ email: adminEmail, password: PASS })
        .set("Content-Type", "application/json")
        .expect(200);

      const byDistrict = await request(app)
        .get("/api/reports/district/Colombo")
        .set("Authorization", `Bearer ${adminLogin.body.token}`)
        .expect(200);

      expect(byDistrict.body.district).toBe("Colombo");
      expect(byDistrict.body.reports.length).toBe(1);

      const allRep = await request(app)
        .get("/api/reports/all")
        .set("Authorization", `Bearer ${adminLogin.body.token}`)
        .expect(200);

      expect(allRep.body.total).toBeGreaterThanOrEqual(1);
      expect(allRep.body.reports.length).toBeGreaterThanOrEqual(1);
    });

    it("updates and deletes own report", async () => {
      const { email } = await createApprovedUser("PUBLIC_USER");
      const token = await loginToken(email);

      const created = await request(app)
        .post("/api/reports")
        .set("Authorization", `Bearer ${token}`)
        .field("district", "Galle")
        .field("reportDate", "2026-06-01")
        .field("reportTime", "12:00")
        .field("location", "Bay")
        .field("latitude", "6.0")
        .field("longitude", "80.1")
        .field("description", "Original description")
        .expect(201);

      const id = created.body.report._id;

      await request(app)
        .put(`/api/reports/${id}`)
        .set("Authorization", `Bearer ${token}`)
        .send({ description: "Updated description text" })
        .expect(200);

      await request(app)
        .delete(`/api/reports/${id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      const left = await IllegalReport.findById(id);
      expect(left).toBeNull();
    });
  });

  describe("Investigations (officer flow)", () => {
    it("starts investigation, submits findings, downloads PDF, admin deletes", async () => {
      const hashed = await bcrypt.hash(PASS, 10);

      const reporterEmail = uniqueEmail();
      await User.create({
        name: "Reporter",
        email: reporterEmail,
        phone: "0661111111",
        password: hashed,
        role: "PUBLIC_USER",
        status: "APPROVED",
      });

      const officerEmail = uniqueEmail();
      await User.create({
        name: "Officer",
        email: officerEmail,
        phone: "0662222222",
        password: hashed,
        role: "AUTHORIZED_PERSON",
        district: "Galle",
        status: "APPROVED",
        evidenceFiles: ["e.pdf"],
      });

      const adminEmail = uniqueEmail();
      await User.create({
        name: "Admin",
        email: adminEmail,
        phone: "0663333333",
        password: hashed,
        role: "ADMIN",
        status: "APPROVED",
      });

      const repToken = await loginToken(reporterEmail);
      const reportRes = await request(app)
        .post("/api/reports")
        .set("Authorization", `Bearer ${repToken}`)
        .field("district", "Galle")
        .field("reportDate", "2026-07-01")
        .field("reportTime", "08:00")
        .field("location", "Harbor area")
        .field("latitude", "6.0")
        .field("longitude", "80.2")
        .field("description", "Needs investigation")
        .expect(201);

      const reportId = reportRes.body.report._id;

      const offToken = await loginToken(officerEmail);
      const start = await request(app)
        .post(`/api/investigations/start/${reportId}`)
        .set("Authorization", `Bearer ${offToken}`)
        .expect(201);

      const investigationId = start.body.investigation._id;

      const submit = await request(app)
        .post(`/api/investigations/submit/${investigationId}`)
        .set("Authorization", `Bearer ${offToken}`)
        .field("visited", "true")
        .field("actualSituation", "Vessels checked; minor violation")
        .field("illegalActivityFound", "true")
        .field("actionTaken", "WARNING")
        .field("actionDescription", "Verbal warning issued")
        .field("fineAmount", "0")
        .field("visitDate", "2026-07-02")
        .field("visitTime", "15:00")
        .field("officerNotes", "Follow-up optional")
        .expect(200);

      expect(submit.body.message).toMatch(/success/i);

      const mine = await request(app)
        .get("/api/investigations/my-investigations")
        .set("Authorization", `Bearer ${offToken}`)
        .expect(200);

      expect(mine.body.total).toBe(1);

      const adminLogin = await request(app)
        .post("/api/auth/login")
        .send({ email: adminEmail, password: PASS })
        .set("Content-Type", "application/json")
        .expect(200);

      const pdf = await request(app)
        .get(`/api/investigations/${investigationId}/pdf`)
        .set("Authorization", `Bearer ${adminLogin.body.token}`)
        .expect(200);

      expect(pdf.headers["content-type"]).toMatch(/pdf/);

      const notif = await request(app)
        .get(`/api/investigations/${investigationId}/notifications`)
        .set("Authorization", `Bearer ${adminLogin.body.token}`)
        .expect(200);

      expect(notif.body).toBeDefined();

      await request(app)
        .delete(`/api/investigations/${investigationId}`)
        .set("Authorization", `Bearer ${adminLogin.body.token}`)
        .expect(200);
    });
  });

  describe("Restricted zones", () => {
    it("creates a zone, lists it, gets AI advisory, deactivates and deletes", async () => {
      const { email } = await createApprovedUser("AUTHORIZED_PERSON", {
        district: "Galle",
        evidenceFiles: ["id.pdf"],
      });
      const token = await loginToken(email);

      const res = await request(app)
        .post("/api/zones")
        .set("Authorization", `Bearer ${token}`)
        .field("name", "Integration Zone")
        .field("location", JSON.stringify({ lat: 7.25, lng: 80.45 }))
        .field("startDate", "2026-02-01")
        .field("endDate", "2026-12-31")
        .field("restrictedTime", "All Day")
        .expect(201);

      const zoneId = res.body._id;

      const list = await request(app)
        .get("/api/zones")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(list.body)).toBe(true);
      expect(list.body.length).toBe(1);

      const advisory = await request(app)
        .get("/api/zones/ai-advisory")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(advisory.body.advisory || advisory.body).toBeDefined();

      await request(app)
        .patch(`/api/zones/${zoneId}/deactivate`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      await request(app)
        .delete(`/api/zones/${zoneId}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
    });
  });

  describe("Species (ZOOLOGIST)", () => {
    it("lists species with pagination and creates entry with evidence upload", async () => {
      const { email } = await createApprovedUser("ZOOLOGIST", { evidenceFiles: ["id.pdf"] });
      const token = await loginToken(email);

      const list = await request(app)
        .get("/api/species?page=1&limit=5")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(list.body).toBeDefined();

      const fishes = JSON.stringify([
        {
          scientificName: "Testus integrationus",
          localName: "Test Fish",
          conservationStatus: "Endangered",
        },
      ]);

      const location = JSON.stringify({
        coordinates: [80.5, 6.8],
        address: "Test Bay",
      });

      const create = await request(app)
        .post("/api/species")
        .set("Authorization", `Bearer ${token}`)
        .field("fishes", fishes)
        .field(
          "description",
          "This is a long enough description for integration testing purposes.",
        )
        .field("location", location)
        .field("threats", JSON.stringify(["pollution"]))
        .field("tags", JSON.stringify(["tag1"]))
        .attach("evidence", Buffer.from("fake-png-bytes"), "evidence.png")
        .expect(201);

      expect(create.body.success).toBe(true);

      const all = await request(app)
        .get("/api/species/all")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(all.body.success).toBe(true);
      expect(Array.isArray(all.body.data)).toBe(true);
      expect(all.body.data.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("Auth (ZOOLOGIST) profile routes", () => {
    it("returns profile for ZOOLOGIST on GET /api/auth/profile", async () => {
      const { email } = await createApprovedUser("ZOOLOGIST", { evidenceFiles: ["z.pdf"] });
      const token = await loginToken(email);

      const res = await request(app)
        .get("/api/auth/profile")
        .set("Authorization", `Bearer ${token}`)
        .expect(200);

      expect(res.body.user.email).toBe(email);
    });

    it("updates profile on PUT /api/auth/profile", async () => {
      const { email } = await createApprovedUser("ZOOLOGIST", { evidenceFiles: ["z.pdf"] });
      const token = await loginToken(email);

      const res = await request(app)
        .put("/api/auth/profile")
        .set("Authorization", `Bearer ${token}`)
        .send({ phone: "0778888888" })
        .expect(200);

      expect(res.body.message).toMatch(/success/i);
    });
  });

  describe("Auth signup (AUTHORIZED_PERSON)", () => {
    it("registers AUTHORIZED_PERSON with district and evidence (pending until admin approves)", async () => {
      const email = uniqueEmail();
      const signup = await request(app)
        .post("/api/auth/signup")
        .field("name", "Officer New")
        .field("email", email)
        .field("phone", "0776666666")
        .field("password", PASS)
        .field("role", "AUTHORIZED_PERSON")
        .field("district", "Matara")
        .attach("evidence", Buffer.from("pdf-bytes"), "id.pdf")
        .expect(201);

      expect(signup.body.user.district).toBe("Matara");

      await request(app)
        .post("/api/auth/login")
        .send({ email, password: PASS })
        .expect(403);
    });
  });

  describe("Profile AUTHORIZED_PERSON + public password", () => {
    it("updates AUTHORIZED profile on PUT /api/profile/me", async () => {
      const { email } = await createApprovedUser("AUTHORIZED_PERSON", {
        district: "Galle",
        evidenceFiles: ["id.pdf"],
      });
      const token = await loginToken(email);

      const res = await request(app)
        .put("/api/profile/me")
        .set("Authorization", `Bearer ${token}`)
        .send({ name: "Officer Updated" })
        .expect(200);

      expect(res.body.user.name).toBe("Officer Updated");
    });

    it("changes password on PUT /api/profile/public/password", async () => {
      const { email } = await createApprovedUser("PUBLIC_USER");
      const token = await loginToken(email);

      await request(app)
        .put("/api/profile/public/password")
        .set("Authorization", `Bearer ${token}`)
        .send({
          currentPassword: PASS,
          newPassword: "newpassword12345",
        })
        .expect(200);

      await request(app)
        .post("/api/auth/login")
        .send({ email, password: "newpassword12345" })
        .expect(200);
    });
  });

  describe("Reports authorization", () => {
    it("returns 403 when non-admin calls GET /api/reports/all", async () => {
      const { email } = await createApprovedUser("PUBLIC_USER");
      const token = await loginToken(email);

      await request(app)
        .get("/api/reports/all")
        .set("Authorization", `Bearer ${token}`)
        .expect(403);
    });
  });

  describe("Investigations — extra behaviours", () => {
    it("lists assigned reports and investigation details for officer", async () => {
      const hashed = await bcrypt.hash(PASS, 10);

      const reporterEmail = uniqueEmail();
      await User.create({
        name: "R",
        email: reporterEmail,
        phone: "0711111111",
        password: hashed,
        role: "PUBLIC_USER",
        status: "APPROVED",
      });

      const officerEmail = uniqueEmail();
      const officer = await User.create({
        name: "O",
        email: officerEmail,
        phone: "0722222222",
        password: hashed,
        role: "AUTHORIZED_PERSON",
        district: "Kandy",
        status: "APPROVED",
        evidenceFiles: ["e.pdf"],
      });

      const repToken = await loginToken(reporterEmail);
      const reportRes = await request(app)
        .post("/api/reports")
        .set("Authorization", `Bearer ${repToken}`)
        .field("district", "Kandy")
        .field("reportDate", "2026-08-01")
        .field("reportTime", "09:00")
        .field("location", "Lake")
        .field("latitude", "7.3")
        .field("longitude", "80.6")
        .field("description", "Report for assignment")
        .expect(201);

      const reportId = reportRes.body.report._id;
      const offToken = await loginToken(officerEmail);

      const assigned = await request(app)
        .get("/api/investigations/assigned-reports")
        .set("Authorization", `Bearer ${offToken}`)
        .expect(200);

      expect(assigned.body.district).toBe("Kandy");
      expect(assigned.body.reports.length).toBeGreaterThanOrEqual(1);

      const start = await request(app)
        .post(`/api/investigations/start/${reportId}`)
        .set("Authorization", `Bearer ${offToken}`)
        .expect(201);

      const invId = start.body.investigation._id;

      const details = await request(app)
        .get(`/api/investigations/${invId}`)
        .set("Authorization", `Bearer ${offToken}`)
        .expect(200);

      expect(details.body._id || details.body.id).toBeDefined();
    });

    it("cancels an INVESTIGATING investigation via DELETE /cancel/:id", async () => {
      const hashed = await bcrypt.hash(PASS, 10);
      const reporterEmail = uniqueEmail();
      await User.create({
        name: "R",
        email: reporterEmail,
        phone: "0733333333",
        password: hashed,
        role: "PUBLIC_USER",
        status: "APPROVED",
      });
      const officerEmail = uniqueEmail();
      await User.create({
        name: "O",
        email: officerEmail,
        phone: "0744444444",
        password: hashed,
        role: "AUTHORIZED_PERSON",
        district: "Jaffna",
        status: "APPROVED",
        evidenceFiles: ["e.pdf"],
      });

      const repToken = await loginToken(reporterEmail);
      const reportRes = await request(app)
        .post("/api/reports")
        .set("Authorization", `Bearer ${repToken}`)
        .field("district", "Jaffna")
        .field("reportDate", "2026-09-01")
        .field("reportTime", "10:00")
        .field("location", "Coast")
        .field("latitude", "9.7")
        .field("longitude", "80.0")
        .field("description", "Cancel flow report")
        .expect(201);

      const offToken = await loginToken(officerEmail);
      const start = await request(app)
        .post(`/api/investigations/start/${reportRes.body.report._id}`)
        .set("Authorization", `Bearer ${offToken}`)
        .expect(201);

      const invId = start.body.investigation._id;

      await request(app)
        .delete(`/api/investigations/cancel/${invId}`)
        .set("Authorization", `Bearer ${offToken}`)
        .expect(200);

      const Investigation = require("../models/Investigation");
      expect(await Investigation.findById(invId)).toBeNull();
    });

    it("GET /api/investigations/admin/all returns investigations for ADMIN", async () => {
      const hashed = await bcrypt.hash(PASS, 10);
      const adminEmail = uniqueEmail();
      await User.create({
        name: "Adm",
        email: adminEmail,
        phone: "0755555555",
        password: hashed,
        role: "ADMIN",
        status: "APPROVED",
      });

      const reporterEmail = uniqueEmail();
      await User.create({
        name: "Rep",
        email: reporterEmail,
        phone: "0766666666",
        password: hashed,
        role: "PUBLIC_USER",
        status: "APPROVED",
      });
      const officerEmail = uniqueEmail();
      await User.create({
        name: "Off",
        email: officerEmail,
        phone: "0770000000",
        password: hashed,
        role: "AUTHORIZED_PERSON",
        district: "Galle",
        status: "APPROVED",
        evidenceFiles: ["e.pdf"],
      });

      const repToken = await loginToken(reporterEmail);
      const reportRes = await request(app)
        .post("/api/reports")
        .set("Authorization", `Bearer ${repToken}`)
        .field("district", "Galle")
        .field("reportDate", "2026-10-01")
        .field("reportTime", "11:00")
        .field("location", "X")
        .field("latitude", "6.0")
        .field("longitude", "80.2")
        .field("description", "Admin all test")
        .expect(201);

      const offToken = await loginToken(officerEmail);
      await request(app)
        .post(`/api/investigations/start/${reportRes.body.report._id}`)
        .set("Authorization", `Bearer ${offToken}`)
        .expect(201);

      const adminLogin = await request(app)
        .post("/api/auth/login")
        .send({ email: adminEmail, password: PASS })
        .expect(200);

      const all = await request(app)
        .get("/api/investigations/admin/all")
        .set("Authorization", `Bearer ${adminLogin.body.token}`)
        .expect(200);

      expect(all.body.stats).toBeDefined();
      expect(Array.isArray(all.body.investigations)).toBe(true);
      expect(all.body.investigations.length).toBeGreaterThanOrEqual(1);
    });

    it("POST /api/investigations/bulk-delete removes multiple investigations", async () => {
      const hashed = await bcrypt.hash(PASS, 10);
      const adminEmail = uniqueEmail();
      await User.create({
        name: "Adm",
        email: adminEmail,
        phone: "0788888888",
        password: hashed,
        role: "ADMIN",
        status: "APPROVED",
      });

      const reporterEmail = uniqueEmail();
      await User.create({
        name: "Rep",
        email: reporterEmail,
        phone: "0799999999",
        password: hashed,
        role: "PUBLIC_USER",
        status: "APPROVED",
      });
      const officerEmail = uniqueEmail();
      await User.create({
        name: "Off",
        email: officerEmail,
        phone: "0700000000",
        password: hashed,
        role: "AUTHORIZED_PERSON",
        district: "Matara",
        status: "APPROVED",
        evidenceFiles: ["e.pdf"],
      });

      const repToken = await loginToken(reporterEmail);
      const offToken = await loginToken(officerEmail);

      const ids = [];
      for (let i = 0; i < 2; i++) {
        const reportRes = await request(app)
          .post("/api/reports")
          .set("Authorization", `Bearer ${repToken}`)
          .field("district", "Matara")
          .field("reportDate", "2026-11-0" + (i + 1))
          .field("reportTime", "12:0" + i)
          .field("location", "L" + i)
          .field("latitude", "5.9")
          .field("longitude", "80.5")
          .field("description", "Bulk delete report " + i)
          .expect(201);

        const st = await request(app)
          .post(`/api/investigations/start/${reportRes.body.report._id}`)
          .set("Authorization", `Bearer ${offToken}`)
          .expect(201);
        ids.push(st.body.investigation._id);
      }

      const adminLogin = await request(app)
        .post("/api/auth/login")
        .send({ email: adminEmail, password: PASS })
        .expect(200);

      const bulk = await request(app)
        .post("/api/investigations/bulk-delete")
        .set("Authorization", `Bearer ${adminLogin.body.token}`)
        .send({ investigationIds: ids })
        .expect(200);

      expect(bulk.body.deletedCount).toBe(2);
    });

    it("returns 400 for bulk-delete without investigationIds array", async () => {
      const adminEmail = uniqueEmail();
      await User.create({
        name: "Adm",
        email: adminEmail,
        phone: "0712345678",
        password: await bcrypt.hash(PASS, 10),
        role: "ADMIN",
        status: "APPROVED",
      });

      const adminLogin = await request(app)
        .post("/api/auth/login")
        .send({ email: adminEmail, password: PASS })
        .expect(200);

      await request(app)
        .post("/api/investigations/bulk-delete")
        .set("Authorization", `Bearer ${adminLogin.body.token}`)
        .send({})
        .expect(400);
    });
  });

  describe("Restricted zones — update", () => {
    it("updates a zone on PUT /api/zones/:id", async () => {
      const { email } = await createApprovedUser("AUTHORIZED_PERSON", {
        district: "Galle",
        evidenceFiles: ["id.pdf"],
      });
      const token = await loginToken(email);

      const created = await request(app)
        .post("/api/zones")
        .set("Authorization", `Bearer ${token}`)
        .field("name", "Zone To Update")
        .field("location", JSON.stringify({ lat: 7.1, lng: 80.2 }))
        .field("startDate", "2026-03-01")
        .field("endDate", "2026-12-31")
        .expect(201);

      const zoneId = created.body._id;

      const updated = await request(app)
        .put(`/api/zones/${zoneId}`)
        .set("Authorization", `Bearer ${token}`)
        .field("name", "Zone Renamed")
        .expect(200);

      expect(updated.body.name).toBe("Zone Renamed");
    });
  });

  describe("Species — full CRUD + geo endpoints", () => {
    async function createSpeciesViaApi(token) {
      const fishes = JSON.stringify([
        {
          scientificName: "Geo Test Species",
          localName: "Geo Fish",
          conservationStatus: "Vulnerable",
        },
      ]);
      const location = JSON.stringify({
        coordinates: [80.12, 6.95],
        address: "Geo Bay",
      });

      const create = await request(app)
        .post("/api/species")
        .set("Authorization", `Bearer ${token}`)
        .field("fishes", fishes)
        .field(
          "description",
          "Description for geo and CRUD integration tests here.",
        )
        .field("location", location)
        .field("threats", JSON.stringify(["habitat loss"]))
        .field("tags", JSON.stringify(["geo"]))
        .attach("evidence", Buffer.from("img"), "ev.png")
        .expect(201);

      return create.body.data;
    }

    it("POST /api/species/nearby returns species near coordinates", async () => {
      const { email } = await createApprovedUser("ZOOLOGIST", { evidenceFiles: ["z.pdf"] });
      const token = await loginToken(email);
      await createSpeciesViaApi(token);

      const res = await request(app)
        .post("/api/species/nearby")
        .set("Authorization", `Bearer ${token}`)
        .send({
          longitude: 80.12,
          latitude: 6.95,
          maxDistance: 100000,
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.count).toBeGreaterThanOrEqual(1);
    });

    it("POST /api/species/details-by-location returns species at point", async () => {
      const { email } = await createApprovedUser("ZOOLOGIST", { evidenceFiles: ["z.pdf"] });
      const token = await loginToken(email);
      const species = await createSpeciesViaApi(token);
      const [lng, lat] = species.location.coordinates;

      const res = await request(app)
        .post("/api/species/details-by-location")
        .set("Authorization", `Bearer ${token}`)
        .send({ location: { coordinates: [lng, lat] } })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    it("PUT and DELETE species entry", async () => {
      const { email } = await createApprovedUser("ZOOLOGIST", { evidenceFiles: ["z.pdf"] });
      const token = await loginToken(email);
      const species = await createSpeciesViaApi(token);
      const id = species._id;

      const fishes = JSON.stringify([
        {
          scientificName: "Geo Test Species",
          localName: "Geo Fish Updated",
          conservationStatus: "Endangered",
        },
      ]);

      await request(app)
        .put(`/api/species/${id}`)
        .set("Authorization", `Bearer ${token}`)
        .field("fishes", fishes)
        .field(
          "description",
          "Updated description text for integration testing ok.",
        )
        .expect(200);

      await request(app)
        .delete(`/api/species/${id}`)
        .set("Authorization", `Bearer ${token}`)
        .expect(200);
    });
  });
});
