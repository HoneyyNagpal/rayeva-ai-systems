const express = require("express");
const router = express.Router();
const { categorizeProduct, PRIMARY_CATEGORIES, SUSTAINABILITY_FILTERS } = require("../services/categoryService");
const logger = require("../services/logger");

// POST /api/category/classify
// Body: { name, description, materials?, brand?, price?, productId? }
router.post("/classify", async (req, res) => {
  try {
    const result = await categorizeProduct(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error("Category classification failed", { error: err.message });
    const status = err.message.includes("required") ? 400 : 500;
    res.status(status).json({ success: false, error: err.message });
  }
});

// POST /api/category/classify/batch
// Body: { products: [...] }  (max 10)
router.post("/classify/batch", async (req, res) => {
  const { products } = req.body;

  if (!Array.isArray(products) || products.length === 0) {
    return res.status(400).json({ success: false, error: "products must be a non-empty array" });
  }
  if (products.length > 10) {
    return res.status(400).json({ success: false, error: "Batch limit is 10 products" });
  }

  const results = await Promise.allSettled(products.map(categorizeProduct));

  const response = results.map((r, i) =>
    r.status === "fulfilled"
      ? { index: i, success: true, data: r.value }
      : { index: i, success: false, error: r.reason.message }
  );

  const successCount = response.filter((r) => r.success).length;
  res.json({ success: true, processed: products.length, succeeded: successCount, results: response });
});

// GET /api/category/taxonomy - return allowed values for UI dropdowns
router.get("/taxonomy", (_req, res) => {
  res.json({ primaryCategories: PRIMARY_CATEGORIES, sustainabilityFilters: SUSTAINABILITY_FILTERS });
});

module.exports = router;
