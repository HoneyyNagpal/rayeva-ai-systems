/**
 * Module 1: AI Auto-Category & Tag Generator
 *
 * Business logic lives here; AI client is a separate concern.
 * The prompt is carefully designed to return only valid JSON
 * with a fixed schema so downstream consumers can trust the shape.
 */

const { complete, parseJSON } = require("./aiClient");
const { categorySchema } = require("../models/categorySchema");

// Predefined category taxonomy - these come from business requirements,
// not from AI; the model must pick from this list
const PRIMARY_CATEGORIES = [
  "Kitchen & Dining",
  "Personal Care & Beauty",
  "Home & Living",
  "Office & Stationery",
  "Food & Beverages",
  "Clothing & Accessories",
  "Outdoor & Garden",
  "Baby & Kids",
  "Cleaning & Household",
  "Electronics & Gadgets",
];

const SUSTAINABILITY_FILTERS = [
  "plastic-free",
  "compostable",
  "vegan",
  "recycled-materials",
  "biodegradable",
  "organic-certified",
  "fair-trade",
  "zero-waste",
  "carbon-neutral",
  "locally-sourced",
  "cruelty-free",
  "refillable",
  "upcycled",
];

const SYSTEM_PROMPT = `You are a product classification specialist for Rayeva, a sustainable commerce platform.
Your job is to analyze product information and return structured classification data.

RULES:
1. Primary category MUST be chosen from the provided list only. Never invent new ones.
2. Sub-category should be a specific niche within the primary (2-4 words max).
3. Generate 5-10 SEO tags: mix of broad and long-tail, all lowercase, hyphen-separated.
4. Sustainability filters MUST be chosen only from the provided list. Only include filters that genuinely apply.
5. Confidence score: 0.0 to 1.0, reflecting how certain you are about the primary category.
6. Return ONLY valid JSON. No markdown. No explanation. No extra keys.

Output schema:
{
  "primaryCategory": string,
  "subCategory": string,
  "seoTags": string[],
  "sustainabilityFilters": string[],
  "confidence": number,
  "reasoning": string
}`;

async function categorizeProduct(productData) {
  // Validate required fields before hitting AI
  if (!productData.name || !productData.description) {
    throw new Error("Product name and description are required");
  }

  const userPrompt = `Classify this product:

Name: ${productData.name}
Description: ${productData.description}
${productData.materials ? `Materials: ${productData.materials}` : ""}
${productData.brand ? `Brand: ${productData.brand}` : ""}
${productData.price ? `Price: ₹${productData.price}` : ""}

Available primary categories:
${PRIMARY_CATEGORIES.map((c) => `- ${c}`).join("\n")}

Available sustainability filters:
${SUSTAINABILITY_FILTERS.map((f) => `- ${f}`).join("\n")}`;

  const { requestId, output, latencyMs, usage } = await complete({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    module: "category-generator",
    context: { productName: productData.name },
  });

  let parsed;
  try {
    parsed = parseJSON(output);
  } catch {
    throw new Error("AI returned malformed JSON for category classification");
  }

  // Validate AI output against allowed values (don't trust blindly)
  if (!PRIMARY_CATEGORIES.includes(parsed.primaryCategory)) {
    throw new Error(`AI returned invalid category: ${parsed.primaryCategory}`);
  }

  const validFilters = parsed.sustainabilityFilters.filter((f) =>
    SUSTAINABILITY_FILTERS.includes(f)
  );

  const result = {
    productId: productData.productId || null,
    productName: productData.name,
    primaryCategory: parsed.primaryCategory,
    subCategory: parsed.subCategory,
    seoTags: parsed.seoTags.slice(0, 10),
    sustainabilityFilters: validFilters,
    confidence: Math.min(1, Math.max(0, parsed.confidence)),
    reasoning: parsed.reasoning,
    meta: {
      requestId,
      latencyMs,
      tokensUsed: usage?.input_tokens + usage?.output_tokens,
      generatedAt: new Date().toISOString(),
    },
  };

  // Validate final shape
  const validation = categorySchema.safeParse(result);
  if (!validation.success) {
    throw new Error(`Output validation failed: ${validation.error.message}`);
  }

  return result;
}

module.exports = { categorizeProduct, PRIMARY_CATEGORIES, SUSTAINABILITY_FILTERS };
