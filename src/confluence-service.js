import { createTopicMetadataForConfluence, normalizeTopicInput } from "./domain.js";

function normalizeBaseUrl(baseUrl) {
  let url = String(baseUrl || "").trim().replace(/\/+$/, "");
  if (!url) {
    return "";
  }
  if (!url.endsWith("/wiki")) {
    url += "/wiki";
  }
  return url;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function unescapeHtml(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function authHeader(config) {
  if (config.authMode === "bearer") {
    if (!config.pat) {
      throw new Error("Confluence Bearer PAT fehlt.");
    }
    return `Bearer ${config.pat}`;
  }

  if (!config.email || !config.apiToken) {
    throw new Error("Confluence Email/API Token fehlt.");
  }
  return `Basic ${btoa(`${config.email}:${config.apiToken}`)}`;
}

function buildHeaders(config) {
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    Authorization: authHeader(config)
  };
}

function buildTopicPageBody(topic) {
  const metadata = createTopicMetadataForConfluence(topic);
  const encodedMeta = escapeHtml(JSON.stringify(metadata, null, 2));

  return [
    `<h1>${escapeHtml(topic.title)}</h1>`,
    `<p>${escapeHtml(topic.summary)}</p>`,
    `<h2>Scope Notes</h2>`,
    `<p>${escapeHtml(topic.scopeNotes || "")}</p>`,
    `<h2>Registry Metadata</h2>`,
    `<pre data-km-topic-metadata="true">${encodedMeta}</pre>`
  ].join("\n");
}

function parseMetadataFromStorageHtml(storageValue) {
  const raw = String(storageValue || "");
  const match = raw.match(/<pre\s+data-km-topic-metadata=\"true\">([\s\S]*?)<\/pre>/i);
  if (!match) {
    return null;
  }

  try {
    return JSON.parse(unescapeHtml(match[1]));
  } catch {
    return null;
  }
}

async function parseJsonResponse(response) {
  const text = await response.text();
  let parsed;

  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${JSON.stringify(parsed)}`);
  }

  return parsed;
}

export class ConfluenceService {
  constructor(configAccessor) {
    this.configAccessor = configAccessor;
  }

  config() {
    const config = this.configAccessor();
    return {
      ...config,
      baseUrl: normalizeBaseUrl(config.baseUrl)
    };
  }

  assertRequired(config) {
    if (!config.baseUrl) {
      throw new Error("Confluence Base URL fehlt.");
    }
    if (!config.rootPageId) {
      throw new Error("Confluence Root Page ID fehlt.");
    }
  }

  async request(path, options = {}) {
    const config = this.config();
    this.assertRequired(config);

    const controller = new AbortController();
    const timeoutMs = Number(config.timeoutMs) || 20000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${config.baseUrl}${path}`, {
        ...options,
        headers: {
          ...buildHeaders(config),
          ...(options.headers || {})
        },
        signal: controller.signal
      });

      return await parseJsonResponse(response);
    } finally {
      clearTimeout(timeout);
    }
  }

  async testConnection() {
    const config = this.config();
    this.assertRequired(config);

    const root = await this.request(`/rest/api/content/${encodeURIComponent(config.rootPageId)}?expand=space`);

    return {
      ok: true,
      rootPageId: root.id,
      rootTitle: root.title,
      spaceKey: root.space?.key || ""
    };
  }

  async listTopicPages() {
    const config = this.config();
    this.assertRequired(config);

    const data = await this.request(
      `/rest/api/content/${encodeURIComponent(config.rootPageId)}/child/page?limit=250&expand=body.storage,version,space`
    );

    const results = Array.isArray(data.results) ? data.results : [];

    return results
      .map((page) => {
        const metadata = parseMetadataFromStorageHtml(page.body?.storage?.value || "");
        if (!metadata || !metadata.topic) {
          return null;
        }

        const topic = normalizeTopicInput({
          ...metadata.topic,
          landingPageId: page.id,
          landingPageUrl: `${config.baseUrl}/pages/${page.id}`
        });

        return {
          page,
          topic,
          metadata
        };
      })
      .filter(Boolean);
  }

  async upsertTopic(topic) {
    const config = this.config();
    this.assertRequired(config);

    const root = await this.request(`/rest/api/content/${encodeURIComponent(config.rootPageId)}?expand=space`);
    const spaceKey = root.space?.key;
    if (!spaceKey) {
      throw new Error("Space Key konnte nicht aus Root Page bestimmt werden.");
    }

    const normalizedTopic = normalizeTopicInput(topic);
    const bodyValue = buildTopicPageBody(normalizedTopic);

    if (!normalizedTopic.landingPageId) {
      const created = await this.request(`/rest/api/content`, {
        method: "POST",
        body: JSON.stringify({
          type: "page",
          title: normalizedTopic.title,
          ancestors: [{ id: String(config.rootPageId) }],
          space: { key: spaceKey },
          body: {
            storage: {
              value: bodyValue,
              representation: "storage"
            }
          }
        })
      });

      return {
        ...normalizedTopic,
        landingPageId: created.id,
        landingPageUrl: `${config.baseUrl}/pages/${created.id}`
      };
    }

    const existing = await this.request(
      `/rest/api/content/${encodeURIComponent(normalizedTopic.landingPageId)}?expand=version,space`
    );

    const nextVersion = (existing.version?.number || 1) + 1;

    await this.request(`/rest/api/content/${encodeURIComponent(normalizedTopic.landingPageId)}`, {
      method: "PUT",
      body: JSON.stringify({
        id: normalizedTopic.landingPageId,
        type: "page",
        title: normalizedTopic.title,
        space: { key: spaceKey },
        body: {
          storage: {
            value: bodyValue,
            representation: "storage"
          }
        },
        version: {
          number: nextVersion
        }
      })
    });

    return {
      ...normalizedTopic,
      landingPageUrl: `${config.baseUrl}/pages/${normalizedTopic.landingPageId}`
    };
  }
}
