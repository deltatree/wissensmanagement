export function createDefaultState() {
  return {
    version: 2,
    settings: {
      activeProvider: "local-browser",
      language: "de"
    },
    providers: {
      local: {
        chatModel: "km-local-heuristic-chat-de",
        embeddingModel: "km-local-hash-embed-de"
      },
      azure: {
        apiMode: "v1",
        endpoint: "",
        apiKey: "",
        chatModel: "gpt-5.1-mini",
        embeddingModel: "text-embedding-3-large",
        apiVersion: "2024-10-21"
      }
    },
    confluence: {
      baseUrl: "",
      rootPageId: "",
      authMode: "basic",
      email: "",
      apiToken: "",
      pat: "",
      timeoutMs: 20000
    },
    topics: [],
    searchIndex: {
      builtAt: "",
      provider: "",
      embeddingModel: "",
      chunkCount: 0,
      chunks: []
    },
    ui: {
      selectedTopicId: ""
    }
  };
}

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function mergeWithDefaults(input) {
  const defaults = createDefaultState();
  if (!input || typeof input !== "object") {
    return defaults;
  }

  return {
    ...defaults,
    ...input,
    settings: {
      ...defaults.settings,
      ...(input.settings || {})
    },
    providers: {
      local: {
        ...defaults.providers.local,
        ...(input.providers?.local || {})
      },
      azure: {
        ...defaults.providers.azure,
        ...(input.providers?.azure || {})
      }
    },
    confluence: {
      ...defaults.confluence,
      ...(input.confluence || {})
    },
    searchIndex: {
      ...defaults.searchIndex,
      ...(input.searchIndex || {})
    },
    topics: Array.isArray(input.topics) ? input.topics : [],
    ui: {
      ...defaults.ui,
      ...(input.ui || {})
    }
  };
}

export function mapLegacyPrototypeState(legacy) {
  const next = createDefaultState();

  if (!legacy || typeof legacy !== "object") {
    return next;
  }

  const cfg = legacy.config || legacy;

  if (cfg.endpoint || cfg.apiKey || cfg.deployment) {
    next.settings.activeProvider = "azure";
    next.providers.azure.endpoint = String(cfg.endpoint || "").trim();
    next.providers.azure.apiKey = String(cfg.apiKey || "").trim();
    next.providers.azure.chatModel = String(cfg.deployment || cfg.chatModel || "").trim() || next.providers.azure.chatModel;
    next.providers.azure.apiVersion = String(cfg.apiVersion || "").trim() || next.providers.azure.apiVersion;
    if (cfg.apiMode === "deployment" || cfg.apiMode === "v1") {
      next.providers.azure.apiMode = cfg.apiMode;
    }
  }

  return next;
}
