import test from "node:test";
import assert from "node:assert/strict";

import { cosineSimilarity, rankChunkMatches } from "../src/retrieval.js";

test("cosineSimilarity of identical vectors is close to 1", () => {
  const score = cosineSimilarity([1, 0, 1], [1, 0, 1]);
  assert.ok(score > 0.999);
});

test("cosineSimilarity of orthogonal vectors is close to 0", () => {
  const score = cosineSimilarity([1, 0, 0], [0, 1, 0]);
  assert.ok(score < 0.0001);
});

test("rankChunkMatches returns top entries sorted by score", () => {
  const query = [1, 0];
  const chunks = [
    { chunkId: "a", vector: [0.9, 0.1] },
    { chunkId: "b", vector: [0.1, 0.9] },
    { chunkId: "c", vector: [1, 0] }
  ];

  const ranked = rankChunkMatches(query, chunks, 2);
  assert.equal(ranked.length, 2);
  assert.equal(ranked[0].chunkId, "c");
  assert.equal(ranked[1].chunkId, "a");
});
