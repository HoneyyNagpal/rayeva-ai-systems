const { z } = require("zod");

const categorySchema = z.object({
  productId: z.string().nullable(),
  productName: z.string().min(1),
  primaryCategory: z.string().min(1),
  subCategory: z.string().min(1),
  seoTags: z.array(z.string()).min(5).max(10),
  sustainabilityFilters: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  meta: z.object({
    requestId: z.string(),
    latencyMs: z.number(),
    tokensUsed: z.number().optional(),
    generatedAt: z.string(),
  }),
});

module.exports = { categorySchema };
