# Rebar Project Context

## What Rebar Is

Rebar is a personal SSOT knowledge pipeline that turns captured data into a long-term review loop.

- Core loop: Capture -> SSOT DB -> Review -> Vault
- Differentiator: Export and MCP read access for AI consumers
- User model: single personal user now, multi-tenant-compatible structure

## Product Principles

- Human-centered vault operations: users decide capture, tagging, review, and organization
- AI as consumer: AI reads via Export/MCP, does not manage vault state
- Immutable source: `records.content` is never edited after creation
- Explicit state machine: records move by defined transitions only
- Low-friction review: simple actions, repeatable daily flow

## Current Scope

- Web app capture (`/capture`) + external ingest (`/api/capture/ingest`, `/api/capture/share`)
- Daily review flow (`/review`, `/api/review/*`)
- Vault/library management (`/library`, `/records/:id`, tags, filters)
- Search and export (`/search`, `/api/search`, `/api/export`)
- Chrome extension clipping path (`extension/`)

## Tech Stack

- Frontend: Next.js App Router + React
- Server state: TanStack Query
- Validation: Zod (shared schemas)
- Auth/DB: Supabase Auth + PostgreSQL + RLS
- Styling: Tailwind CSS (Industrial Brutalism direction)
- Tests: Vitest + pa11y-ci accessibility audit
- Deploy: Vercel

## Key Domain Concepts

- `Record`: canonical captured unit (`quote | note | link | ai`)
- `Annotation`: additive enrichment for immutable records
- `ReviewLog`: append-only review audit trail
- `Tag` and `RecordTag`: user-owned taxonomy
- `IngestJob`: retry queue for asynchronous ingest operations

## Current Priorities

- Keep capture and review reliability high
- Preserve human-centered workflow (no automatic AI curation)
- Continue improving performance/security/UX in incremental rounds
- Maintain extension-to-web auth and capture stability

## Document Map

- Architecture details: `docs/architecture.md`
- Session progress and action history: `docs/session_context.md`
