const DEFAULT_CHAT_MODEL = "km-local-heuristic-chat-de";
const DEFAULT_EMBED_MODEL = "km-local-hash-embed-de";
const VECTOR_SIZE = 128;

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u017f]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function hashToken(token) {
  let hash = 2166136261;
  for (let i = 0; i < token.length; i += 1) {
    hash ^= token.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return hash >>> 0;
}

function normalizeVector(vector) {
  let norm = 0;
  for (let i = 0; i < vector.length; i += 1) {
    norm += vector[i] * vector[i];
  }

  if (!norm) {
    return vector;
  }

  const length = Math.sqrt(norm);
  for (let i = 0; i < vector.length; i += 1) {
    vector[i] = vector[i] / length;
  }

  return vector;
}

function buildHashEmbedding(text) {
  const vector = new Array(VECTOR_SIZE).fill(0);
  const tokens = tokenize(text);

  for (const token of tokens) {
    const hash = hashToken(token);
    const index = hash % VECTOR_SIZE;
    const sign = (hash & 1) === 0 ? 1 : -1;
    vector[index] += sign;
  }

  return normalizeVector(vector);
}

function estimateBroadness(prompt) {
  const text = String(prompt || "").toLowerCase();
  let score = 84;
  const reasons = [];
  const splitSuggestions = [];

  const conjunctions = (text.match(/\b(und|oder|sowie|inklusive|plus|sowohl)\b/g) || []).length;
  if (conjunctions >= 3) {
    score -= 18;
    reasons.push("Mehrere Themenbereiche scheinen in einem Topic kombiniert zu sein.");
  }

  const technicalAreas = ["governance", "architektur", "workflow", "reporting", "betrieb", "integration"];
  const areaCount = technicalAreas.filter((area) => text.includes(area)).length;
  if (areaCount >= 3) {
    score -= 14;
    reasons.push("Mehrere Funktionsbereiche deuten auf ein zu breites Topic hin.");
  }

  if ((text.match(/\n/g) || []).length > 35) {
    score -= 10;
    reasons.push("Die Beschreibung wirkt umfangreich fuer ein einzelnes Wissensmodul.");
  }

  score = Math.max(35, Math.min(96, score));

  let status = "good";
  if (score < 60) {
    status = "too_broad";
    splitSuggestions.push("Teile in Definition, Prozess und Betriebsaspekte als Child-Topics.");
    splitSuggestions.push("Lege ein separates Topic fuer Governance und eines fuer operative Durchfuehrung an.");
  } else if (score < 76) {
    status = "borderline";
    splitSuggestions.push("Pruefe, ob Scope Notes auf zwei Subtopics aufgeteilt werden koennen.");
  }

  if (!reasons.length) {
    reasons.push("Der Scope wirkt hinreichend fokussiert fuer ein einzelnes Topic.");
  }

  return {
    score,
    status,
    reasons,
    splitSuggestions
  };
}

function buildLocalTextResponse({ systemPrompt, userPrompt }) {
  const prompt = String(userPrompt || "");
  const wantsJson = /json/i.test(prompt) && /score/i.test(prompt) && /splitsuggestions/i.test(prompt);

  if (wantsJson) {
    return JSON.stringify(estimateBroadness(prompt));
  }

  const firstSentence = prompt.split(/\n+/).find((line) => line.trim()) || "";
  return [
    "Lokaler Browser-Provider aktiv.",
    "Antwort basiert auf heuristischer Inferenz ohne externes Modell.",
    `Kontext: ${firstSentence.slice(0, 200)}`,
    `System: ${String(systemPrompt || "").slice(0, 120)}`
  ].join("\n");
}

function getRuntimeAdapter() {
  if (typeof window === "undefined") {
    return null;
  }

  if (window.__KM_LOCAL_AI__ && typeof window.__KM_LOCAL_AI__ === "object") {
    const adapter = window.__KM_LOCAL_AI__;
    const hasGenerate = typeof adapter.generate === "function";
    const hasEmbed = typeof adapter.embed === "function";
    if (hasGenerate && hasEmbed) {
      return adapter;
    }
  }

  return null;
}

export class LocalBrowserProvider {
  constructor(config = {}) {
    this.setConfig(config);
  }

  setConfig(config = {}) {
    this.config = {
      chatModel: config.chatModel || DEFAULT_CHAT_MODEL,
      embeddingModel: config.embeddingModel || DEFAULT_EMBED_MODEL
    };
  }

  id() {
    return "local-browser";
  }

  async health() {
    return {
      ok: true,
      provider: this.id(),
      details: {
        generationModel: this.config.chatModel,
        embeddingModel: this.config.embeddingModel,
        mode: getRuntimeAdapter() ? "custom-runtime-adapter" : "built-in-heuristic"
      }
    };
  }

  async capabilities() {
    return {
      provider: this.id(),
      generation: true,
      embeddings: true,
      locality: "browser-local",
      config: {
        chatModel: this.config.chatModel,
        embeddingModel: this.config.embeddingModel
      }
    };
  }

  async generate({ systemPrompt, userPrompt, maxTokens = 300, temperature = 0.2 }) {
    const adapter = getRuntimeAdapter();
    if (adapter) {
      return adapter.generate({
        systemPrompt,
        userPrompt,
        maxTokens,
        temperature,
        config: this.config
      });
    }

    return buildLocalTextResponse({ systemPrompt, userPrompt });
  }

  async embed(texts) {
    const adapter = getRuntimeAdapter();
    if (adapter) {
      return adapter.embed(texts, { config: this.config });
    }

    return (texts || []).map((text) => buildHashEmbedding(String(text || "")));
  }
}
