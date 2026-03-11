const express = require("express");
const router = express.Router();
const { generateProposal } = require("../services/proposalService");
const logger = require("../services/logger");

// POST /api/proposal/generate
// Body: { clientName, industry, budget, useCase?, recipients?, preferences?, sustainabilityPriority? }
router.post("/generate", async (req, res) => {
  try {
    const result = await generateProposal(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error("Proposal generation failed", { error: err.message });
    const status = err.message.includes("required") || err.message.includes("Minimum") ? 400 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

module.exports = router;
