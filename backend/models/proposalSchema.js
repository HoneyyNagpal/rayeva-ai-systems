const { z } = require("zod");

const proposalSchema = z.object({
  proposalId: z.string(),
  clientName: z.string(),
  industry: z.string(),
  requestedBudget: z.number(),
  proposalTitle: z.string(),
  clientSummary: z.string(),
  productMix: z.array(
    z.object({
      productId: z.string(),
      productName: z.string(),
      quantity: z.number().int().positive(),
      unitPrice: z.number().positive(),
      lineTotal: z.number().positive(),
      rationale: z.string(),
    })
  ).min(1),
  budgetBreakdown: z.object({
    subtotal: z.number(),
    platformFee: z.number(),
    estimatedShipping: z.number(),
    total: z.number(),
    budgetUtilization: z.number(),
  }),
  impactPositioning: z.object({
    plasticBottlesAvoided: z.number(),
    co2KgAvoided: z.number(),
    localSourcingPercent: z.number(),
    keyMessages: z.array(z.string()),
    impactStatement: z.string(),
  }),
  salesNotes: z.string(),
  meta: z.object({
    requestId: z.string(),
    latencyMs: z.number(),
    generatedAt: z.string(),
  }),
});

module.exports = { proposalSchema };
