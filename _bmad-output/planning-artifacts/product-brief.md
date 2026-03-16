# Product Brief - Confluence Topic Knowledge System

Date: 2026-03-16

## Vision
Create a collaborative, topic-centric knowledge management application that uses Confluence as both human-facing map and machine-usable registry.

## Problem
Teams lose knowledge quality when pages become broad, overlapping, and weakly linked. Existing wiki structures often lack enforceable granularity and transparent retrieval metadata.

## Target Outcome
- Each topic is bounded and independently understandable.
- One topic maps to one Confluence landing page.
- Shared topic metadata and chunk manifests are visible in Confluence subpages.
- Semantic retrieval works across the shared topic network.
- Browser-local AI is default, Azure is optional.

## Users
- Knowledge engineers and product/domain experts
- Teams maintaining Confluence content collaboratively

## Success Metrics
- Time to create and sync a new topic to Confluence
- Ratio of topics passing granularity checks
- Search precision at top-k on shared topics
- Percentage of sessions using local-browser provider successfully

## Scope for this release
- Topic CRUD + hierarchy + quality assessment
- Confluence registry sync/import
- Provider abstraction with local-browser default and Azure optional
- Semantic index build and search UI with traceability
- Encrypted local credentials and state
