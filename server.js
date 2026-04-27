require("dotenv").config();

const express = require("express");
const cors = require("cors");
const logger = require("./utils/logger");

const authRoutes = require("./routes/authRoutes");
const orderRoutes = require("./routes/orderRoutes");
const positionRoutes = require("./routes/positionRoutes");

const app = express();
const PORT = process.env.PORT || 5001;

// Middleware
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:4200",
  "https://suralgo-frontend.vercel.app"
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (like Postman, curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    } else {
      return callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true
}));
app.use(express.json());

// Request logger — log every incoming request
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Health check
app.get("/", (req, res) => {
  res.json({
    service: "flattrade-execution",
    status: "running",
    port: PORT,
  });
});

// Routes
app.use("/auth", authRoutes);
app.use("/orders", orderRoutes);
app.use("/positions", positionRoutes);

// GET /trades shortcut (maps to position routes)
app.use("/trades", (req, res, next) => {
  req.url = "/trades";
  positionRoutes(req, res, next);
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error("Unhandled error", { message: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal server error" });
});

const http = require("http");
const server = http.createServer(app);

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    logger.error(`Port ${PORT} is already in use. Kill the other process or change PORT in .env`);
  } else {
    logger.error("Server error", { message: err.message });
  }
  process.exit(1);
});

server.listen(PORT, () => {
  logger.info(`Flattrade execution server running at http://localhost:${PORT}`);
  logger.info("Endpoints:");
  logger.info("  POST /auth/login");
  logger.info("  POST /auth/logout");
  logger.info("  GET  /auth/status");
  logger.info("  GET  /auth/funds");
  logger.info("  POST /orders/place");
  logger.info("  POST /orders/exit");
  logger.info("  POST /orders/cancel");
  logger.info("  GET  /orders/book");
  logger.info("  GET  /orders/:orderId");
  logger.info("  GET  /positions");
  logger.info("  GET  /trades");
});
