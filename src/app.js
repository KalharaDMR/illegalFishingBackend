/* Now Swagger URL: http://localhost:5000/api/docs */

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const reportRoutes = require("./routes/report.routes");
const districtRoutes = require("./routes/district.routes");
const investigationRoutes = require("./routes/investigation.routes");
const restrictedzoneRoutes = require("./routes/restrictedzone.routes");
const profileRoutes = require("./routes/profile.routes");
const ZoologistRoutes = require("./routes/Zoologist.routes");

const app = express();

/* ------------------ CORS CONFIG ------------------ */

// Allowed origins (optional strict list)
const allowedOrigins = [
  "http://localhost:3000",
];

// Dynamic CORS handling (supports Vercel preview URLs)
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (Postman, mobile apps)
      if (!origin) return callback(null, true);

      // Allow localhost
      if (origin.includes("localhost")) {
        return callback(null, true);
      }

      // Allow all Vercel deployments (IMPORTANT FIX)
      if (origin.includes("vercel.app")) {
        return callback(null, true);
      }

      // Allow any explicitly whitelisted origins
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
  })
);

// Handle preflight requests
app.options("*", cors());

/* ------------------ BODY PARSING ------------------ */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* ------------------ STATIC FILES ------------------ */

// Serve uploaded files correctly
app.use("/uploads", express.static("src/uploads"));

/* ------------------ SWAGGER ------------------ */

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/* ------------------ ROUTES ------------------ */

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api", districtRoutes);
app.use("/api/investigations", investigationRoutes);
app.use("/api/zones", restrictedzoneRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/species", ZoologistRoutes);

/* ------------------ ERROR HANDLER ------------------ */

// Optional: Better error visibility (especially for CORS errors)
app.use((err, req, res, next) => {
  console.error("Error:", err.message);

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      message: "CORS error: This origin is not allowed",
    });
  }

  res.status(500).json({
    message: "Internal Server Error",
  });
});

module.exports = app;