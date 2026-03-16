# Domain Model Deepening (Knowledge Management on Confluence)

Date: 2026-03-16

## Core Concepts

## Topic
A bounded, independently understandable knowledge unit.

Mandatory fields:
- `id` (stable UUID)
- `title`
- `summary`
- `scopeNotes`
- `parentTopicId` (nullable)
- `sourcePageId` (Confluence source behind landing page)
- `landingPageId` (Confluence page ID created/linked by app)
- `tags[]`
- `quality` (score, broadness reasons, split suggestions)

## Subtopic
A topic with a non-null `parentTopicId`. Subtopics inherit context from parent but remain independently understandable.

## Landing Page
Primary Confluence page for exactly one topic. Human-readable page that also embeds machine-readable metadata.

Rule: `1 topic = 1 primary landing page`.

## Confluence Source Page
The underlying authoritative source page (or same as landing page) from which topic content is derived or verified.

## Application Root Page
Configured Confluence page ID under which topic subpages are managed.

## Knowledge Registry
Shared registry represented by Confluence topic subpages plus embedded metadata blocks.

## Topic Quality / Granularity
Quality dimensions:
- scope tightness
- conceptual cohesion
- standalone readability
- overlap with existing topics

Broad-topic detection signals:
- too many conjunction domains in title/scope
- excessive unique noun phrases
- multi-process descriptions bundled together
- high overlap scores with multiple existing topics

## Duplicate / Overlap Handling
- lexical similarity and embedding similarity against existing topics
- hard duplicate threshold (merge suggestion)
- medium overlap threshold (split/relink suggestion)

## Retrieval Unit
Chunk derived from topic fields:
- title
- summary
- scopeNotes
- tags/context snippets

Chunk metadata:
- `chunkId`
- `topicId`
- `text`
- `hash`
- `sourcePageId`
- `landingPageId`

## Index Metadata
- `indexVersion`
- `provider`
- `embeddingModel`
- `builtAt`
- `chunkCount`
- `chunkRegistry[]`

Confluence stores canonical chunk metadata manifest (not raw vector binaries).

## Shared Benefit Model
- Topic registry and chunk metadata are shared via Confluence pages.
- Credentials remain per-user and encrypted locally.
- Search benefits increase as team contributes topics/chunks.

## Provider Configuration
Provider mode:
- `local-browser` (default)
- `azure` (optional)

Provider capabilities:
- generation
- embeddings
- health/capability checks

Operational difference:
- local-browser: privacy-forward, high first-load cost, offline-ish potential
- azure: network dependency, lower client load, optional fallback
