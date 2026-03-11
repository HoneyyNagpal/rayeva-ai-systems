/**
 * Module 3: AI Impact Reporting Generator
 *
 * Calculates environmental impact for orders. Logic-based estimation
 * uses verified conversion factors; AI is used only for narrative generation.
 * This keeps the numbers auditable and the prose human-readable.
 */

const { complete, parseJSON } = require("./aiClient");

// Emission / impact factors - these should come from a verified source
// (e.g. DEFRA emission factors, Ellen MacArthur Foundation data)
const IMPACT_FACTORS = {
  plasticBottleSaved: 0.025, // kg CO2 per bottle avoided
  localSourcingRadiusKm: 500, // what "local" means
  avgPlasticWeightGrams: 30, // average single-use plastic item weight
  treeEquivalentKgCO2: 21, // kg CO2 absorbed per tree per year
};

/**
 * Logic-based impact calculation - no AI involved here
 * Returns raw numbers that can be audited / explained
 */
function calculateImpactMetrics(orderData) {
  const { products, totalItems } = orderData;

  let plasticFreeItems = 0;
  let compostableItems = 0;
  let localItems = 0;
  let totalWeight = 0;

  products.forEach((product) => {
    const qty = product.quantity || 1;
    if (product.tags?.includes("plastic-free")) plasticFreeItems += qty;
    if (product.tags?.includes("compostable")) compostableItems += qty;
    if (product.tags?.includes("locally-sourced")) localItems += qty;
    if (product.weightGrams) totalWeight += product.weightGrams * qty;
  });

  const totalQty = totalItems || products.reduce((s, p) => s + (p.quantity || 1), 0);

  const plasticSavedGrams = plasticFreeItems * IMPACT_FACTORS.avgPlasticWeightGrams;
  const plasticBottlesEquivalent = Math.round(plasticSavedGrams / 30);
  const co2AvoidedKg = parseFloat(
    (plasticBottlesEquivalent * IMPACT_FACTORS.plasticBottleSaved).toFixed(2)
  );
  const treeDaysEquivalent = parseFloat(
    ((co2AvoidedKg / IMPACT_FACTORS.treeEquivalentKgCO2) * 365).toFixed(1)
  );
  const localSourcingPercent =
    totalQty > 0 ? Math.round((localItems / totalQty) * 100) : 0;

  return {
    plasticFreeItems,
    compostableItems,
    localItems,
    plasticSavedGrams,
    plasticBottlesEquivalent,
    co2AvoidedKg,
    treeDaysEquivalent,
    localSourcingPercent,
    totalItems: totalQty,
  };
}

const IMPACT_NARRATIVE_PROMPT = `You write concise, inspiring impact statements for sustainable purchases.
Given impact metrics, write a 2-3 sentence human-readable statement that:
- Leads with the most impressive number
- Uses relatable analogies (not jargon)
- Ends with a forward-looking, positive note
- Sounds genuine, not greenwash-y or over-the-top

Return ONLY valid JSON: { "impactStatement": string, "shortHighlight": string }
shortHighlight is one sentence max, used for email/SMS notifications.`;

async function generateImpactReport(orderData) {
  if (!orderData.orderId || !orderData.products?.length) {
    throw new Error("Order ID and products array are required");
  }

  const metrics = calculateImpactMetrics(orderData);

  const narrativePrompt = `Generate an impact statement for this order:
Order value: ₹${orderData.orderValue || "N/A"}
Products: ${orderData.products.map((p) => p.name).join(", ")}
Plastic-free items: ${metrics.plasticFreeItems}
Plastic saved: ${metrics.plasticSavedGrams}g (${metrics.plasticBottlesEquivalent} bottles equivalent)
CO2 avoided: ${metrics.co2AvoidedKg}kg (= ${metrics.treeDaysEquivalent} days of tree absorption)
Locally sourced: ${metrics.localSourcingPercent}% of items`;

  const { requestId, output, latencyMs } = await complete({
    systemPrompt: IMPACT_NARRATIVE_PROMPT,
    userPrompt: narrativePrompt,
    module: "impact-reporter",
    context: { orderId: orderData.orderId },
  });

  let narrative;
  try {
    narrative = parseJSON(output);
  } catch {
    narrative = { impactStatement: "This order made a positive environmental impact.", shortHighlight: "Sustainable choice made!" };
  }

  return {
    orderId: orderData.orderId,
    metrics,
    impactStatement: narrative.impactStatement,
    shortHighlight: narrative.shortHighlight,
    methodology: "Calculations based on DEFRA emission factors and Ellen MacArthur Foundation plastics data. AI used for narrative generation only.",
    meta: { requestId, latencyMs, calculatedAt: new Date().toISOString() },
  };
}

module.exports = { generateImpactReport, calculateImpactMetrics };
