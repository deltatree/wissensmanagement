# Current-State Baseline (Reverse-Engineered)

Date: 2026-03-16
Project: wissensmanagement

## As-Built Architecture

- Runtime: Single-file browser app (`index.html`) with vanilla HTML/CSS/JavaScript.
- State: Browser `localStorage` encrypted with password-derived key (PBKDF2 + AES-GCM).
- Auth pattern: App-level unlock password is not persisted; used only for in-memory decrypt/encrypt session.
- AI integration: Azure OpenAI chat endpoint support in browser.
- Confluence integration: no API sync yet; currently only deployment guidance text for Confluence embedding.
- Retrieval/search: no topic index, no shared retrieval metadata, no cross-topic semantic search.

## Existing Strengths Reused

- Proven in-Confluence rendering and interaction pattern.
- Browser-only deployment model compatible with HTML macro / iframe hosting.
- Encrypted credential persistence pattern already implemented and working.
- Token parameter fallback logic (`max_completion_tokens` vs `max_tokens`) already implemented for Azure chat compatibility.

## Gaps Against Product Goal

1. No domain model for topic/subtopic/landing-page governance.
2. No topic quality or granularity evaluation flow.
3. No shared Confluence registry persistence strategy.
4. No provider abstraction; Azure-focused flow dominates current UI.
5. No browser-local LLM/embedding default path.
6. No retrieval index metadata lifecycle and no traceable search UX.

## Brownfield Constraints

- Keep browser-first delivery style and avoid backend dependencies in first vertical slice.
- Preserve encrypted local credentials behavior and existing user expectation.
- Maintain compatibility with Confluence-hosted execution contexts.
