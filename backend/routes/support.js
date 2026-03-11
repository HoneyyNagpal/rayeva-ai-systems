const express = require("express");
const router = express.Router();
const { handleSupportMessage } = require("../services/supportService");
const logger = require("../services/logger");

// POST /api/support/message
// Body: { message, customerId, conversationHistory? }
router.post("/message", async (req, res) => {
  try {
    const { message, customerId, conversationHistory } = req.body;
    if (!customerId) return res.status(400).json({ success: false, error: "customerId is required" });

    const result = await handleSupportMessage({ message, customerId, conversationHistory });
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error("Support message handling failed", { error: err.message });
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
