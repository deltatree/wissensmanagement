function randomTopicId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const seed = `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  const hex = simpleHash(seed).replace(/^h/, "").padStart(8, "0");
  return `${hex.slice(0, 8)}-${hex.slice(0, 4)}-4${hex.slice(4, 7)}-a${hex.slice(1, 4)}-${hex}${hex.slice(0, 4)}`;
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u017f]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function toSet(tokens) {
  return new Set(tokens);
}

function jaccard(tokensA, tokensB) {
  const a = toSet(tokensA);
  const b = toSet(tokensB);
  if (!a.size || !b.size) {
    return 0;
  }

  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) {
      intersection += 1;
    }
  }

  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function simpleHash(text) {
  const input = String(text || "");
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return `h${(hash >>> 0).toString(16)}`;
}

export function slugifyTopicTitle(title) {
  return String(title || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u00c0-\u017f]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function createEmptyTopic() {
  const now = new Date().toISOString();
  return {
    id: randomTopicId(),
    title: "",
    slug: "",
    summary: "",
    scopeNotes: "",
    parentTopicId: "",
    sourcePageId: "",
    sourceRefs: [],
    sourceTags: [],
    distinctionNotes: "",
    landingPageId: "",
    landingPageUrl: "",
    tags: [],
    quality: {
      score: 0,
      status: "unrated",
      reasons: [],
      splitSuggestions: []
    },
    createdAt: now,
    updatedAt: now
  };
}

export function parseTags(csv) {
  return String(csv || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((tag, index, arr) => arr.indexOf(tag) === index);
}

export function normalizeTopicInput(input) {
  const topic = {
    ...createEmptyTopic(),
    ...(input || {})
  };

  topic.title = String(topic.title || "").trim();
  topic.slug = slugifyTopicTitle(topic.title);
  topic.summary = String(topic.summary || "").trim();
  topic.scopeNotes = String(topic.scopeNotes || "").trim();
  topic.parentTopicId = String(topic.parentTopicId || "").trim();
  topic.sourcePageId = String(topic.sourcePageId || "").trim();
  topic.sourceTags = Array.isArray(topic.sourceTags) ? topic.sourceTags.map((x) => String(x).trim()).filter(Boolean) : [];
  topic.sourceRefs = Array.isArray(topic.sourceRefs)
    ? topic.sourceRefs
        .map((ref) => ({
          pageId: String(ref?.pageId || ref?.id || "").trim(),
          title: String(ref?.title || "").trim(),
          url: String(ref?.url || "").trim(),
          tags: Array.isArray(ref?.tags) ? ref.tags.map((tag) => String(tag).trim()).filter(Boolean) : []
        }))
        .filter((ref) => ref.pageId)
    : [];
  topic.distinctionNotes = String(topic.distinctionNotes || "").trim();
  topic.landingPageId = String(topic.landingPageId || "").trim();
  topic.landingPageUrl = String(topic.landingPageUrl || "").trim();
  topic.tags = Array.isArray(topic.tags) ? topic.tags.map((x) => String(x).trim()).filter(Boolean) : [];

  if (!topic.sourcePageId && topic.sourceRefs.length) {
    topic.sourcePageId = topic.sourceRefs[0].pageId;
  }

  if (!topic.id) {
    topic.id = randomTopicId();
  }

  const now = new Date().toISOString();
  if (!topic.createdAt) {
    topic.createdAt = now;
  }
  topic.updatedAt = now;

  return topic;
}

export function validateTopic(topic) {
  const errors = [];

  if (!topic.title || topic.title.length < 4) {
    errors.push("Titel ist zu kurz (mind. 4 Zeichen).");
  }

  if (!topic.summary || topic.summary.length < 20) {
    errors.push("Summary ist zu kurz (mind. 20 Zeichen).");
  }

  const hasSourceRefs = Array.isArray(topic.sourceRefs) && topic.sourceRefs.length > 0;
  if (!topic.sourcePageId && !hasSourceRefs) {
    errors.push("Confluence Source Page ID ist erforderlich.");
  }

  if (topic.parentTopicId && topic.parentTopicId === topic.id) {
    errors.push("Ein Topic kann nicht sein eigener Parent sein.");
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

export function detectTopicOverlaps(topic, allTopics) {
  const sourceRefTokens = (topic.sourceRefs || [])
    .map((ref) => `${ref.title} ${(ref.tags || []).join(" ")}`)
    .join(" ");
  const sourceTokens = tokenize(
    `${topic.title} ${topic.summary} ${topic.scopeNotes} ${topic.distinctionNotes || ""} ${topic.tags.join(" ")} ${sourceRefTokens}`
  );
  const overlaps = [];

  for (const candidate of allTopics || []) {
    if (!candidate || candidate.id === topic.id) {
      continue;
    }

    const candidateTokens = tokenize(
      `${candidate.title} ${candidate.summary} ${candidate.scopeNotes} ${candidate.distinctionNotes || ""} ${(candidate.tags || []).join(" ")} ${
        (candidate.sourceRefs || []).map((ref) => `${ref.title} ${(ref.tags || []).join(" ")}`).join(" ")
      }`
    );

    const lexicalScore = jaccard(sourceTokens, candidateTokens);
    if (lexicalScore >= 0.28) {
      overlaps.push({
        topicId: candidate.id,
        title: candidate.title,
        lexicalScore
      });
    }
  }

  overlaps.sort((a, b) => b.lexicalScore - a.lexicalScore);
  return overlaps;
}

export function assessGranularityHeuristic(topic, allTopics) {
  let score = 100;
  const reasons = [];
  const splitSuggestions = [];

  const title = String(topic.title || "");
  const summary = String(topic.summary || "");
  const scopeNotes = String(topic.scopeNotes || "");
  const full = `${title} ${summary} ${scopeNotes}`;

  const titleTokens = tokenize(title);
  const fullTokens = tokenize(full);

  const conjunctionMatches = full.match(/\b(und|oder|sowie|inklusive|plus|sowohl)\b/gi) || [];
  if (conjunctionMatches.length >= 3) {
    score -= 18;
    reasons.push("Mehrere Verbinder deuten auf zusammengelegte Themenbloeke hin.");
  }

  if (titleTokens.length > 8) {
    score -= 12;
    reasons.push("Der Titel ist lang und kombiniert moeglicherweise mehrere Teilthemen.");
  }

  if (summary.length > 420) {
    score -= 12;
    reasons.push("Die Summary ist sehr umfangreich und kann fuer ein einzelnes Topic zu breit sein.");
  }

  if (scopeNotes.length > 600) {
    score -= 10;
    reasons.push("Scope Notes wirken eher wie ein Kapitel als wie ein granularer Topic-Scope.");
  }

  const uniqueTokens = new Set(fullTokens).size;
  if (uniqueTokens > 80) {
    score -= 14;
    reasons.push("Viele unterschiedliche Begriffe erhoehen das Risiko eines zu breiten Topics.");
  }

  const overlaps = detectTopicOverlaps(topic, allTopics);
  if (overlaps.length > 0 && overlaps[0].lexicalScore >= 0.5) {
    score -= 18;
    reasons.push(`Hohe Ueberschneidung mit bestehendem Topic '${overlaps[0].title}'.`);
  } else if (overlaps.length > 1) {
    score -= 8;
    reasons.push("Ueberschneidung mit mehreren Topics erkannt.");
  }

  if (overlaps.length > 0 && overlaps[0].lexicalScore >= 0.8 && !(topic.distinctionNotes || "").trim()) {
    score -= 20;
    reasons.push("Sehr hohe Aehnlichkeit erkannt. Fachliche Abgrenzung oder Zusammenfuehrung erforderlich.");
    splitSuggestions.push("Ergaenze klare fachliche Unterschiede im Feld 'Abgrenzung zu aehnlichen Topics'.");
    splitSuggestions.push(`Alternativ: Zusammenfuehrung mit Topic '${overlaps[0].title}' pruefen.`);
  }

  if (score < 75) {
    const candidatePhrases = tokenize(`${title} ${summary}`).slice(0, 9);
    if (candidatePhrases.length >= 3) {
      splitSuggestions.push(
        `Teile in Unterthemen entlang der Schwerpunkte: ${candidatePhrases.slice(0, 3).join(", ")}.`
      );
    }

    splitSuggestions.push("Lege ein Basis-Topic fuer Definitionen an und verschiebe Prozesse in eigene Child-Topics.");
  }

  score = Math.max(0, Math.min(100, score));

  let status = "good";
  if (score < 60) {
    status = "too_broad";
  } else if (score < 78) {
    status = "borderline";
  }

  return {
    score,
    status,
    reasons,
    splitSuggestions,
    overlapCandidates: overlaps.slice(0, 5)
  };
}

export function buildTopicChunks(topic) {
  const chunks = [];
  const baseMeta = {
    topicId: topic.id,
    landingPageId: topic.landingPageId || "",
    sourcePageId: topic.sourcePageId || ""
  };

  function pushChunk(kind, text) {
    const clean = String(text || "").trim();
    if (!clean) {
      return;
    }

    chunks.push({
      chunkId: `${topic.id}-${kind}-${simpleHash(clean)}`,
      ...baseMeta,
      kind,
      text: clean,
      hash: simpleHash(clean)
    });
  }

  pushChunk("title", topic.title);
  pushChunk("summary", topic.summary);
  pushChunk("scope", topic.scopeNotes);
  pushChunk("distinction", topic.distinctionNotes);
  if (topic.tags && topic.tags.length) {
    pushChunk("tags", topic.tags.join(", "));
  }
  if (topic.sourceRefs && topic.sourceRefs.length) {
    pushChunk(
      "sources",
      topic.sourceRefs.map((ref) => `${ref.pageId}: ${ref.title} ${(ref.tags || []).join(", ")}`).join(" | ")
    );
  }

  return chunks;
}

export function createTopicMetadataForConfluence(topic) {
  const chunkManifest = buildTopicChunks(topic).map((chunk) => ({
    chunkId: chunk.chunkId,
    kind: chunk.kind,
    hash: chunk.hash,
    sourcePageId: chunk.sourcePageId,
    landingPageId: chunk.landingPageId
  }));

  return {
    topic: {
      id: topic.id,
      title: topic.title,
      slug: topic.slug,
      summary: topic.summary,
      scopeNotes: topic.scopeNotes,
      parentTopicId: topic.parentTopicId,
      sourcePageId: topic.sourcePageId,
      sourceRefs: topic.sourceRefs || [],
      sourceTags: topic.sourceTags || [],
      distinctionNotes: topic.distinctionNotes || "",
      landingPageId: topic.landingPageId,
      tags: topic.tags,
      quality: topic.quality,
      updatedAt: topic.updatedAt
    },
    chunkManifest
  };
}
