/*Now Swagger URL: http://localhost:5000/api/docs
*/ 
const express = require("express");
const cors = require("cors");

const authRoutes = require("./routes/auth.routes");
const adminRoutes = require("./routes/admin.routes");

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const swaggerUi = require("swagger-ui-express");
const swaggerSpec = require("./config/swagger");

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));


app.use(cors());
app.use(express.json());
app.use("/uploads", express.static("src/uploads"));

app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

app.use('/api/species', require('./routes/species.routes'));


module.exports = app;