# Epics and Stories (Implementation-Ready)

Date: 2026-03-16

## Epic 1: Topic-Centric Knowledge Backbone
Goal: Introduce a governed topic model with quality checks and hierarchy support.
Business Value: Teams create reusable, bounded knowledge units instead of ambiguous pages.

### Story 1.1 - Topic Domain Model and Validation
Goal: Implement topic schema, validation, and metadata shape.
Business Value: Reliable and consistent topic data across UI, sync, and retrieval.
Acceptance Criteria:
- Topic requires title, summary, and one source page ID.
- Parent-child relation supports hierarchies.
- Topic quality object stores score/reasons/split suggestions.
Dependencies: none.
Definition of Done:
- domain module created, used by UI, unit tests for validation paths.

### Story 1.2 - Granularity Assessment and Split Suggestions
Goal: Add AI-assisted and heuristic topic broadness checks.
Business Value: Prevent oversized topics and improve knowledge maintainability.
Acceptance Criteria:
- User can run assessment per topic.
- Result contains score, reasons, and split recommendations.
- If provider unavailable, heuristic fallback still works.
Dependencies: Story 1.1, Provider abstraction.
Definition of Done:
- Assessment flow wired in topic form and persisted.

## Epic 2: Confluence Shared Registry
Goal: Persist topic registry in Confluence subpages under configured root.
Business Value: Shared map visible to humans and machines.

### Story 2.1 - Confluence Config + Auth Layer
Goal: Add Confluence base URL, root page ID, and auth config.
Business Value: Teams can connect app to shared Confluence space.
Acceptance Criteria:
- Basic (email+token) and Bearer PAT supported.
- Config encrypted in local storage.
- Health check validates root page access.
Dependencies: Security storage.
Definition of Done:
- Confluence service module and health UI status.

### Story 2.2 - Topic Page Upsert and Metadata Embedding
Goal: Create/update topic subpages with embedded JSON metadata.
Business Value: Registry remains both readable and machine-parseable.
Acceptance Criteria:
- Create topic page under root when missing.
- Update existing page with incremented version.
- Metadata includes topic and chunk manifest.
Dependencies: Story 1.x, Story 2.1.
Definition of Done:
- Sync button persists topics to Confluence.

### Story 2.3 - Registry Import from Confluence
Goal: Pull topic pages and rebuild local topic list.
Business Value: Shared updates become available to all users.
Acceptance Criteria:
- Import fetches child pages from root.
- Metadata parser reconstructs topic objects.
- Invalid pages are skipped with warning.
Dependencies: Story 2.2.
Definition of Done:
- Import action updates local state and status log.

## Epic 3: Provider Abstraction (Local Default, Azure Optional)
Goal: Decouple domain logic from model hosting.
Business Value: Privacy-first local operation with optional cloud fallback.

### Story 3.1 - Provider Interface and Manager
Goal: Define generation/embedding/health/capability interface.
Business Value: Future provider additions without domain/UI rewrites.
Acceptance Criteria:
- Active provider switch in settings.
- Domain services use provider manager only.
Dependencies: none.
Definition of Done:
- Shared provider contract implemented by local and azure adapters.

### Story 3.2 - Local Browser Provider (Default)
Goal: Browser-local generation and embeddings tuned for German use.
Business Value: Data locality and reduced cloud dependency.
Acceptance Criteria:
- Local provider default at first load.
- Embedding model and generation model configurable.
- Model load status visible in UI.
Dependencies: Story 3.1.
Definition of Done:
- End-to-end topic assessment and search work with local provider.

### Story 3.3 - Azure Optional Provider
Goal: Keep Azure chat/embedding as optional provider path.
Business Value: Enterprise fallback and controlled hosted scaling.
Acceptance Criteria:
- Azure config and health check in settings.
- Generation + embeddings supported.
- Provider context shown in results.
Dependencies: Story 3.1.
Definition of Done:
- End-to-end topic assessment and search work with Azure provider.

## Epic 4: Retrieval and Search Transparency
Goal: Build transparent search across shared topic network.
Business Value: Fast discovery with explainable provenance.

### Story 4.1 - Local Index Build from Topic Chunks
Goal: Build local vector index from topic chunk registry.
Business Value: Fast semantic retrieval with shared metadata backbone.
Acceptance Criteria:
- Chunk manifests generated per topic.
- Embeddings computed with active provider.
- Index metadata includes provider/model/build timestamp.
Dependencies: Story 1.1, Story 3.x.
Definition of Done:
- Rebuild index action and status metrics added.

### Story 4.2 - Search UX with Traceability
Goal: Provide search results with topic/page/snippet/context.
Business Value: Users trust and reuse team knowledge faster.
Acceptance Criteria:
- Results show topic title, Confluence page link, chunk snippet.
- Results show provider context and score.
- Empty/no-index states handled clearly.
Dependencies: Story 4.1.
Definition of Done:
- Search tab usable end-to-end.

## Epic 5: Security, Compatibility, and Hardening
Goal: Preserve and improve encrypted credential handling.
Business Value: Safe credential UX without breaking existing users.

### Story 5.1 - Encrypted State Compatibility and Migration
Goal: Preserve compatibility with existing encrypted storage shape where feasible.
Business Value: Existing users do not lose settings.
Acceptance Criteria:
- Legacy encrypted shape migration supported.
- Old insecure keys cleaned up.
- Password never persisted.
Dependencies: none.
Definition of Done:
- Unlock flow handles old and new state robustly.

### Story 5.2 - Automated Tests and Dev Notes
Goal: Add deterministic tests and concise maintainers docs.
Business Value: Reduced regressions and easier contributor onboarding.
Acceptance Criteria:
- Domain/retrieval tests run via `node --test`.
- Architecture/provider documentation updated.
Dependencies: all epics.
Definition of Done:
- Test command passes locally and docs reflect shipped architecture.
