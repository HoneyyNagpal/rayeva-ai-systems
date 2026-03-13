require("dotenv").config();
const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const logger = require("./services/logger");

const categoryRoutes = require("./routes/category");
const proposalRoutes = require("./routes/proposal");
const impactRoutes = require("./routes/impact");
const supportRoutes = require("./routes/support");

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: { error: "Too many requests, please try again later." },
});
app.use("/api/", limiter);

// Request logging middleware
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`, { body: req.body, ip: req.ip });
  next();
});

// Routes
app.use("/api/category", categoryRoutes);
app.use("/api/proposal", proposalRoutes);
app.use("/api/impact", impactRoutes);
app.use("/api/support", supportRoutes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString(), env: process.env.NODE_ENV });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler
app.use((err, _req, res, _next) => {
  logger.error("Unhandled error", { error: err.message, stack: err.stack });
  res.status(500).json({ error: "Internal server error", message: err.message });
});

app.listen(PORT, () => {
  logger.info(`Rayeva backend running on port ${PORT}`);
});

module.exports = app;
