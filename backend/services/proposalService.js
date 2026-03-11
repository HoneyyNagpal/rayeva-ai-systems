/**
 * Module 2: AI B2B Proposal Generator
 *
 * Takes a client brief (industry, budget, quantity, preferences) and
 * produces a curated sustainable product mix with cost breakdown and
 * impact positioning - all grounded in real product catalog data.
 */

const { complete, parseJSON } = require("./aiClient");
const { proposalSchema } = require("../models/proposalSchema");

// In production this would query the actual product database.
// Using a sample catalog here so the module works end-to-end.
const SAMPLE_CATALOG = [
  { id: "P001", name: "Bamboo Notebook Set (3-pack)", category: "Office & Stationery", unitPrice: 450, moq: 50, tags: ["recycled-materials", "plastic-free"], impactScore: 8 },
  { id: "P002", name: "Organic Cotton Tote Bag", category: "Clothing & Accessories", unitPrice: 280, moq: 100, tags: ["organic-certified", "fair-trade", "plastic-free"], impactScore: 9 },
  { id: "P003", name: "Stainless Steel Water Bottle 750ml", category: "Kitchen & Dining", unitPrice: 650, moq: 25, tags: ["plastic-free", "zero-waste", "refillable"], impactScore: 9 },
  { id: "P004", name: "Seed Paper Pen Set", category: "Office & Stationery", unitPrice: 180, moq: 200, tags: ["compostable", "zero-waste", "plastic-free"], impactScore: 7 },
  { id: "P005", name: "Beeswax Food Wraps (4-pack)", category: "Kitchen & Dining", unitPrice: 390, moq: 50, tags: ["plastic-free", "compostable", "organic-certified"], impactScore: 8 },
  { id: "P006", name: "Recycled Paper Desk Organizer", category: "Office & Stationery", unitPrice: 520, moq: 30, tags: ["recycled-materials", "plastic-free"], impactScore: 6 },
  { id: "P007", name: "Coconut Shell Candle", category: "Home & Living", unitPrice: 320, moq: 50, tags: ["locally-sourced", "plastic-free", "vegan"], impactScore: 7 },
  { id: "P008", name: "Jute Shopping Bag (with logo)", category: "Clothing & Accessories", unitPrice: 160, moq: 200, tags: ["biodegradable", "fair-trade", "locally-sourced"], impactScore: 8 },
  { id: "P009", name: "Bamboo Toothbrush Set (4-pack)", category: "Personal Care & Beauty", unitPrice: 220, moq: 100, tags: ["compostable", "plastic-free", "vegan"], impactScore: 9 },
  { id: "P010", name: "Soy Wax Desk Candle", category: "Home & Living", unitPrice: 380, moq: 50, tags: ["vegan", "zero-waste", "plastic-free"], impactScore: 7 },
];

const SYSTEM_PROMPT = `You are a B2B sustainability procurement advisor for Rayeva.
Your role is to create tailored product proposals for corporate clients.

CRITICAL: Your response must be a single raw JSON object. Do not include any text before or after the JSON. Do not use markdown code blocks. Do not write \`\`\`json. Start your response with { and end with }.

RULES:
1. Only select products from the provided catalog (use exact product IDs).
2. Total cost MUST NOT exceed the client's stated budget. Build in a 5% buffer.
3. Quantities must meet or exceed the MOQ for each product.
4. Prioritize products that match client industry and stated use case.
5. Mix practical items with aspirational/gift-worthy items.
6. The impact summary must be specific and quantified where possible.
7. YOUR ENTIRE RESPONSE IS JUST THE JSON OBJECT. Nothing else.

Output schema:
{
  "proposalTitle": string,
  "clientSummary": string,
  "productMix": [
    {
      "productId": string,
      "productName": string,
      "quantity": number,
      "unitPrice": number,
      "lineTotal": number,
      "rationale": string
    }
  ],
  "budgetBreakdown": {
    "subtotal": number,
    "platformFee": number,
    "estimatedShipping": number,
    "total": number,
    "budgetUtilization": number
  },
  "impactPositioning": {
    "plasticBottlesAvoided": number,
    "co2KgAvoided": number,
    "localSourcingPercent": number,
    "keyMessages": string[],
    "impactStatement": string
  },
  "salesNotes": string
}`;

async function generateProposal(brief) {
  // Input validation - business logic, not AI
  if (!brief.budget || brief.budget < 5000) {
    throw new Error("Minimum budget for B2B proposals is ₹5,000");
  }
  if (!brief.clientName || !brief.industry) {
    throw new Error("Client name and industry are required");
  }

  const catalogText = SAMPLE_CATALOG.map(
    (p) =>
      `ID: ${p.id} | ${p.name} | ₹${p.unitPrice}/unit | MOQ: ${p.moq} | Tags: ${p.tags.join(", ")} | Impact Score: ${p.impactScore}/10`
  ).join("\n");

  const userPrompt = `Create a B2B procurement proposal for:

Client: ${brief.clientName}
Industry: ${brief.industry}
Use Case: ${brief.useCase || "corporate gifting / employee wellness"}
Total Budget: ₹${brief.budget}
Approximate Recipients: ${brief.recipients || "not specified"}
Preferences: ${brief.preferences || "no specific preferences"}
Sustainability Priority: ${brief.sustainabilityPriority || "medium"}

Available Product Catalog:
${catalogText}

Remember: total cost must not exceed ₹${brief.budget}. Platform fee is 8% of subtotal. Shipping is flat ₹1500 for orders under ₹25000, free above.`;

  const { requestId, output, latencyMs, usage } = await complete({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    module: "proposal-generator",
    context: { clientName: brief.clientName, budget: brief.budget },
  });

  let parsed;
  try {
    parsed = parseJSON(output);
  } catch (parseErr) {
    // Log the raw output so we can see what Gemini actually returned
    const logger = require("./logger");
    logger.error("Proposal JSON parse failed - raw AI output:", { rawOutput: output, parseError: parseErr.message });
    throw new Error("AI returned malformed JSON for proposal generation");
  }

  // Recalculate lineTotals ourselves - never trust AI arithmetic
  parsed.productMix = parsed.productMix.map(item => ({
    ...item,
    lineTotal: item.unitPrice * item.quantity,
  }));

  let subtotal = parsed.productMix.reduce((sum, item) => sum + item.lineTotal, 0);
  let platformFee = Math.round(subtotal * 0.08);
  let shipping = subtotal < 25000 ? 1500 : 0;
  let total = subtotal + platformFee + shipping;

  // If AI exceeded budget, scale quantities down proportionally
  if (total > brief.budget) {
    const scaleFactor = (brief.budget * 0.88) / total;
    parsed.productMix = parsed.productMix.map(item => {
      const newQty = Math.max(1, Math.floor(item.quantity * scaleFactor));
      return { ...item, quantity: newQty, lineTotal: item.unitPrice * newQty };
    });
    subtotal = parsed.productMix.reduce((sum, item) => sum + item.lineTotal, 0);
    platformFee = Math.round(subtotal * 0.08);
    shipping = subtotal < 25000 ? 1500 : 0;
    total = subtotal + platformFee + shipping;
  }

  // Recalculate budget breakdown with verified numbers
  parsed.budgetBreakdown = {
    subtotal,
    platformFee,
    estimatedShipping: shipping,
    total,
    budgetUtilization: Math.round((total / brief.budget) * 100),
  };

  const result = {
    proposalId: `RVP-${Date.now()}`,
    clientName: brief.clientName,
    industry: brief.industry,
    requestedBudget: brief.budget,
    ...parsed,
    meta: {
      requestId,
      latencyMs,
      tokensUsed: (usage?.input_tokens || 0) + (usage?.output_tokens || 0),
      generatedAt: new Date().toISOString(),
      catalogVersion: "v1.0",
    },
  };

  const validation = proposalSchema.safeParse(result);
  if (!validation.success) {
    throw new Error(`Output validation failed: ${validation.error.message}`);
  }

  return result;
}

module.exports = { generateProposal, SAMPLE_CATALOG };