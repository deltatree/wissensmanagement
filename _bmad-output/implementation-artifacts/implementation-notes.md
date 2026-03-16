# Implementation Notes

Date: 2026-03-16

## Delivered Vertical Slice
1. Password-protected app shell with encrypted local state.
2. Topic management with hierarchy, validation, and quality scoring.
3. AI-assisted granularity assessment with heuristic fallback.
4. Provider switch: local-browser default, Azure optional.
5. Confluence registry integration (test connection, import, sync one/all topics).
6. Retrieval pipeline (chunking, embedding, index build, semantic search).
7. Transparent result rendering (score, provider, chunk, page link).
8. Tag-driven source page selection with scope behavior:
   - Empty tag filter -> current Confluence page as source baseline
   - Tag filter -> CQL-based source page discovery under registry ancestor
9. AI-assisted field derivation from selected source pages (title, summary, scope, tags, distinctionNotes).
10. Similarity governance:
   - Detect high lexical overlap across topics
   - Enforce explicit fachliche Abgrenzung for near-duplicates
   - Provide merge action into existing target topic
11. UUID-safe Confluence page persistence:
   - New and updated topic landing page titles include topic UUID suffix
   - Prevents title collision ambiguity in shared spaces

## Security and Compatibility
- Password is session-only and never persisted.
- State encrypted in localStorage.
- Legacy prototype storage shapes are migrated when possible.

## Testing
- Added deterministic unit tests for domain and retrieval logic.
- Executed with `npm test` using Node test runner.
- Added domain test coverage for sourceRefs validation and similarity detection.
