const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");
const reportRoutes = require("./routes/report.routes");

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

const app = express();

/* ------------------ MIDDLEWARE ------------------ */

// ✅ Proper CORS (important for frontend)
app.use(
  cors({
    origin: "http://localhost:3000", // change if frontend uses different port
    credentials: true,
  })
);

// Parse JSON
app.use(express.json());

// Serve uploaded files properly
app.use("/uploads", express.static("src/uploads"));

/* ------------------ SWAGGER ------------------ */
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/* ------------------ ROUTES ------------------ */
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reports", reportRoutes);

module.exports = app;
