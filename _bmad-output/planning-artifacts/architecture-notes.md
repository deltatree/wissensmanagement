# Architecture Notes

Date: 2026-03-16

## Runtime Model
- Browser-only application with ES modules (`src/*`)
- No backend requirement for first vertical slice
- Password-gated encrypted local state

## Module Boundaries
- `src/domain.js`: topic model, validation, granularity heuristics, chunk manifests
- `src/retrieval.js`: vector similarity and ranking
- `src/crypto-store.js`: encrypted state storage + legacy migration
- `src/providers/*`: provider abstraction and implementations
- `src/confluence-service.js`: Confluence API and metadata persistence
- `src/app.js`: orchestration and UI event flow

## Provider Abstraction
Contract includes:
- `generate(...)`
- `embed(texts)`
- `health()`
- `capabilities()`

Implementations:
- `local-browser` (default): browser inference via Transformers.js, multilingual/German-friendly models
- `azure` (optional): Azure OpenAI chat and embeddings endpoints

## Confluence Registry Strategy
- Topic landing pages are created/updated as subpages below configured root page
- Page body embeds machine-readable metadata in `<pre data-km-topic-metadata="true">...json...</pre>`
- App can import registry from those subpages to rebuild local topic set

## Retrieval Strategy
- Canonical chunk metadata is shared through Confluence metadata blocks
- Vector embeddings remain local per user/session
- Search results include topic context + landing page traceability + provider context
