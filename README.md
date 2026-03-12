# Rayeva AI Systems — Assignment Submission

**Role:** Full Stack / AI Intern  
**Focus:** Applied AI for Sustainable Commerce

---

## Modules Implemented (Full)

### Module 1 - AI Auto-Category & Tag Generator
Takes raw product input (name, description, materials, brand, price) and returns:
- Primary category from a fixed taxonomy (AI must pick from allowed list)
- Specific sub-category
- 5–10 SEO-optimised tags
- Applicable sustainability filters from a verified set
- Confidence score + reasoning
- Zod-validated JSON stored per request

The important design decision here: the AI cannot invent new categories or filters. It picks from a hardcoded list. This prevents hallucination from reaching the database. Output is validated against a Zod schema before being returned.

### Module 2 - AI B2B Proposal Generator
Takes a corporate client brief (budget, industry, use case, recipient count) and returns:
- Curated product mix from the catalog (by real product IDs)
- Budget allocation with platform fee and shipping
- Impact positioning with plastic/CO2 estimates
- Sales notes for the account team

Key design decision: the AI sees real catalog data. Budget arithmetic is **re-verified in business logic after AI returns**  if the total exceeds the client budget by more than 2%, the request fails rather than returning bad data.

---

## Modules Outlined (Architecture)

### Module 3 - AI Impact Reporting
Environmental impact numbers (plastic saved, CO2 avoided, local sourcing %) are calculated using **deterministic formulas** based on DEFRA emission factors not AI. AI is used only to generate a human-readable narrative from those numbers. This keeps the figures auditable.

### Module 4 — AI WhatsApp Support Bot
Order lookups happen against the real database **before** the AI call. The model is given verified order data; it cannot invent tracking numbers or delivery dates. Escalation detection is returned as a structured flag, not free text, so the escalation system is reliable.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla HTML/CSS/JS (no framework dependency for dashboard) |
| Backend | Node.js + Express |
| AI | Anthropic Claude (claude-3-5-sonnet) via SDK |
| Primary DB | PostgreSQL (product catalog, orders) |
| Log DB | MongoDB (AI prompt/response logs, conversation history) |
| Validation | Zod |
| Logging | Winston |
| Rate Limiting | express-rate-limit |

---

## Architecture Overview

```
frontend/
  index.html          Single-page dashboard for all 4 modules

backend/
  server.js           Express app, middleware, routing
  
  routes/
    category.js       POST /api/category/classify, /classify/batch, GET /taxonomy
    proposal.js       POST /api/proposal/generate
    impact.js         POST /api/impact/report
    support.js        POST /api/support/message
  
  services/
    aiClient.js       Anthropic SDK wrapper — all AI calls go through here
    categoryService.js  Module 1 business logic + prompt
    proposalService.js  Module 2 business logic + prompt
    impactService.js    Module 3 calculation (deterministic) + AI narrative
    supportService.js   Module 4 DB lookup then AI response
    logger.js          Winston logger (file + console)
  
  models/
    categorySchema.js   Zod schema for category output
    proposalSchema.js   Zod schema for proposal output
  
  logs/
    combined.log        All requests and AI calls
    error.log           Errors only
```

---

## AI Prompt Design

Every module uses a system prompt with strict constraints:

1. **Output format lock-in** - System prompt says "return ONLY valid JSON" with exact schema. The `parseJSON` utility strips markdown fences in case the model adds them.

2. **Controlled vocabularies** - Categories and sustainability filters are listed in the prompt. AI must choose from them, not invent. Business logic re-validates after parsing.

3. **Math verification** - For proposals, budget arithmetic is re-done in Node after AI responds. If the numbers don't add up, the request fails.

4. **Separation of AI and business logic** - AI handles language generation and classification judgement. Calculations (impact metrics, budget totals) stay in regular functions so they're testable and auditable.

5. **Consistent logging** - Every AI call generates a `requestId` (UUID), logs prompt length, response latency, token usage, and module name to both Winston (files) and would log to MongoDB in production.

---

## Running Locally

```bash
# 1. Backend
cd backend
cp .env.example .env
# Fill in ANTHROPIC_API_KEY and DB credentials in .env
npm install
npm run dev
# Server starts on http://localhost:4000

# 2. Frontend
# Open frontend/index.html in a browser
# (or serve with: npx serve frontend)
```

---

## Environment Variables

See `backend/.env.example` for all required variables. Key ones:

- `ANTHROPIC_API_KEY` - get from console.anthropic.com
- `PG_*` - PostgreSQL connection (host, port, database, user, password)
- `MONGO_URI` - MongoDB Atlas connection string for logging
- `PORT` - defaults to 4000

---

## API Reference

### Category
```
POST /api/category/classify
Body: { name*, description*, brand?, materials?, price?, productId? }

POST /api/category/classify/batch
Body: { products: [...] }  // max 10

GET /api/category/taxonomy
Returns allowed categories and sustainability filters
```

### Proposal
```
POST /api/proposal/generate
Body: { clientName*, industry*, budget*, recipients?, useCase?, preferences?, sustainabilityPriority? }
```

### Impact
```
POST /api/impact/report
Body: { orderId*, products*: [{ name, quantity, tags, weightGrams? }], orderValue? }
```

### Support
```
POST /api/support/message
Body: { message*, customerId*, conversationHistory?: [...] }
```

---

## Error Handling

All endpoints return:
```json
{ "success": true/false, "data": {...} / "error": "message" }
```

HTTP status codes:
- `400` — validation failure or missing required fields
- `500` — AI service error or unexpected failure
- `429` — rate limit exceeded

---

## What I'd add with more time

The biggest gap right now is the database layer- the product catalog and orders are mocked in-memory, so the next thing I'd do is write the actual PostgreSQL schema and migrations for those, then wire up the services to query real data instead of the hardcoded arrays.

For the support bot, the conversation history works within a single session but doesn't persist. I'd add a proper MongoDB `ConversationLog` collection so you can see the full history per customer and track which intents are coming up most often- that's actually useful for improving the prompts over time.

On the auth side, the API currently has no authentication at all. For anything going to production that would need JWT middleware at minimum, probably on the proposal and support endpoints first since those touch client data.

The WhatsApp integration is outlined but not wired up, connecting it to the actual Meta/Twilio webhook is mostly plumbing, the AI logic is already there. And I'd add Redis caching on the category endpoint since the same products get classified repeatedly during catalog imports and there's no reason to hit the AI each time for an identical input.
