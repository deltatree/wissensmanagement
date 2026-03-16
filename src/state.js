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
      authMode: "session",
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

  const merged = {
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

  if (merged.settings.activeProvider !== "local-browser" && merged.settings.activeProvider !== "azure") {
    merged.settings.activeProvider = "local-browser";
  }

  const azure = merged.providers.azure || {};
  const hasAzureConfig = Boolean(
    String(azure.endpoint || "").trim() &&
      String(azure.chatModel || "").trim() &&
      String(azure.apiKey || "").trim()
  );

  if (!hasAzureConfig) {
    merged.settings.activeProvider = "local-browser";
  }

  if (!["session", "basic", "bearer"].includes(merged.confluence.authMode)) {
    merged.confluence.authMode = "session";
  }

  if (
    merged.confluence.authMode === "basic" &&
    !String(merged.confluence.email || "").trim() &&
    !String(merged.confluence.apiToken || "").trim()
  ) {
    merged.confluence.authMode = "session";
  }

  if (merged.confluence.authMode === "bearer" && !String(merged.confluence.pat || "").trim()) {
    merged.confluence.authMode = "session";
  }

  return merged;
}

export function mapLegacyPrototypeState(legacy) {
  const next = createDefaultState();

  if (!legacy || typeof legacy !== "object") {
    return next;
  }

  const cfg = legacy.config || legacy;

  if (cfg.endpoint || cfg.apiKey || cfg.deployment) {
    // Legacy Azure configs are migrated, but local provider stays default.
    next.settings.activeProvider = "local-browser";
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
