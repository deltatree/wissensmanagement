import test from "node:test";
import assert from "node:assert/strict";

import {
  assessGranularityHeuristic,
  buildTopicChunks,
  detectTopicOverlaps,
  normalizeTopicInput,
  slugifyTopicTitle,
  validateTopic
} from "../src/domain.js";

test("slugifyTopicTitle creates stable slug", () => {
  const slug = slugifyTopicTitle("Confluence Wissens-Lifecycle und Governance");
  assert.equal(slug, "confluence-wissens-lifecycle-und-governance");
});

test("validateTopic rejects incomplete topic", () => {
  const topic = normalizeTopicInput({ title: "Abc", summary: "zu kurz", sourcePageId: "" });
  const result = validateTopic(topic);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 2);
});

test("granularity heuristic scores broad topic lower than focused topic", () => {
  const broad = normalizeTopicInput({
    title: "Confluence Architektur und Governance und Workflow und Reporting",
    summary:
      "Dieses Topic beschreibt gleichzeitig Strategie, Governance, Betrieb, KPI-Reporting, Teamprozesse und technische Integrationen in einer Einheit.",
    scopeNotes:
      "Es umfasst Organisation, Rollen, Tooling, Datenhaltung, Prozesse und Trainingskonzept fuer mehrere Teams.",
    sourcePageId: "100"
  });

  const focused = normalizeTopicInput({
    title: "Confluence Seitenvorlage fuer Incident Review",
    summary: "Dieses Topic beschreibt den Aufbau einer konkreten Incident-Review-Seitenvorlage.",
    scopeNotes: "Es behandelt nur die Struktur und Pflichtfelder der Vorlage.",
    sourcePageId: "200"
  });

  const broadScore = assessGranularityHeuristic(broad, [focused]).score;
  const focusedScore = assessGranularityHeuristic(focused, [broad]).score;

  assert.ok(focusedScore > broadScore);
});

test("buildTopicChunks yields deterministic topic chunks", () => {
  const topic = normalizeTopicInput({
    title: "Runbook",
    summary: "Kurzbeschreibung",
    scopeNotes: "Abgrenzung",
    sourcePageId: "42",
    tags: ["ops", "runbook"]
  });

  const chunks = buildTopicChunks(topic);
  assert.ok(chunks.length >= 3);
  assert.ok(chunks.every((chunk) => chunk.topicId === topic.id));
});

test("validateTopic accepts sourceRefs without explicit sourcePageId", () => {
  const topic = normalizeTopicInput({
    title: "Confluence Labeling",
    summary: "Dieses Topic beschreibt Labeling als Quelle fuer Wissensselektion.",
    sourceRefs: [{ pageId: "777", title: "Labeling Guide", tags: ["labels"] }]
  });
  const result = validateTopic(topic);
  assert.equal(result.valid, true);
});

test("highly similar topics without distinction are detected", () => {
  const a = normalizeTopicInput({
    title: "Kreditprozess Freigabe",
    summary: "Freigabeschritte fuer Kreditprozess inklusive Rollen.",
    scopeNotes: "Fokus auf Freigabe und Genehmigung.",
    sourcePageId: "100",
    tags: ["kredit", "freigabe"]
  });
  const b = normalizeTopicInput({
    title: "Kreditprozess Freigaben",
    summary: "Genehmigungsfluss und Rollen im Kreditprozess.",
    scopeNotes: "Fokus auf Freigabe und Genehmigung.",
    sourcePageId: "200",
    tags: ["kredit", "freigabe"]
  });

  const overlaps = detectTopicOverlaps(a, [b]);
  assert.ok(overlaps.length > 0);
  assert.ok(overlaps[0].lexicalScore > 0.5);
});
