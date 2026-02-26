/* Now Swagger URL: http://localhost:5000/api/docs */

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const reportRoutes = require("./routes/report.routes");
const districtRoutes = require("./routes/district.routes");
const investigationRoutes = require("./routes/investigation.routes");      // From Investigation_Management
const restrictedzoneRoutes = require("./routes/restrictedzone.routes");    // From development
const ZoologistRoutes = require("./routes/Zoologist.routes");              // From development

const app = express();

/* ------------------ MIDDLEWARE ------------------ */

// ✅ Proper CORS (important for frontend)
app.use(
  cors({
    origin: "http://localhost:3000", // change if frontend uses different port
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files properly
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
app.use("/api/investigations", investigationRoutes);        // From Investigation_Management
app.use("/api/zones", restrictedzoneRoutes);                // From development
app.use('/api/species', ZoologistRoutes);                   // From development

module.exports = app;