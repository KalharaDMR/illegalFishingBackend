/* Now Swagger URL: http://localhost:5000/api/docs */

const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const reportRoutes = require("./routes/report.routes");              // From Reporting
const restrictedzoneRoutes = require("./routes/restrictedzone.routes"); // From development
const districtRoutes = require("./routes/district.routes");          // Single import

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
app.use("/api/reports", reportRoutes);                 // From Reporting
app.use("/api/zones", restrictedzoneRoutes);           // From development
app.use("/api", districtRoutes);                       // Single instance
app.use('/api/species', require('./routes/Zoologist.routes')); // From development

module.exports = app;