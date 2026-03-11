/**
 * AI Client - wraps Groq API with logging and error handling
 * All AI calls go through here so we get consistent logging and
 * can swap providers later without touching business logic
 */

const { v4: uuidv4 } = require("uuid");
const logger = require("./logger");

async function complete({ systemPrompt, userPrompt, module, context = {} }) {
  const requestId = uuidv4();
  const startTime = Date.now();

  logger.info("AI request started", { requestId, module, promptLength: userPrompt.length });

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY is not set in .env");

  const body = {
    model: "llama-3.3-70b-versatile",
    max_tokens: 4096,
    temperature: 0.3,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Groq API error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    const outputText = data.choices?.[0]?.message?.content || "";
    const latencyMs = Date.now() - startTime;

    const usage = {
      input_tokens: data.usage?.prompt_tokens || 0,
      output_tokens: data.usage?.completion_tokens || 0,
    };

    logger.info("AI request completed", {
      requestId, module, latencyMs,
      inputTokens: usage.input_tokens,
      outputTokens: usage.output_tokens,
      context,
    });

    return { requestId, output: outputText, latencyMs, usage };
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    logger.error("AI request failed", { requestId, module, latencyMs, error: err.message });
    throw new Error(`AI service error: ${err.message}`);
  }
}

/**
 * Parse AI JSON output safely - strips markdown fences if present
 */
function parseJSON(text) {
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();
  return JSON.parse(cleaned);
}

module.exports = { complete, parseJSON };