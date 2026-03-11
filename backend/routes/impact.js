const express = require("express");
const router = express.Router();
const { generateImpactReport } = require("../services/impactService");
const logger = require("../services/logger");

// POST /api/impact/report
// Body: { orderId, products: [...], orderValue? }
router.post("/report", async (req, res) => {
  try {
    const result = await generateImpactReport(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error("Impact report generation failed", { error: err.message });
    const status = err.message.includes("required") ? 400 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

module.exports = router;
