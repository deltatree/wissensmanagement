function normalizeEndpoint(endpoint) {
  return String(endpoint || "").trim().replace(/\/+$/, "");
}

function extractAssistantText(responseJson) {
  if (responseJson && responseJson.choices && responseJson.choices[0] && responseJson.choices[0].message) {
    const content = responseJson.choices[0].message.content;
    if (typeof content === "string") {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (typeof part === "string") {
            return part;
          }
          if (part && typeof part.text === "string") {
            return part.text;
          }
          return "";
        })
        .join("\n")
        .trim();
    }
  }

  if (typeof responseJson.output_text === "string") {
    return responseJson.output_text;
  }

  return JSON.stringify(responseJson);
}

async function parseResponse(response) {
  if (response.ok) {
    return response.json();
  }

  const raw = await response.text();
  throw new Error(`HTTP ${response.status}: ${raw}`);
}

export class AzureProvider {
  constructor(config = {}) {
    this.setConfig(config);
  }

  setConfig(config = {}) {
    this.config = {
      apiMode: config.apiMode || "v1",
      endpoint: config.endpoint || "",
      apiKey: config.apiKey || "",
      chatModel: config.chatModel || "",
      embeddingModel: config.embeddingModel || "",
      apiVersion: config.apiVersion || "2024-10-21"
    };
  }

  id() {
    return "azure";
  }

  requireConfig() {
    if (!this.config.endpoint) {
      throw new Error("Azure endpoint fehlt.");
    }
    if (!this.config.apiKey) {
      throw new Error("Azure API Key fehlt.");
    }
  }

  headers() {
    return {
      "Content-Type": "application/json",
      "api-key": this.config.apiKey
    };
  }

  chatUrl() {
    const endpoint = normalizeEndpoint(this.config.endpoint);
    if (this.config.apiMode === "v1") {
      return `${endpoint}/openai/v1/chat/completions`;
    }

    return `${endpoint}/openai/deployments/${encodeURIComponent(
      this.config.chatModel
    )}/chat/completions?api-version=${encodeURIComponent(this.config.apiVersion)}`;
  }

  embeddingUrl() {
    const endpoint = normalizeEndpoint(this.config.endpoint);
    if (this.config.apiMode === "v1") {
      return `${endpoint}/openai/v1/embeddings`;
    }

    return `${endpoint}/openai/deployments/${encodeURIComponent(
      this.config.embeddingModel
    )}/embeddings?api-version=${encodeURIComponent(this.config.apiVersion)}`;
  }

  chatPayload({ systemPrompt, userPrompt, maxTokens, temperature }, tokenField) {
    const payload = {
      messages: [
        {
          role: "system",
          content: systemPrompt || "Du bist ein praeziser Assistent fuer Wissensmanagement."
        },
        {
          role: "user",
          content: userPrompt || ""
        }
      ],
      temperature: Number.isFinite(temperature) ? temperature : 0.2
    };

    payload[tokenField] = Number.isFinite(maxTokens) ? maxTokens : 300;

    if (this.config.apiMode === "v1") {
      payload.model = this.config.chatModel;
    }

    return payload;
  }

  async health() {
    try {
      this.requireConfig();
      if (!this.config.chatModel || !this.config.embeddingModel) {
        return {
          ok: false,
          provider: this.id(),
          details: { message: "Chat- oder Embedding-Modell fehlt." }
        };
      }

      await this.embed(["health check"]);

      return {
        ok: true,
        provider: this.id(),
        details: {
          endpoint: this.config.endpoint,
          apiMode: this.config.apiMode,
          chatModel: this.config.chatModel,
          embeddingModel: this.config.embeddingModel
        }
      };
    } catch (error) {
      return {
        ok: false,
        provider: this.id(),
        details: {
          message: error.message
        }
      };
    }
  }

  async capabilities() {
    return {
      provider: this.id(),
      generation: true,
      embeddings: true,
      locality: "remote-azure",
      config: {
        apiMode: this.config.apiMode,
        chatModel: this.config.chatModel,
        embeddingModel: this.config.embeddingModel
      }
    };
  }

  async generate({ systemPrompt, userPrompt, maxTokens = 300, temperature = 0.2 }) {
    this.requireConfig();
    if (!this.config.chatModel) {
      throw new Error("Azure Chat Model/Deployment fehlt.");
    }

    const url = this.chatUrl();
    const tokenFields = ["max_completion_tokens", "max_tokens"];
    let lastError;

    for (const tokenField of tokenFields) {
      try {
        const payload = this.chatPayload({ systemPrompt, userPrompt, maxTokens, temperature }, tokenField);
        const response = await fetch(url, {
          method: "POST",
          headers: this.headers(),
          body: JSON.stringify(payload)
        });

        const json = await parseResponse(response);
        return extractAssistantText(json);
      } catch (error) {
        lastError = error;
        const message = String(error.message || "").toLowerCase();
        const unsupported = message.includes("not supported") || message.includes("unsupported");
        if (!unsupported) {
          throw error;
        }
      }
    }

    throw lastError || new Error("Azure Chat Anfrage fehlgeschlagen.");
  }

  async embed(texts) {
    this.requireConfig();
    if (!this.config.embeddingModel) {
      throw new Error("Azure Embedding Model/Deployment fehlt.");
    }

    const payload = {
      input: texts
    };

    if (this.config.apiMode === "v1") {
      payload.model = this.config.embeddingModel;
    }

    const response = await fetch(this.embeddingUrl(), {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(payload)
    });

    const json = await parseResponse(response);

    if (!Array.isArray(json.data)) {
      throw new Error("Azure Embedding Antwort enthaelt kein data[] Feld.");
    }

    return json.data.map((row) => row.embedding || []);
  }
}
