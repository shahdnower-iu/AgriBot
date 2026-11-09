"use strict";
const path      = require("path");
// Load .env from backend/ first, then fall back to the project root (one level up)
try {
  const dotenv = require("dotenv");
  dotenv.config({ path: path.join(__dirname, ".env") });
  dotenv.config({ path: path.join(__dirname, "../.env") });
} catch (_) { console.error("❌ dotenv is not installed — run: npm install"); }
const express   = require("express");
const cors      = require("cors");
const nodeFetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" })); // allow base64 images

// ─── Fetch with timeout ───────────────────────────────────────────────────────
async function fetchWithTimeout(url, options, ms = 30000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    return await nodeFetch(url, { ...options, signal: ctrl.signal });
  } finally {
    clearTimeout(t);
  }
}

// ─── API KEYS ─────────────────────────────────────────────────────────────────
const API_KEYS = {
  openrouter: process.env.OPENROUTER_API_KEY,
  mistral:    process.env.MISTRAL_API_KEY,
  gemini:     process.env.GEMINI_API_KEY,
};
for (const [k, v] of Object.entries(API_KEYS)) {
  if (!v) console.warn(`⚠️  ${k.toUpperCase()}_API_KEY is not set (models using it will be skipped)`);
}

// ─── MODEL DEFINITIONS ────────────────────────────────────────────────────────

const MODELS = [
{
  id: "gemini_flash",
  name: "Gemini 3.1 Flash Lite (Free)",
  geminiModel: process.env.GEMINI_3_MODEL || "gemini-3.1-flash-lite-preview",
  provider: "Google",
  color: "#34A853",
  icon: "💎",
  supportsImages: true,
  used: 0, limit: 999999, unlimited: true,
},
  {
    id: "cohere_north",
    name: "Cohere North Mini Code (Free)",
    modelId: "cohere/north-mini-code:free",
    provider: "OpenRouter",
    color: "#7B5CFF",
    icon: "🧠",
    maxTokens: 4096,        // reasoning model
    used: 0, limit: 999999, unlimited: true,
  },
  {
    id: "gemini",
    name: "Gemini 2.5 Flash Lite",
    geminiModel: "gemini-2.5-flash-lite",
    provider: "Google",
    color: "#4285f4",
    icon: "🍃",
    supportsImages: true,
    used: 0, limit: 999999, unlimited: true,
  },
];


// ─── AGRICULTURAL KNOWLEDGE BASE ─────────────────────────────────────────────
const KNOWLEDGE_BASE = [
  {
    topic: "soil",
    keywords: ["soil","ph","loam","clay","sandy","organic matter","compost","tillage","earthworm","تربة","تربه","خصوبة"],
    content: `Soil health is fundamental to agriculture. Key indicators include pH (ideal 6.0–7.0 for most crops),
organic matter (>3% is excellent), nitrogen, phosphorus, potassium (NPK) levels. Soil testing every 2–3 years.
Composting, cover crops, and reduced tillage improve soil health. Sandy soils drain quickly but retain fewer nutrients;
clay soils hold moisture but can compact. Loam (balanced mix) is ideal for most crops.`,
  },
  {
    topic: "irrigation",
    keywords: ["water","irrigation","drip","flood","moisture","drought","sprinkler","rainfall","watering","ري","مياه","جفاف","سقي"],
    content: `Water management is critical. Drip irrigation is 90% efficient vs flood irrigation at 60%.
Crops need different water amounts: wheat 450–650 mm/season, maize 500–800 mm, rice 1000–2000 mm.
Signs of overwatering: yellowing leaves, root rot, fungal growth. Signs of underwatering: wilting,
dry/cracked soil, leaf curl. Soil moisture sensors help optimize irrigation timing.`,
  },
  {
    topic: "crop diseases",
    keywords: ["disease","fungal","bacterial","viral","blight","mildew","rust","rot","infection","spot","wilt","مرض","فطري","بكتيريا","عفن","لفحة"],
    content: `Common crop diseases: Fungal (powdery mildew, rust, blight) — use fungicides, improve airflow,
crop rotation. Bacterial (bacterial wilt, fire blight) — copper-based treatments, remove infected plants.
Viral (mosaic virus, yellowing) — control insect vectors, remove infected plants, no cure.
Prevention: crop rotation every 3–4 years, resistant varieties, proper spacing, avoid overwatering.`,
  },
  {
    topic: "fertilizers",
    keywords: ["fertilizer","npk","nitrogen","phosphorus","potassium","nutrient","urea","dap","manure","compost","foliar","سماد","أسمدة","نيتروجين","بوتاسيوم"],
    content: `Fertilizer types: Organic (manure, compost, bone meal) — slow release, improves soil structure.
Inorganic (urea, DAP, MOP) — fast acting, precise nutrient delivery. NPK ratios: N for leaf growth,
P for roots/flowers, K for overall health. Over-fertilization causes nutrient burn. Timing matters:
base dressing before planting, top dressing during growth.`,
  },
  {
    topic: "livestock",
    keywords: ["livestock","cattle","poultry","chicken","cow","pig","sheep","goat","animal","feed","grazing","ماشية","دواجن","أبقار","أغنام","تغذية"],
    content: `Livestock management covers cattle, poultry, swine, sheep, goats. Key areas: nutrition (balanced
feed with energy, protein, vitamins/minerals), health (vaccination schedules, deworming, veterinary care),
housing (ventilation, space per animal, biosecurity). Common diseases: FMD in cattle, Newcastle in poultry.
Pasture management: rotational grazing prevents overgrazing.`,
  },
  {
    topic: "planting",
    keywords: ["plant","seed","sow","transplant","germination","spacing","depth","seedling","intercrop","rotation","زراعة","بذور","شتل","إنبات"],
    content: `Successful planting requires: right timing (frost dates, monsoon onset), correct spacing, proper depth
(plant 2–3× seed diameter deep), quality certified seeds. Transplanting shock reduced by watering before/after,
transplanting in evening or cloudy days. Intercropping benefits: maize + legumes fixes nitrogen.
Season planning: cool season (lettuce, spinach) for spring/fall; warm season (tomatoes, peppers) for summer.`,
  },
  {
    topic: "pest control",
    keywords: ["pest","insect","aphid","mite","whitefly","locust","caterpillar","worm","pesticide","neem","ipm","آفات","حشرات","مبيدات","نيم"],
    content: `Pest management: Cultural (crop rotation, resistant varieties, proper spacing),
Biological (ladybugs for aphids, Bacillus thuringiensis for caterpillars),
Chemical (pesticides as last resort, rotate active ingredients). Scout weekly for early detection.
Pheromone traps monitor populations. Neem oil is an effective organic option. Only treat when pest
population exceeds economic damage threshold.`,
  },
  {
    topic: "climate",
    keywords: ["climate","weather","temperature","rain","drought","flood","carbon","heat","frost","adaptation","مناخ","طقس","جفاف","فيضان"],
    content: `Climate change impacts: rising temperatures (heat stress during flowering), irregular rainfall,
new pest/disease ranges. Adaptation: drought-tolerant varieties, precision irrigation, shade netting,
mulching. Carbon farming: cover crops, reduced tillage, agroforestry. El Niño/La Niña patterns affect
regional rainfall significantly. Growing degree days (GDD) predict crop development.`,
  },
  {
    topic: "harvest",
    keywords: ["harvest","yield","mature","storage","post-harvest","grain","brix","moisture","cold chain","حصاد","غلة","تخزين","نضج"],
    content: `Harvest timing: color change, brix (sugar) levels for fruits, moisture content for grains
(wheat at 13–15% for storage). Post-harvest losses reach 40% in developing countries — proper storage is crucial.
Cold chain: most fruits/vegetables store best at 0–10°C. Grain storage: keep dry (<13% moisture), cool, pest-free.
Curing: sweet potatoes, onions, garlic benefit from curing before storage.`,
  },
];

// ─── SESSION STORE ────────────────────────────────────────────────────────────
const sessions = {};
function getOrCreateSession(id) {
  if (!sessions[id]) {
    sessions[id] = {
      messages: [],
      currentModelIndex: 0,
      modelUsage: {},
    };
  }
  return sessions[id];
}

// ─── RAG RETRIEVAL ────────────────────────────────────────────────────────────
function retrieveContext(query) {
  const q = query.toLowerCase();
  const scored = KNOWLEDGE_BASE.map((kb) => {
    let score = 0;
    if (q.includes(kb.topic)) score += 10;
    for (const kw of kb.keywords) if (q.includes(kw)) score += 3;
    return { ...kb, score };
  }).filter(kb => kb.score > 0).sort((a, b) => b.score - a.score).slice(0, 3);

  if (!scored.length) return KNOWLEDGE_BASE.slice(0, 2).map(k => k.content).join("\n\n");
  return scored.map(k => `[${k.topic.toUpperCase()}]\n${k.content}`).join("\n\n");
}

// ─── LANGUAGE DETECTION ───────────────────────────────────────────────────────
function detectLanguage(text) {
  const arabicChars = (text.match(/[\u0600-\u06FF]/g) || []).length;
  return arabicChars > 2 ? "arabic" : "english";
}

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
function buildSystemPrompt(ragContext, lang) {
  const langInstruction = lang === "arabic"
    ? `IMPORTANT: The user wrote in Arabic. You MUST respond ENTIRELY in Arabic (Modern Standard Arabic). 
Do not mix languages. Write all advice, numbers, and explanations in Arabic.`
    : `Respond in clear English.`;

  return `You are AgriBot, an expert agricultural advisor specializing in farming, crop management,
soil science, irrigation, pest control, livestock, and sustainable agriculture.

${langInstruction}

RETRIEVED AGRICULTURAL KNOWLEDGE (use this to ground your answer):
${ragContext}

RESPONSE LENGTH & FORMAT RULES (strictly follow these):
- Write a COMPLETE answer — never cut off mid-sentence or mid-section
- Length: 150–350 words. Enough to be useful, short enough to be readable
- Structure your answer with 2–4 clearly labeled sections using short headers
- Use bullet points only for lists of 3+ items
- Include at least one specific number/measurement relevant to the question
- End with ONE practical next-step the farmer can act on today
- If the question needs more context (crop type, location, scale), ask ONE clarifying question at the end
- Never start your response with "I" or "Sure" or "Of course"
- Do NOT pad or repeat yourself — every sentence must add new information`;
}

// ─── MODEL CALLERS ────────────────────────────────────────────────────────────

async function callOpenRouter(messages, systemPrompt, model, imageBase64 = null, imageMimeType = null) {
  if (!API_KEYS.openrouter) throw new Error("OPENROUTER_API_KEY is not set.");

  let chat = messages.map(m => ({ role: m.role, content: m.content }));

  // Attach image (OpenAI-style content array) only for models that support it
  if (imageBase64 && model.supportsImages) {
    const last = chat[chat.length - 1];
    if (last && last.role === "user") {
      last.content = [
        { type: "text", text: last.content },
        { type: "image_url", image_url: { url: `data:${imageMimeType || "image/jpeg"};base64,${imageBase64}` } },
      ];
    }
  }

  // Some models/providers reject the "system" role — fold it into the first user turn
  let payloadMessages;
  if (model.mergeSystem) {
    if (chat[0] && chat[0].role === "user") {
      const first = chat[0];
      first.content = typeof first.content === "string"
        ? `${systemPrompt}\n\n---\n\n${first.content}`
        : [{ type: "text", text: systemPrompt }, ...first.content];
    } else {
      chat.unshift({ role: "user", content: systemPrompt });
    }
    payloadMessages = chat;
  } else {
    payloadMessages = [{ role: "system", content: systemPrompt }, ...chat];
  }

  const body = JSON.stringify({
    model: model.modelId,
    messages: payloadMessages,
    max_tokens: model.maxTokens || 2048,
    temperature: 0.65,
  });

  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    const response = await fetchWithTimeout(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${API_KEYS.openrouter}`,
          "HTTP-Referer": "http://localhost:3000",
          "X-Title": "AgriBot Student Project",
          "Content-Type": "application/json",
        },
        body,
      },
      60000
    );

    // Free models are rate-limited / briefly overloaded: retry once, then fall back
    if ([429, 502, 503].includes(response.status) && attempt < 2) {
      await new Promise(r => setTimeout(r, 2500));
      continue;
    }
    if (!response.ok) {
      throw new Error(`OpenRouter(${model.modelId}) ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }

    const data = await response.json();
    // OpenRouter can return HTTP 200 with an error object inside
    if (data.error) {
      lastErr = new Error(`OpenRouter(${model.modelId}): ${data.error.message || JSON.stringify(data.error)}`);
      if (attempt < 2) { await new Promise(r => setTimeout(r, 2500)); continue; }
      throw lastErr;
    }

    const choice = data.choices && data.choices[0];
    let text = (choice && choice.message && choice.message.content) || "";
    // Strip chain-of-thought some reasoning models leak into the content
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<think>[\s\S]*$/i, "").trim();

    // Reasoning can eat the whole token budget and leave an empty answer → trigger fallback
    if (!text) throw new Error(`OpenRouter(${model.modelId}) returned empty content (finish_reason: ${choice && choice.finish_reason})`);
    return text;
  }
  throw lastErr || new Error(`OpenRouter(${model.modelId}) failed`);
}

async function callMistral(messages, systemPrompt) {
  const res = await fetchWithTimeout("https://api.mistral.ai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${API_KEYS.mistral}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "mistral-large-latest",
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      max_tokens: 2048,
      temperature: 0.65,
    }),
  }, 45000);
  if (!res.ok) throw new Error(`Mistral ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).choices[0].message.content;
}

async function callGemini(messages, systemPrompt, model, imageBase64 = null, imageMimeType = null) {
  // Build contents — support optional image in the last user message
  const contents = messages.map((m, idx) => {
    const isLast = idx === messages.length - 1;
    const parts = [];
    if (isLast && imageBase64 && m.role === "user") {
      parts.push({ inline_data: { mime_type: imageMimeType || "image/jpeg", data: imageBase64 } });
    }
    parts.push({ text: m.content });
    return { role: m.role === "assistant" ? "model" : "user", parts };
  });

  for (let attempt = 1; attempt <= 3; attempt++) {
    const res = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${model.geminiModel}:generateContent?key=${API_KEYS.gemini}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: {
            maxOutputTokens: 2048,
            temperature: 0.65,
          },
        }),
      },
      30000
    );

    if ([429, 503].includes(res.status) && attempt < 3) {
      await new Promise(r => setTimeout(r, 3000)); continue;
    }
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const text = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("").trim();
    if (!text) throw new Error(`Gemini(${model.geminiModel}) returned empty content`);
    return text;
  }
  throw new Error("Gemini failed after 3 attempts");
}

// ─── DISPATCHER ───────────────────────────────────────────────────────────────
async function tryModel(model, messages, systemPrompt, imageBase64 = null, imageMimeType = null) {
  if (model.provider === "OpenRouter") {
    return callOpenRouter(messages, systemPrompt, model, imageBase64, imageMimeType);
  }
  if (model.provider === "Google") {
    return callGemini(messages, systemPrompt, model, imageBase64, imageMimeType);
  }
  if (model.id === "mistral") return callMistral(messages, systemPrompt);
  throw new Error("Unknown model: " + model.id);
}

function selectModel(session) {
  const m = MODELS[session.currentModelIndex];
  if (!m.unlimited && m.used >= m.limit) {
    session.currentModelIndex = (session.currentModelIndex + 1) % MODELS.length;
    return MODELS[session.currentModelIndex];
  }
  return m;
}

// ─── CHAT ENDPOINT ────────────────────────────────────────────────────────────
app.post("/api/chat", async (req, res) => {
  const { message, sessionId, forceModel, imageBase64, imageMimeType } = req.body;
  if (!message || !sessionId) return res.status(400).json({ error: "message and sessionId required" });

  const session = getOrCreateSession(sessionId);
  const lang = detectLanguage(message);

  // If image was sent, add a note so all models know (non-Gemini models ignore the image)
  const userContent = imageBase64
    ? `${message}\n[User also attached a crop/farm image for analysis]`
    : message;

  session.messages.push({ role: "user", content: userContent });

  const ragContext = retrieveContext(message);
  const systemPrompt = buildSystemPrompt(ragContext, lang);

  let startIdx = session.currentModelIndex;
  if (forceModel !== undefined && forceModel >= 0 && forceModel < MODELS.length) {
    startIdx = forceModel;
    session.currentModelIndex = forceModel;
  } else {
    selectModel(session);
    startIdx = session.currentModelIndex;
  }

  let reply = "", switched = false, attemptedName = MODELS[startIdx].name, finalModel = MODELS[startIdx];
  const tried = [];

  for (let i = 0; i < MODELS.length; i++) {
    const idx = (startIdx + i) % MODELS.length;
    const candidate = MODELS[idx];
    if (tried.includes(candidate.id)) continue;
    // Skip models that failed recently (dead/removed free models) so every request isn't slow
    if (candidate.cooldownUntil && candidate.cooldownUntil > Date.now() && i < MODELS.length - 1) continue;
    tried.push(candidate.id);

    try {
      console.log(`🌱 Trying ${candidate.name}…`);
      // Only image-capable models (Dots3, Gemini) get the image — others just get the text
      const img = candidate.supportsImages ? imageBase64 : null;
      const mime = candidate.supportsImages ? imageMimeType : null;
      reply = await tryModel(candidate, session.messages, systemPrompt, img, mime);
      if (i > 0) { switched = true; session.currentModelIndex = idx; finalModel = candidate; }
      finalModel.used++;
      finalModel.cooldownUntil = 0;
      session.modelUsage[finalModel.id] = (session.modelUsage[finalModel.id] || 0) + 1;
      console.log(`✅ ${candidate.name} responded`);
      break;
    } catch (err) {
      console.error(`❌ ${candidate.name}: ${err.message}`);
      candidate.cooldownUntil = Date.now() + 5 * 60 * 1000; // retry this model in 5 minutes
    }
  }

  if (!reply) {
    session.messages.pop();
    return res.status(503).json({ error: "All models unavailable. Check API keys." });
  }

  session.messages.push({ role: "assistant", content: reply });
  if (session.messages.length > 30) session.messages = session.messages.slice(-30);

  res.json({
    reply, model: finalModel, switched,
    switchedFrom: switched ? attemptedName : null,
    messageCount: session.messages.length,
    modelUsage: session.modelUsage,
    lang,
  });
});

// ─── OTHER ROUTES ─────────────────────────────────────────────────────────────
app.get("/api/models", (_req, res) => res.json(MODELS));

app.get("/api/session/:id", (req, res) => {
  const s = sessions[req.params.id];
  if (!s) return res.json({ messages: [], modelUsage: {} });
  res.json({ messages: s.messages, modelUsage: s.modelUsage, currentModel: MODELS[s.currentModelIndex] });
});

app.delete("/api/session/:id", (req, res) => {
  delete sessions[req.params.id];
  res.json({ success: true });
});

app.use(express.static(path.join(__dirname, "../frontend")));
app.get("*", (_req, res) => res.sendFile(path.join(__dirname, "../frontend/index.html")));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🌱 AgriBot RAG System → http://localhost:${PORT}`);
 console.log(`📚 RAG: ${KNOWLEDGE_BASE.length} topics  |  🌐 Arabic auto-detect: ON  |  🖼️ Image input: ON\n`);
});

