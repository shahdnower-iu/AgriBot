# 🌾 AgriBot — Agricultural RAG Q&A System

A full-stack agricultural Q&A platform powered by 4 AI models with **automatic rotation**, **shared conversation context**, and a built-in **agricultural knowledge base (RAG)**.





## Architecture


Frontend (HTML/CSS/JS)
    ↓ HTTP requests
Backend (Node.js / Express)
    ↓ RAG retrieval → context injection
    ↓ Model selection (auto-rotate or manual)

## Key Features

- **4-Model Rotation** — Automatically switches when a model hits its limit
- **Shared Context** — All models receive the full conversation history
- **RAG System** — Retrieves relevant agricultural knowledge and injects it into each prompt
- **Manual Override** — Click any model in the sidebar to force-use it
- **Auto-fallback** — If a model's API fails, instantly tries the next one
- **Gemini = No Limit** — Configured as the fallback with no rate limit

---


## Setup
### 1. Install dependencies

"in a new terminal"
cd backend
npm install


### 3. Start the server

npm run dev

# follow link → http://localhost:3000
```

## The system has a built-in knowledge base covering:

| Topic | Coverage |
|-------|----------|
| 🌱 Soil | pH, organic matter, texture types |
| 💧 Irrigation | Drip, flood, water requirements by crop |
| 🍂 Crop Diseases | Fungal, bacterial, viral + treatments |
| 🧪 Fertilizers | NPK, organic vs inorganic, timing |
| 🐄 Livestock | Nutrition, health, housing, diseases |
| 🌾 Planting | Timing, spacing, intercropping |
| 🐛 Pest Control | IPM, biological, chemical methods |
| 🌍 Climate | Climate change impacts, adaptation |
| 🌾 Harvest | Maturity indicators, post-harvest storage |

When you ask a question, the system:
1. Scans your query for keywords
2. Retrieves the most relevant knowledge sections
3. Injects them into the AI prompt as context
4. The AI answers using both its training AND the retrieved context



## Model Rotation Logic

Request comes in
    ↓
Is current model over limit? → NO → Use current model
    ↓ YES
Try next model in order:
    Claude → GPT-4o → Grok → Gemini (unlimited)
    ↓
On API failure → auto-advance to next
    ↓
Response returned + full history shared with next model
```

### Context sharing between models

Every message is stored server-side in a session object:
```json
{
  "messages": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

When the model switches, the **entire message history** is passed to the new model — so conversation never resets.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/chat` | Send a message |
| GET | `/api/models` | List all models + usage |
| GET | `/api/session/:id` | Get session history |
| DELETE | `/api/session/:id` | Clear session |

### POST /api/chat

```json
{
  "message": "How do I treat powdery mildew on my tomatoes?",
  "sessionId": "agri_1234_abc",
  "forceModel": 2  // optional: 0=Claude, 1=GPT-4o, 2=Grok, 3=Gemini
}
```

Response:
```json
{
  "reply": "Powdery mildew on tomatoes...",
  "model": { "id": "claude", "name": "Claude 3.5 Sonnet", ... },
  "switched": false,
  "switchedFrom": null,
  "modelUsage": { "claude": 5, "gpt4o": 0, "grok": 0, "gemini": 0 },
  "messageCount": 6
}
```

---

## Extending the Knowledge Base

Add entries to the `KNOWLEDGE_BASE` array in `server.js`:

```javascript
{
  topic: "hydroponics",
  content: `Hydroponic systems grow plants without soil using nutrient solutions...`
}
```

The RAG retrieval will automatically include relevant sections in responses.

---
