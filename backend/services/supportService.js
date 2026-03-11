/**
 * Module 4: AI WhatsApp Support Bot
 *
 * Handles order status, return policy, and escalation.
 * Database lookups happen BEFORE AI - the model sees real data,
 * not hallucinated order details.
 */

const { complete, parseJSON } = require("./aiClient");

// Mock order DB - in production this queries PostgreSQL
const MOCK_ORDERS = {
  "ORD-1001": { status: "Delivered", deliveredDate: "2025-03-08", items: 3, value: 1890 },
  "ORD-1002": { status: "In Transit", expectedDelivery: "2025-03-13", courier: "Delhivery", trackingId: "DEL-887234" },
  "ORD-1003": { status: "Processing", estimatedDispatch: "2025-03-12" },
  "ORD-1004": { status: "Cancelled", refundStatus: "Initiated", refundDate: "2025-03-15" },
};

const RETURN_POLICY = `
- Returns accepted within 7 days of delivery
- Items must be unused and in original packaging
- Damaged or defective items: full refund within 48 hours of raising a ticket
- Custom/personalized orders are non-returnable
- Refunds processed within 5-7 business days to original payment method
- Partial returns allowed on multi-item orders
`;

const SYSTEM_PROMPT = `You are Riya, a friendly support agent for Rayeva, a sustainable product marketplace.
Tone: warm, helpful, efficient. Use simple language. Avoid corporate jargon.

You have access to:
- Real order data (provided in context)
- Rayeva's return policy (provided in context)

RULES:
1. NEVER fabricate order details. Only use data provided to you.
2. For refund/escalation requests or angry customers: flag for human handoff.
3. Keep responses under 120 words.
4. Always end with a helpful follow-up offer.
5. Return ONLY valid JSON: { "reply": string, "intent": string, "requiresEscalation": boolean, "escalationReason": string | null }

Intents: order_status | return_query | refund_request | general_query | escalation`;

async function handleSupportMessage({ message, customerId, conversationHistory = [] }) {
  if (!message?.trim()) throw new Error("Message cannot be empty");

  // Extract order ID from message if present (business logic, not AI)
  const orderMatch = message.match(/ORD-\d{4}/i);
  const orderId = orderMatch ? orderMatch[0].toUpperCase() : null;
  const orderData = orderId ? MOCK_ORDERS[orderId] : null;

  // Build context string with real DB data
  const orderContext = orderData
    ? `Order ${orderId} data: ${JSON.stringify(orderData)}`
    : orderId
    ? `Order ${orderId} not found in system.`
    : "No order ID mentioned in message.";

  const userPrompt = `Customer message: "${message}"

${orderContext}

Return policy:
${RETURN_POLICY}

Previous messages in this conversation: ${conversationHistory.length > 0 ? JSON.stringify(conversationHistory.slice(-4)) : "none"}`;

  const { requestId, output, latencyMs } = await complete({
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    module: "whatsapp-support",
    context: { customerId, orderId },
  });

  let parsed;
  try {
    parsed = parseJSON(output);
  } catch {
    parsed = {
      reply: "Sorry, I ran into an issue. Let me connect you with our team right away!",
      intent: "escalation",
      requiresEscalation: true,
      escalationReason: "AI parse error",
    };
  }

  // Log conversation to persistent store (MongoDB in production)
  const logEntry = {
    customerId,
    orderId,
    message,
    intent: parsed.intent,
    reply: parsed.reply,
    requiresEscalation: parsed.requiresEscalation,
    requestId,
    latencyMs,
    timestamp: new Date().toISOString(),
  };

  // In production: await ConversationLog.create(logEntry);
  // For now we log to file
  require("./logger").info("Support conversation", logEntry);

  return {
    reply: parsed.reply,
    intent: parsed.intent,
    requiresEscalation: parsed.requiresEscalation,
    escalationReason: parsed.escalationReason || null,
    meta: { requestId, latencyMs },
  };
}

module.exports = { handleSupportMessage };
