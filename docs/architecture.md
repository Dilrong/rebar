# Rebar Architecture

## System Overview

Rebar is a capture-review-vault architecture with a single source of truth in PostgreSQL.

```text
User/Agent -> Capture APIs/UI -> SSOT DB -> Review Loop -> User
                               -> Export/MCP -> AI Consumers (read-only)
```

## High-Level Components

- Next.js app (App Router): pages, API routes, server actions
- Supabase Auth: session and identity
- Supabase PostgreSQL: records, review logs, tags, ingest jobs
- Extension client (`extension/`): clipping + authenticated save
- Export/MCP read interfaces for external tooling

## Data Model

### Core Tables

- `records`: immutable core content + state + scheduling fields
- `annotations`: additive notes/corrections/highlights per record
- `review_log`: append-only review events
- `tags`: user tags
- `record_tags`: many-to-many mapping
- `ingest_jobs`: failed ingest retry queue

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

### MCP (Read-only)

- `GET /api/mcp`
- `POST /api/mcp` (`tools/list`, `tools/call`)

## Authentication and Security

- Bearer token auth for web app requests
- API key auth path is restricted to capture ingest flow (`/api/capture/ingest`) with explicit opt-in
- Cookie session path for same-site/browser clients (including extension flow)
- Shared origin validation utility for API proxy/auth checks
- Extension origin controls via env (`REBAR_ALLOWED_EXTENSION_IDS`, optional `REBAR_ALLOW_ALL_EXTENSION_ORIGINS`)
- URL extraction (`/api/capture/extract`) blocks non-http(s) schemes and internal/private hosts
- Bulk mutation routes are rate-limited to reduce abuse and accidental overload
- Tag-filtered list/search/export paths validate tag ownership before lookup
- Timing-safe secret comparisons for auth/cron checks
- RLS on user-owned tables (`user_id = auth.uid()`)

## Extension Integration Architecture

- Popup/content/background scripts coordinate clip extraction and save
- Saves to `/api/capture/share` with authenticated browser session
- Includes retry handling for transient network/429 scenarios
- Options page provides base URL and connectivity validation

## Operational Notes

- Dedup uses SHA-256 `content_hash`
- Review scheduling uses interval progression with upper bound
- Retry and cleanup cron routes protect data consistency and lifecycle

## Near-Term Architecture Direction

- Strengthen search stack (FTS-first, optional semantic path)
- Keep batch ingest and retry processing efficient
- Expand API/integration tests around high-risk routes
- Preserve simple, explicit ownership and state transition rules
