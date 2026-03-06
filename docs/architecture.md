# Rebar Architecture

## System Overview

Rebar is a capture-review-vault architecture with a single source of truth in PostgreSQL.

```text
User/Agent -> Capture APIs/UI -> SSOT DB -> Review Loop -> User
                               -> Export/MCP -> AI Consumers (read-only)
```

## High-Level Components

- Next.js app (App Router): pages, API routes, server actions
- Feature-local component decomposition (`app/(features)/*/_components`) for large UI surfaces
- Supabase Auth: session and identity
- Supabase PostgreSQL: records, sources, review logs, tags, ingest jobs, ingest provenance
- Extension client (`extension/`): clipping + authenticated save
- Export/MCP read interfaces for external tooling

## Data Model

### Core Tables

- `sources`: user-owned provenance objects for books/articles/manual/AI/service origins
- `records`: atomic captured units with immutable core content, current note, state, and scheduling fields
- `record_note_versions`: historical snapshots of replaced `records.current_note` values
- `record_ingest_events`: append-only import provenance (`import_channel`, source snapshot, note snapshot, external ids/anchors)
- `annotations`: additive notes/corrections/highlights per record
- `review_log`: append-only review events
- `tags`: user tags
- `record_tags`: many-to-many mapping
- `ingest_jobs`: failed ingest retry queue
- `user_preferences`: persisted per-user UI preferences (e.g. start page)

### Import Model

- `record` is the primary user-facing unit: the smallest thing worth re-reading
- `source` is distinct from `record` and captures shared provenance metadata
- Import paths (manual/CSV/JSON/share) normalize into the same ingest pipeline
- Highlight text is stored in `records.content`; paired note text is stored separately in `records.current_note`
- Replaced notes are preserved in `record_note_versions`
- Every ingest appends a `record_ingest_events` row so source/note snapshots remain recoverable

### Deduplication

- Dedup is source-aware, not global
- Effective identity is `user_id + source_id + content_hash`
- Same text from different sources creates different records
- Same text from the same source merges into the same record and can update the current note while preserving note history

### Record State Machine

Allowed states: `INBOX`, `ACTIVE`, `PINNED`, `ARCHIVED`, `TRASHED`

- `INBOX -> ACTIVE` on first review or manual activation
- `ACTIVE <-> PINNED`, `ACTIVE <-> ARCHIVED` by user action
- `* -> TRASHED` from any state (soft delete)

## API Surface

### Capture

- `POST /api/records`
- `POST /api/capture/extract`
- `POST /api/capture/ingest`
- `POST /api/capture/share`

### Review

- `GET /api/review/today`
- `POST /api/review/:id`
- `GET /api/review/history`

### Vault/Search/Export

- `GET|PATCH|DELETE /api/records/:id`
- `GET /api/records`
- `GET /api/search`
- `GET /api/export`
- `POST|GET|PATCH|DELETE /api/tags`

### Operations

- `GET|POST /api/ingest-jobs`
- `POST /api/ingest-jobs/retry`
- `POST /api/cron/ingest-jobs/retry`
- `POST /api/cron/records/cleanup`

### Settings

- `GET /api/settings/preferences`
- `PATCH /api/settings/preferences`

### MCP (Read-only)

- `GET /api/mcp`
- `POST /api/mcp` (`tools/list`, `tools/call`)

## Authentication and Security

- Bearer token auth for web app requests
- API key auth path is restricted to capture ingest flow (`/api/capture/ingest`) with explicit opt-in
- Cookie session path for same-site/browser clients (including extension flow)
- Shared origin validation utility for API proxy/auth checks
- Extension origin controls via env (`REBAR_ALLOWED_EXTENSION_IDS`, optional `REBAR_ALLOW_ALL_EXTENSION_ORIGINS`)
- URL extraction (`/api/capture/extract`) blocks non-http(s) schemes/internal hosts and enforces TOCTOU-resistant DNS checks (lookup-time IP validation + guarded redirects)
- Bulk mutation routes are rate-limited to reduce abuse and accidental overload
- Tag-filtered list/search/export paths validate tag ownership before lookup
- Timing-safe secret comparisons for auth/cron checks
- RLS on user-owned tables (`user_id = auth.uid()`)
- Localhost-only E2E/a11y auth bypass is gated by explicit env flags and strict loopback host validation (`localhost`, `127.0.0.1`, `::1` only)

## Extension Integration Architecture

- Popup/content/background scripts coordinate clip extraction and save
- Saves to `/api/capture/share` with authenticated browser session
- Includes retry handling for transient network/429 scenarios
- Options page provides base URL and connectivity validation

## Operational Notes

- Dedup uses SHA-256 `content_hash`, scoped by `source_id`
- Review scheduling uses interval progression with upper bound
- Retry and cleanup cron routes protect data consistency and lifecycle
- Export and search now include `records.current_note` alongside canonical content/source metadata
- `db/migrations/` is the migration source of truth; `db/schema.sql` is the current schema snapshot
- Quality gates include typecheck, test, lint, build, and pa11y-ci accessibility checks

## Near-Term Architecture Direction

- Strengthen search stack (FTS-first, optional semantic path)
- Keep batch ingest and retry processing efficient while preserving provenance/history fidelity
- Expand API/integration tests around high-risk routes
- Preserve simple, explicit ownership and state transition rules
