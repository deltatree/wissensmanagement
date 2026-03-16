export function dotProduct(a, b) {
  let sum = 0;
  const length = Math.min(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    sum += a[i] * b[i];
  }
  return sum;
}

export function vectorNorm(v) {
  let sum = 0;
  for (let i = 0; i < v.length; i += 1) {
    sum += v[i] * v[i];
  }
  return Math.sqrt(sum);
}

export function cosineSimilarity(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || !a.length || !b.length) {
    return 0;
  }

  const normA = vectorNorm(a);
  const normB = vectorNorm(b);
  if (!normA || !normB) {
    return 0;
  }

  return dotProduct(a, b) / (normA * normB);
}

export function rankChunkMatches(queryVector, indexChunks, limit = 8) {
  const scored = (indexChunks || []).map((chunk) => ({
    ...chunk,
    score: cosineSimilarity(queryVector, chunk.vector || [])
  }));

  scored.sort((left, right) => right.score - left.score);
  return scored.slice(0, limit);
}
