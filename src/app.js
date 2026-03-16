import {
  assessGranularityHeuristic,
  buildTopicChunks,
  createEmptyTopic,
  normalizeTopicInput,
  parseTags,
  validateTopic
} from "./domain.js";
import { rankChunkMatches } from "./retrieval.js";
import { EncryptedStore } from "./crypto-store.js";
import { createDefaultState, mergeWithDefaults } from "./state.js";
import { ProviderManager } from "./providers/provider-manager.js";
import { ConfluenceService } from "./confluence-service.js";
import { createSafeStorage } from "./safe-storage.js";

const storageRuntime = createSafeStorage();
const store = new EncryptedStore(storageRuntime.storage);
let state = createDefaultState();
let sessionPassword = "";
let selectedTopicId = "";
let qualityPreview = null;

const providerManager = new ProviderManager(() => state);
const confluenceService = new ConfluenceService(() => state.confluence);
const RUNTIME_STYLE_ID = "km-runtime-style";

function ensureRuntimeStyle() {
  if (document.getElementById(RUNTIME_STYLE_ID)) {
    return;
  }

  const style = document.createElement("style");
  style.id = RUNTIME_STYLE_ID;
  style.textContent = `
#kmAppRoot { max-width: 1260px; margin: 0 auto; padding: 14px; font-family: "Space Grotesk","Trebuchet MS","Segoe UI",sans-serif; }
#kmAppRoot * { box-sizing: border-box; }
#kmAppRoot .hidden { display: none !important; }
#kmAppRoot .tab-panel { display: none !important; }
#kmAppRoot .tab-panel.active { display: grid !important; gap: 12px !important; }
#kmAppRoot .grid-2 { display: grid !important; gap: 12px !important; grid-template-columns: minmax(360px,1.15fr) minmax(300px,0.85fr) !important; }
#kmAppRoot .grid-3 { display: grid !important; gap: 10px !important; grid-template-columns: repeat(3,minmax(180px,1fr)) !important; }
#kmAppRoot .shell-head, #kmAppRoot .head-right, #kmAppRoot .tabs, #kmAppRoot .btn-row { display: flex !important; flex-wrap: wrap !important; gap: 8px !important; }
#kmAppRoot .field { display: block !important; width: 100% !important; margin-bottom: 10px !important; }
#kmAppRoot .field label { display: block !important; margin: 0 0 5px !important; font-weight: 700 !important; text-transform: uppercase !important; font-size: .83rem !important; }
#kmAppRoot input, #kmAppRoot textarea, #kmAppRoot select, #kmAppRoot button { display: block !important; width: 100% !important; max-width: 100% !important; min-width: 0 !important; }
#kmAppRoot .btn-row > * { flex: 1 1 140px !important; width: auto !important; }
@media (max-width: 980px) { #kmAppRoot .grid-3 { grid-template-columns: repeat(2,minmax(180px,1fr)) !important; } }
@media (max-width: 760px) { #kmAppRoot .grid-2, #kmAppRoot .grid-3 { grid-template-columns: 1fr !important; } }
`;

  (document.head || document.body || document.documentElement).appendChild(style);
}

let el = null;

function resolveElements() {
  return {
    lockShell: document.getElementById("lockShell"),
    appRoot: document.getElementById("appRoot"),
    lockDescription: document.getElementById("lockDescription"),
    unlockPassword: document.getElementById("unlockPassword"),
    unlockPasswordConfirm: document.getElementById("unlockPasswordConfirm"),
    confirmWrap: document.getElementById("confirmWrap"),
    unlockBtn: document.getElementById("unlockBtn"),
    resetStorageBtn: document.getElementById("resetStorageBtn"),
    lockStatus: document.getElementById("lockStatus"),

    providerBadge: document.getElementById("providerBadge"),
    saveAllBtn: document.getElementById("saveAllBtn"),
    lockBtn: document.getElementById("lockBtn"),

    tabButtons: Array.from(document.querySelectorAll(".tab-btn")),

    topicTitle: document.getElementById("topicTitle"),
    topicSummary: document.getElementById("topicSummary"),
    topicScopeNotes: document.getElementById("topicScopeNotes"),
    topicSourcePageId: document.getElementById("topicSourcePageId"),
    topicParent: document.getElementById("topicParent"),
    topicTags: document.getElementById("topicTags"),
    newTopicBtn: document.getElementById("newTopicBtn"),
    assessTopicBtn: document.getElementById("assessTopicBtn"),
    saveTopicBtn: document.getElementById("saveTopicBtn"),
    syncTopicBtn: document.getElementById("syncTopicBtn"),
    topicFormStatus: document.getElementById("topicFormStatus"),
    qualityBox: document.getElementById("qualityBox"),
    topicTableWrap: document.getElementById("topicTableWrap"),

    searchQuery: document.getElementById("searchQuery"),
    searchTopK: document.getElementById("searchTopK"),
    rebuildIndexBtn: document.getElementById("rebuildIndexBtn"),
    runSearchBtn: document.getElementById("runSearchBtn"),
    searchStatus: document.getElementById("searchStatus"),
    searchResultList: document.getElementById("searchResultList"),

    activeProvider: document.getElementById("activeProvider"),
    localChatModel: document.getElementById("localChatModel"),
    localEmbeddingModel: document.getElementById("localEmbeddingModel"),
    azureApiMode: document.getElementById("azureApiMode"),
    azureEndpoint: document.getElementById("azureEndpoint"),
    azureChatModel: document.getElementById("azureChatModel"),
    azureEmbeddingModel: document.getElementById("azureEmbeddingModel"),
    azureApiVersion: document.getElementById("azureApiVersion"),
    azureApiKey: document.getElementById("azureApiKey"),
    saveProviderBtn: document.getElementById("saveProviderBtn"),
    checkProviderHealthBtn: document.getElementById("checkProviderHealthBtn"),
    providerStatus: document.getElementById("providerStatus"),
    providerCapabilityBox: document.getElementById("providerCapabilityBox"),

    confBaseUrl: document.getElementById("confBaseUrl"),
    confRootPageId: document.getElementById("confRootPageId"),
    confAuthMode: document.getElementById("confAuthMode"),
    confTimeoutMs: document.getElementById("confTimeoutMs"),
    confEmailWrap: document.getElementById("confEmailWrap"),
    confApiTokenWrap: document.getElementById("confApiTokenWrap"),
    confPatWrap: document.getElementById("confPatWrap"),
    confEmail: document.getElementById("confEmail"),
    confApiToken: document.getElementById("confApiToken"),
    confPat: document.getElementById("confPat"),
    saveConfluenceBtn: document.getElementById("saveConfluenceBtn"),
    testConfluenceBtn: document.getElementById("testConfluenceBtn"),
    importTopicsBtn: document.getElementById("importTopicsBtn"),
    syncAllTopicsBtn: document.getElementById("syncAllTopicsBtn"),
    confluenceStatus: document.getElementById("confluenceStatus"),
    syncLog: document.getElementById("syncLog")
  };
}

function validateElements() {
  const requiredKeys = [
    "lockShell",
    "appRoot",
    "unlockPassword",
    "unlockPasswordConfirm",
    "unlockBtn",
    "resetStorageBtn",
    "lockStatus",
    "providerBadge",
    "saveAllBtn",
    "lockBtn",
    "topicTitle",
    "topicSummary",
    "topicScopeNotes",
    "topicSourcePageId",
    "topicParent",
    "topicTags",
    "newTopicBtn",
    "assessTopicBtn",
    "saveTopicBtn",
    "syncTopicBtn",
    "topicFormStatus",
    "qualityBox",
    "topicTableWrap",
    "searchQuery",
    "searchTopK",
    "rebuildIndexBtn",
    "runSearchBtn",
    "searchStatus",
    "searchResultList",
    "activeProvider",
    "localChatModel",
    "localEmbeddingModel",
    "azureApiMode",
    "azureEndpoint",
    "azureChatModel",
    "azureEmbeddingModel",
    "azureApiVersion",
    "azureApiKey",
    "saveProviderBtn",
    "checkProviderHealthBtn",
    "providerStatus",
    "providerCapabilityBox",
    "confBaseUrl",
    "confRootPageId",
    "confAuthMode",
    "confTimeoutMs",
    "confEmailWrap",
    "confApiTokenWrap",
    "confPatWrap",
    "confEmail",
    "confApiToken",
    "confPat",
    "saveConfluenceBtn",
    "testConfluenceBtn",
    "importTopicsBtn",
    "syncAllTopicsBtn",
    "confluenceStatus",
    "syncLog"
  ];

  const missing = requiredKeys.filter((key) => !el[key]);
  if (missing.length) {
    throw new Error(`HTML unvollstaendig oder vom Host gefiltert. Fehlende Elemente: ${missing.join(", ")}`);
  }
}

function now() {
  return new Date().toISOString();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function topicById(topicId) {
  return state.topics.find((topic) => topic.id === topicId) || null;
}

function setStatus(target, message, type = "info") {
  if (!target) {
    return;
  }

  target.textContent = message || "";
  target.className = `status${type === "error" ? " error" : type === "ok" ? " ok" : ""}`;
}

function logSync(message) {
  const row = document.createElement("div");
  row.textContent = `[${new Date().toLocaleTimeString("de-DE")}] ${message}`;
  el.syncLog.prepend(row);
}

async function persistState() {
  if (!sessionPassword) {
    throw new Error("Seite ist gesperrt.");
  }
  await store.save(state, sessionPassword);
}

function lockApp() {
  sessionPassword = "";
  el.appRoot.classList.add("hidden");
  el.lockShell.classList.remove("hidden");
  el.unlockPassword.value = "";
  el.unlockPasswordConfirm.value = "";
  setStatus(el.lockStatus, "", "info");
}

function unlockApp() {
  el.lockShell.classList.add("hidden");
  el.appRoot.classList.remove("hidden");
  renderAll();
}

function refreshLockUi() {
  const modeHint = storageRuntime.persistent
    ? ""
    : " Hinweis: Browser blockiert persistentes localStorage. Daten gelten nur fuer diese Laufzeit.";

  if (store.hasAnyState()) {
    el.lockDescription.textContent = `Lokaler Zustand gefunden. Bitte mit Passwort entsperren.${modeHint}`;
    el.confirmWrap.classList.add("hidden");
    el.unlockBtn.textContent = "Entsperren";
  } else {
    el.lockDescription.textContent = `Erststart: Lege ein Passwort fest. Es wird nicht gespeichert.${modeHint}`;
    el.confirmWrap.classList.remove("hidden");
    el.unlockBtn.textContent = "Passwort setzen";
  }
}

async function handleUnlock() {
  const password = String(el.unlockPassword.value || "");
  if (!password) {
    setStatus(el.lockStatus, "Bitte Passwort eingeben.", "error");
    return;
  }

  setStatus(el.lockStatus, "Entsperre...", "info");

  try {
    if (store.hasAnyState()) {
      state = mergeWithDefaults(await store.load(password));
      // Local-browser stays the default startup provider.
      state.settings.activeProvider = "local-browser";
      sessionPassword = password;
      unlockApp();
      setStatus(el.lockStatus, "", "info");
      return;
    }

    const confirm = String(el.unlockPasswordConfirm.value || "");
    if (password !== confirm) {
      setStatus(el.lockStatus, "Passwoerter stimmen nicht ueberein.", "error");
      return;
    }

    state = createDefaultState();
    sessionPassword = password;
    await persistState();
    unlockApp();
    setStatus(el.lockStatus, "", "info");
  } catch (error) {
    sessionPassword = "";
    setStatus(el.lockStatus, `Entsperren fehlgeschlagen: ${error.message}`, "error");
  }
}

function setActiveTab(tabId) {
  for (const button of el.tabButtons) {
    button.classList.toggle("active", button.dataset.tab === tabId);
  }

  const panels = ["topics", "search", "providers", "confluence"];
  for (const panelId of panels) {
    const panel = document.getElementById(`tab-${panelId}`);
    if (panel) {
      panel.classList.toggle("active", panelId === tabId);
    }
  }
}

function renderProviderBadge() {
  el.providerBadge.textContent = `Provider: ${state.settings.activeProvider}`;
}

function renderProviderForm() {
  el.activeProvider.value = state.settings.activeProvider;
  el.localChatModel.value = state.providers.local.chatModel;
  el.localEmbeddingModel.value = state.providers.local.embeddingModel;

  el.azureApiMode.value = state.providers.azure.apiMode;
  el.azureEndpoint.value = state.providers.azure.endpoint;
  el.azureChatModel.value = state.providers.azure.chatModel;
  el.azureEmbeddingModel.value = state.providers.azure.embeddingModel;
  el.azureApiVersion.value = state.providers.azure.apiVersion;
  el.azureApiKey.value = state.providers.azure.apiKey;
}

function renderConfluenceForm() {
  el.confBaseUrl.value = state.confluence.baseUrl;
  el.confRootPageId.value = state.confluence.rootPageId;
  el.confAuthMode.value = state.confluence.authMode || "session";
  el.confTimeoutMs.value = String(state.confluence.timeoutMs || 20000);
  el.confEmail.value = state.confluence.email;
  el.confApiToken.value = state.confluence.apiToken;
  el.confPat.value = state.confluence.pat;
  renderConfluenceAuthVisibility();
}

function renderConfluenceAuthVisibility() {
  const mode = el.confAuthMode.value || "session";
  const basic = mode === "basic";
  const bearer = mode === "bearer";

  el.confEmailWrap.classList.toggle("hidden", !basic);
  el.confApiTokenWrap.classList.toggle("hidden", !basic);
  el.confPatWrap.classList.toggle("hidden", !bearer);
}

function topicToRow(topic) {
  const parent = topic.parentTopicId ? topicById(topic.parentTopicId) : null;
  const quality = topic.quality || { score: 0, status: "unrated" };

  return `
    <tr>
      <td>
        <strong>${escapeHtml(topic.title)}</strong><br />
        <span class="small">${escapeHtml(topic.id)}</span>
      </td>
      <td>
        ${topic.tags.map((tag) => `<span class="pill">${escapeHtml(tag)}</span>`).join("")}
      </td>
      <td>
        ${parent ? escapeHtml(parent.title) : "-"}
      </td>
      <td>
        <span class="pill">${escapeHtml(quality.status || "unrated")}</span>
        <span class="small">Score: ${Number.isFinite(quality.score) ? quality.score : 0}</span>
      </td>
      <td>
        ${topic.landingPageUrl ? `<a href="${escapeHtml(topic.landingPageUrl)}" target="_blank" rel="noreferrer">Landing Page</a>` : "-"}
      </td>
      <td>
        <div class="btn-row">
          <button class="secondary" data-topic-action="edit" data-topic-id="${escapeHtml(topic.id)}" type="button">Edit</button>
          <button class="secondary" data-topic-action="delete" data-topic-id="${escapeHtml(topic.id)}" type="button">Delete</button>
        </div>
      </td>
    </tr>
  `;
}

function renderTopicTable() {
  if (!state.topics.length) {
    el.topicTableWrap.innerHTML = '<div class="small" style="padding:10px;">Noch keine Topics vorhanden.</div>';
    return;
  }

  const body = state.topics.map(topicToRow).join("\n");
  el.topicTableWrap.innerHTML = `
    <table>
      <thead>
        <tr>
          <th>Topic</th>
          <th>Tags</th>
          <th>Parent</th>
          <th>Quality</th>
          <th>Confluence</th>
          <th>Aktionen</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

function renderParentSelect() {
  const options = ['<option value="">(kein Parent)</option>'];
  for (const topic of state.topics) {
    if (topic.id === selectedTopicId) {
      continue;
    }
    options.push(`<option value="${escapeHtml(topic.id)}">${escapeHtml(topic.title)}</option>`);
  }
  el.topicParent.innerHTML = options.join("");
}

function readTopicFromForm() {
  const topic = normalizeTopicInput({
    id: selectedTopicId || createEmptyTopic().id,
    title: el.topicTitle.value,
    summary: el.topicSummary.value,
    scopeNotes: el.topicScopeNotes.value,
    sourcePageId: el.topicSourcePageId.value,
    parentTopicId: el.topicParent.value,
    tags: parseTags(el.topicTags.value)
  });

  const existing = topicById(topic.id);
  if (existing) {
    topic.createdAt = existing.createdAt;
    topic.landingPageId = existing.landingPageId;
    topic.landingPageUrl = existing.landingPageUrl;
    topic.quality = existing.quality;
  }

  return topic;
}

function fillTopicForm(topic) {
  selectedTopicId = topic.id;
  el.topicTitle.value = topic.title;
  el.topicSummary.value = topic.summary;
  el.topicScopeNotes.value = topic.scopeNotes;
  el.topicSourcePageId.value = topic.sourcePageId;
  el.topicTags.value = (topic.tags || []).join(", ");
  renderParentSelect();
  el.topicParent.value = topic.parentTopicId || "";
  renderQualityBox();
}

function clearTopicForm() {
  selectedTopicId = "";
  qualityPreview = null;
  const empty = createEmptyTopic();
  fillTopicForm(empty);
  setStatus(el.topicFormStatus, "Neues Topic gestartet.", "info");
}

function upsertTopic(topic) {
  const index = state.topics.findIndex((item) => item.id === topic.id);
  if (index >= 0) {
    state.topics[index] = topic;
  } else {
    state.topics.push(topic);
  }

  state.topics.sort((a, b) => a.title.localeCompare(b.title, "de"));
}

function removeTopic(topicId) {
  state.topics = state.topics.filter((topic) => topic.id !== topicId && topic.parentTopicId !== topicId);
  if (selectedTopicId === topicId) {
    clearTopicForm();
  }
}

function renderQualityBox() {
  let quality = null;
  if (qualityPreview && (!selectedTopicId || qualityPreview.topicId === selectedTopicId)) {
    quality = qualityPreview;
  }

  if (!quality && selectedTopicId) {
    quality = topicById(selectedTopicId)?.quality || null;
  }

  if (!quality) {
    el.qualityBox.innerHTML = '<div class="small">Noch keine Bewertung vorhanden.</div>';
    return;
  }

  const reasons = (quality.reasons || []).map((r) => `<li>${escapeHtml(r)}</li>`).join("");
  const splits = (quality.splitSuggestions || []).map((s) => `<li>${escapeHtml(s)}</li>`).join("");
  const overlaps = (quality.overlapCandidates || [])
    .map((item) => `<li>${escapeHtml(item.title)} (${(item.lexicalScore * 100).toFixed(1)}%)</li>`)
    .join("");

  el.qualityBox.innerHTML = `
    <div><strong>Status:</strong> ${escapeHtml(quality.status || "unrated")}</div>
    <div><strong>Score:</strong> ${Number.isFinite(quality.score) ? quality.score : 0}</div>
    <h4>Gruende</h4>
    ${reasons ? `<ul>${reasons}</ul>` : '<div class="small">Keine Hinweise</div>'}
    <h4>Split-Vorschlaege</h4>
    ${splits ? `<ul>${splits}</ul>` : '<div class="small">Keine Vorschlaege</div>'}
    <h4>Ueberschneidungen</h4>
    ${overlaps ? `<ul>${overlaps}</ul>` : '<div class="small">Keine signifikanten Overlaps</div>'}
  `;
}

function renderSearchResults(results) {
  if (!results || !results.length) {
    el.searchResultList.innerHTML = '<div class="small">Keine Treffer.</div>';
    return;
  }

  el.searchResultList.innerHTML = results
    .map((result) => {
      const topic = topicById(result.topicId);
      const title = topic ? topic.title : result.topicId;
      const landing = topic?.landingPageUrl || "";
      return `
        <article class="result-item">
          <h4>${escapeHtml(title)}</h4>
          <div class="meta">Score ${(result.score * 100).toFixed(2)}% | Provider ${escapeHtml(state.searchIndex.provider)} | Chunk ${escapeHtml(result.kind)}</div>
          ${landing ? `<div class="meta"><a href="${escapeHtml(landing)}" target="_blank" rel="noreferrer">Confluence Landing Page</a></div>` : ""}
          <div>${escapeHtml(result.text)}</div>
        </article>
      `;
    })
    .join("\n");
}

function renderProviderCapabilities() {
  const provider = providerManager.getActiveProvider();
  provider
    .capabilities()
    .then((caps) => {
      el.providerCapabilityBox.innerHTML = `
        <div><strong>Provider:</strong> ${escapeHtml(caps.provider)}</div>
        <div><strong>Generation:</strong> ${caps.generation ? "ja" : "nein"}</div>
        <div><strong>Embeddings:</strong> ${caps.embeddings ? "ja" : "nein"}</div>
        <div><strong>Locality:</strong> ${escapeHtml(caps.locality || "")}</div>
        <pre>${escapeHtml(JSON.stringify(caps.config || {}, null, 2))}</pre>
      `;
    })
    .catch((error) => {
      el.providerCapabilityBox.innerHTML = `<div class="small">Capabilities konnten nicht geladen werden: ${escapeHtml(
        error.message
      )}</div>`;
    });
}

function renderAll() {
  renderProviderBadge();
  renderProviderForm();
  renderConfluenceForm();
  renderParentSelect();
  renderTopicTable();
  renderQualityBox();
  renderProviderCapabilities();
}

function parseAssessmentJson(text) {
  const raw = String(text || "");
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) {
    return null;
  }

  try {
    const parsed = JSON.parse(match[0]);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    return {
      score: Number(parsed.score || 0),
      status: String(parsed.status || "borderline"),
      reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map((x) => String(x)) : [],
      splitSuggestions: Array.isArray(parsed.splitSuggestions)
        ? parsed.splitSuggestions.map((x) => String(x))
        : [],
      overlapCandidates: []
    };
  } catch {
    return null;
  }
}

async function assessCurrentTopic() {
  const candidate = readTopicFromForm();
  const heuristic = assessGranularityHeuristic(candidate, state.topics);
  let finalAssessment = heuristic;

  try {
    const provider = providerManager.getActiveProvider();

    const prompt = [
      "Bewerte die Topic-Granularitaet fuer ein deutsches Wissenssystem.",
      "Antworte strikt als JSON mit Feldern: score (0-100), status (good|borderline|too_broad), reasons[], splitSuggestions[].",
      "Topic:",
      JSON.stringify(
        {
          title: candidate.title,
          summary: candidate.summary,
          scopeNotes: candidate.scopeNotes,
          tags: candidate.tags,
          parentTopicId: candidate.parentTopicId
        },
        null,
        2
      )
    ].join("\n");

    const response = await provider.generate({
      systemPrompt: "Du bist ein strikter Wissensarchitekt fuer deutsche Fachinhalte.",
      userPrompt: prompt,
      maxTokens: 260,
      temperature: 0.1
    });

    const parsed = parseAssessmentJson(response);
    if (parsed) {
      finalAssessment = {
        ...heuristic,
        ...parsed,
        overlapCandidates: heuristic.overlapCandidates
      };
    }
  } catch (error) {
    setStatus(
      el.topicFormStatus,
      `AI-Bewertung nicht verfuegbar, heuristische Bewertung genutzt: ${error.message}`,
      "error"
    );
  }

  qualityPreview = {
    ...finalAssessment,
    topicId: selectedTopicId || candidate.id
  };

  renderQualityBox();
  setStatus(el.topicFormStatus, "Granularitaetsbewertung aktualisiert.", "ok");
}

async function saveCurrentTopic() {
  const topic = readTopicFromForm();
  const validation = validateTopic(topic);
  if (!validation.valid) {
    setStatus(el.topicFormStatus, validation.errors.join(" "), "error");
    return;
  }

  const heuristic = assessGranularityHeuristic(topic, state.topics);
  topic.quality = qualityPreview && qualityPreview.topicId === topic.id ? qualityPreview : heuristic;

  upsertTopic(topic);
  selectedTopicId = topic.id;
  qualityPreview = topic.quality;

  try {
    await persistState();
    renderAll();
    fillTopicForm(topic);
    setStatus(el.topicFormStatus, "Topic gespeichert.", "ok");
  } catch (error) {
    setStatus(el.topicFormStatus, `Speichern fehlgeschlagen: ${error.message}`, "error");
  }
}

async function syncTopic(topic) {
  const synced = await confluenceService.upsertTopic(topic);
  upsertTopic(synced);
  logSync(`Topic '${synced.title}' nach Confluence synchronisiert (${synced.landingPageId}).`);
  return synced;
}

async function syncSelectedTopic() {
  if (!selectedTopicId) {
    setStatus(el.topicFormStatus, "Bitte zuerst ein Topic waehlen oder speichern.", "error");
    return;
  }

  const topic = topicById(selectedTopicId);
  if (!topic) {
    setStatus(el.topicFormStatus, "Ausgewaehltes Topic nicht gefunden.", "error");
    return;
  }

  try {
    const synced = await syncTopic(topic);
    await persistState();
    fillTopicForm(synced);
    renderTopicTable();
    setStatus(el.topicFormStatus, "Topic erfolgreich nach Confluence synchronisiert.", "ok");
  } catch (error) {
    setStatus(el.topicFormStatus, `Confluence Sync fehlgeschlagen: ${error.message}`, "error");
    logSync(`Sync-Fehler bei '${topic.title}': ${error.message}`);
  }
}

async function syncAllTopics() {
  if (!state.topics.length) {
    setStatus(el.confluenceStatus, "Keine Topics zum Sync vorhanden.", "error");
    return;
  }

  setStatus(el.confluenceStatus, "Synchronisiere Topics...", "info");

  try {
    for (const topic of state.topics) {
      await syncTopic(topic);
    }
    await persistState();
    renderTopicTable();
    setStatus(el.confluenceStatus, "Alle Topics synchronisiert.", "ok");
  } catch (error) {
    setStatus(el.confluenceStatus, `Sync abgebrochen: ${error.message}`, "error");
  }
}

function readConfluenceFormToState() {
  state.confluence.baseUrl = String(el.confBaseUrl.value || "").trim();
  state.confluence.rootPageId = String(el.confRootPageId.value || "").trim();
  state.confluence.authMode = el.confAuthMode.value || "session";
  state.confluence.timeoutMs = Number(el.confTimeoutMs.value) || 20000;

  if (state.confluence.authMode === "basic") {
    state.confluence.email = String(el.confEmail.value || "").trim();
    state.confluence.apiToken = String(el.confApiToken.value || "").trim();
    state.confluence.pat = "";
    return;
  }

  if (state.confluence.authMode === "bearer") {
    state.confluence.pat = String(el.confPat.value || "").trim();
    state.confluence.email = "";
    state.confluence.apiToken = "";
    return;
  }

  state.confluence.email = "";
  state.confluence.apiToken = "";
  state.confluence.pat = "";
}

function readProviderFormToState() {
  state.settings.activeProvider = el.activeProvider.value;

  state.providers.local.chatModel = String(el.localChatModel.value || "").trim();
  state.providers.local.embeddingModel = String(el.localEmbeddingModel.value || "").trim();

  state.providers.azure.apiMode = el.azureApiMode.value;
  state.providers.azure.endpoint = String(el.azureEndpoint.value || "").trim();
  state.providers.azure.chatModel = String(el.azureChatModel.value || "").trim();
  state.providers.azure.embeddingModel = String(el.azureEmbeddingModel.value || "").trim();
  state.providers.azure.apiVersion = String(el.azureApiVersion.value || "").trim();
  state.providers.azure.apiKey = String(el.azureApiKey.value || "").trim();
}

async function rebuildSearchIndex() {
  if (!state.topics.length) {
    setStatus(el.searchStatus, "Keine Topics vorhanden. Erst Topics anlegen oder importieren.", "error");
    return;
  }

  setStatus(el.searchStatus, "Index wird aufgebaut...", "info");

  try {
    const provider = providerManager.getActiveProvider();
    const chunks = [];

    for (const topic of state.topics) {
      const built = buildTopicChunks(topic);
      for (const chunk of built) {
        chunks.push({
          ...chunk,
          topicId: topic.id
        });
      }
    }

    const vectors = await provider.embed(chunks.map((chunk) => chunk.text));
    const caps = await provider.capabilities();

    state.searchIndex = {
      builtAt: now(),
      provider: provider.id(),
      embeddingModel: caps.config?.embeddingModel || "",
      chunkCount: chunks.length,
      chunks: chunks.map((chunk, index) => ({
        ...chunk,
        vector: vectors[index] || []
      }))
    };

    await persistState();
    setStatus(el.searchStatus, `Index aufgebaut: ${chunks.length} Chunks.`, "ok");
  } catch (error) {
    setStatus(el.searchStatus, `Indexaufbau fehlgeschlagen: ${error.message}`, "error");
  }
}

async function runSemanticSearch() {
  const query = String(el.searchQuery.value || "").trim();
  if (!query) {
    setStatus(el.searchStatus, "Bitte Suchanfrage eingeben.", "error");
    return;
  }

  if (!state.searchIndex.chunks.length) {
    setStatus(el.searchStatus, "Kein Index vorhanden. Bitte zuerst Index neu aufbauen.", "error");
    return;
  }

  if (state.searchIndex.provider !== state.settings.activeProvider) {
    setStatus(
      el.searchStatus,
      `Index wurde mit Provider '${state.searchIndex.provider}' gebaut. Bitte mit aktivem Provider neu aufbauen.`,
      "error"
    );
    return;
  }

  setStatus(el.searchStatus, "Suche laeuft...", "info");

  try {
    const provider = providerManager.getActiveProvider();
    const [queryVector] = await provider.embed([query]);
    const topK = Math.max(1, Math.min(20, Number(el.searchTopK.value) || 8));
    const ranked = rankChunkMatches(queryVector, state.searchIndex.chunks, topK);

    renderSearchResults(ranked);
    setStatus(el.searchStatus, `${ranked.length} Treffer gefunden.`, "ok");
  } catch (error) {
    setStatus(el.searchStatus, `Suche fehlgeschlagen: ${error.message}`, "error");
  }
}

async function importTopicsFromConfluence() {
  setStatus(el.confluenceStatus, "Importiere Topics aus Confluence...", "info");

  try {
    const pages = await confluenceService.listTopicPages();

    for (const page of pages) {
      const imported = normalizeTopicInput(page.topic);
      upsertTopic(imported);
      logSync(`Importiert: ${imported.title} (${imported.id})`);
    }

    await persistState();
    renderAll();
    setStatus(el.confluenceStatus, `${pages.length} Topics importiert.`, "ok");
  } catch (error) {
    setStatus(el.confluenceStatus, `Import fehlgeschlagen: ${error.message}`, "error");
  }
}

function handleTopicTableClick(event) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) {
    return;
  }

  const action = target.dataset.topicAction;
  const topicId = target.dataset.topicId;
  if (!action || !topicId) {
    return;
  }

  const topic = topicById(topicId);
  if (!topic) {
    return;
  }

  if (action === "edit") {
    qualityPreview = topic.quality;
    fillTopicForm(topic);
    setStatus(el.topicFormStatus, `Topic '${topic.title}' geladen.`, "info");
    return;
  }

  if (action === "delete") {
    if (!window.confirm(`Topic '${topic.title}' wirklich loeschen?`)) {
      return;
    }

    removeTopic(topicId);
    persistState()
      .then(() => {
        renderAll();
        setStatus(el.topicFormStatus, "Topic geloescht.", "ok");
      })
      .catch((error) => {
        setStatus(el.topicFormStatus, `Loeschen fehlgeschlagen: ${error.message}`, "error");
      });
  }
}

async function checkProviderHealth() {
  setStatus(el.providerStatus, "Fuehre Health-Check aus...", "info");

  try {
    const provider = providerManager.getActiveProvider();
    const result = await provider.health();
    if (result.ok) {
      setStatus(el.providerStatus, `Health OK: ${JSON.stringify(result.details)}`, "ok");
    } else {
      setStatus(el.providerStatus, `Health nicht OK: ${JSON.stringify(result.details)}`, "error");
    }
  } catch (error) {
    setStatus(el.providerStatus, `Health-Check fehlgeschlagen: ${error.message}`, "error");
  }
}

function bindEvents() {
  el.tabButtons.forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });

  el.unlockBtn.addEventListener("click", () => {
    handleUnlock();
  });

  [el.unlockPassword, el.unlockPasswordConfirm].forEach((input) => {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        handleUnlock();
      }
    });
  });

  el.resetStorageBtn.addEventListener("click", () => {
    store.clearAll();
    state = createDefaultState();
    selectedTopicId = "";
    qualityPreview = null;
    setStatus(el.lockStatus, "Lokale Daten wurden geloescht.", "ok");
    refreshLockUi();
  });

  el.saveAllBtn.addEventListener("click", async () => {
    try {
      await persistState();
      setStatus(el.topicFormStatus, "Gesamtzustand gespeichert.", "ok");
    } catch (error) {
      setStatus(el.topicFormStatus, `Speichern fehlgeschlagen: ${error.message}`, "error");
    }
  });

  el.lockBtn.addEventListener("click", () => {
    lockApp();
    refreshLockUi();
  });

  el.newTopicBtn.addEventListener("click", () => {
    clearTopicForm();
  });

  el.assessTopicBtn.addEventListener("click", () => {
    assessCurrentTopic();
  });

  el.saveTopicBtn.addEventListener("click", () => {
    saveCurrentTopic();
  });

  el.syncTopicBtn.addEventListener("click", () => {
    syncSelectedTopic();
  });

  el.topicTableWrap.addEventListener("click", handleTopicTableClick);

  el.rebuildIndexBtn.addEventListener("click", () => {
    rebuildSearchIndex();
  });

  el.runSearchBtn.addEventListener("click", () => {
    runSemanticSearch();
  });

  el.saveProviderBtn.addEventListener("click", async () => {
    readProviderFormToState();
    renderProviderBadge();
    renderProviderCapabilities();

    try {
      await persistState();
      setStatus(el.providerStatus, "Provider-Konfiguration gespeichert.", "ok");
    } catch (error) {
      setStatus(el.providerStatus, `Speichern fehlgeschlagen: ${error.message}`, "error");
    }
  });

  el.checkProviderHealthBtn.addEventListener("click", () => {
    readProviderFormToState();
    checkProviderHealth();
  });

  el.confAuthMode.addEventListener("change", renderConfluenceAuthVisibility);

  el.saveConfluenceBtn.addEventListener("click", async () => {
    readConfluenceFormToState();

    try {
      await persistState();
      setStatus(el.confluenceStatus, "Confluence-Konfiguration gespeichert.", "ok");
    } catch (error) {
      setStatus(el.confluenceStatus, `Speichern fehlgeschlagen: ${error.message}`, "error");
    }
  });

  el.testConfluenceBtn.addEventListener("click", async () => {
    readConfluenceFormToState();
    setStatus(el.confluenceStatus, "Teste Confluence-Verbindung...", "info");

    try {
      const result = await confluenceService.testConnection();
      setStatus(
        el.confluenceStatus,
        `Verbindung OK. Root: ${result.rootTitle} (Space ${result.spaceKey}).`,
        "ok"
      );
      logSync(`Confluence health ok: Root ${result.rootTitle}`);
    } catch (error) {
      setStatus(el.confluenceStatus, `Verbindung fehlgeschlagen: ${error.message}`, "error");
      logSync(`Confluence health failed: ${error.message}`);
    }
  });

  el.importTopicsBtn.addEventListener("click", () => {
    readConfluenceFormToState();
    importTopicsFromConfluence();
  });

  el.syncAllTopicsBtn.addEventListener("click", () => {
    readConfluenceFormToState();
    syncAllTopics();
  });
}

function initializeTopicForm() {
  const empty = createEmptyTopic();
  fillTopicForm(empty);
}

function initialize() {
  el = resolveElements();
  validateElements();
  bindEvents();
  initializeTopicForm();
  refreshLockUi();
  lockApp();
}

function showBootError(error) {
  console.error("App start failed:", error);
  const message = `Initialisierung fehlgeschlagen: ${error?.message || "Unbekannter Fehler"}`;
  const statusNode = document.getElementById("lockStatus");
  if (statusNode) {
    statusNode.textContent = message;
    statusNode.className = "status error";
    return;
  }
  document.body.innerHTML = `<pre style="padding:12px; color:#b91c1c; white-space:pre-wrap;">${escapeHtml(message)}</pre>`;
}

function boot() {
  try {
    ensureRuntimeStyle();
    initialize();
  } catch (error) {
    showBootError(error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot, { once: true });
} else {
  boot();
}
