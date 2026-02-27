# Rebar

개인용 SSOT 데이터 파이프라인. Readwise와 유사한 Capture → Review → Vault 플로우에 AI 보강과 벡터 검색을 결합한 개인 지식 볼트.

## Quick Start

1. Copy env template

```bash
cp .env.example .env.local
```

2. Fill Supabase values in `.env.local`

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY` (recommended)
- `REBAR_INGEST_API_KEY` (external agent/webhook ingest key)
- `REBAR_CRON_SECRET` (Vercel Cron protection key)

Legacy fallback is supported:

- `SUPABASE_SERVICE_ROLE_KEY`

3. Install and run

```bash
pnpm install
pnpm dev
```

## Architecture

상세 아키텍처는 `docs/rebar-architecture.md` 참고.

**핵심 플로우**:
```
사람/에이전트 → [캡처] → DB (SSOT) → [리뷰] → 사람
```

**설계 원칙**:
- 불변 원본 (content는 수정 불가, annotations로 보강)
- 상태 머신 (INBOX → ACTIVE → PINNED/ARCHIVED/TRASHED)
- SHA-256 기반 중복 방지
- Zod 스키마 API/프론트 공유

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router) + React 19 |
| State | TanStack Query v5 |
| Form | React Hook Form + Zod |
| Auth/DB | Supabase (Auth + PostgreSQL + RLS) |
| Styling | Tailwind CSS (Industrial Brutalism) |
| Deploy | Vercel |
| Test | Vitest |

## Pages

| Route | Purpose |
|---|---|
| `/capture` | Manual capture + CSV/JSON import |
| `/review` | Daily review cards |
| `/review/history` | Review audit log |
| `/library` | Vault with filters |
| `/records/:id` | Record detail + annotations |
| `/search` | Advanced search |
| `/settings` | User preferences |
| `/share` | Mobile-first quick share |

## API

### Records
- `POST /api/records` — Create (with dedup)
- `GET /api/records` — List (state/kind/tag/keyword filters, pagination, cursor)
- `GET /api/records/:id` — Detail + annotations + tags
- `PATCH /api/records/:id` — Update state/tags/url
- `DELETE /api/records/:id` — Soft delete (→ TRASHED)

### Review
- `GET /api/review/today?n=20` — Today's review batch
- `POST /api/review/:id` — Submit review action
- `GET /api/review/history` — Review audit log (offset + cursor)

### Annotations
- `POST /api/records/:id/annotations` — Add annotation
- `GET /api/records/:id/annotations` — List annotations

### Search & Export
- `GET /api/search?q=...&state=&tag_id=&from=&to=&cursor=&semantic=1` — Full-text/semantic-ready search
- `GET /api/export?format=markdown|obsidian&state=&tag_id=` — Markdown/Obsidian export

### Capture (External Ingest)
- `POST /api/capture/extract` — URL metadata extraction
- `POST /api/capture/ingest` — Batch ingest (JSON/CSV, max 300 items)
- `POST /api/capture/share` — Single item capture (mobile/extension)
- `GET /api/capture/guide` — Ingest format guide (human/LLM)

### Tags
- `POST /api/tags` / `GET /api/tags` / `PATCH /api/tags/:id` / `DELETE /api/tags/:id`

### Ingest Jobs
- `GET /api/ingest-jobs` — List jobs
- `POST /api/ingest-jobs` — Create retry job
- `POST /api/ingest-jobs/retry` — Retry failed jobs

### Cron (Server-side)
- `POST /api/cron/ingest-jobs/retry` — Automatic retry processor (protected by `REBAR_CRON_SECRET`)
- `POST /api/cron/records/cleanup` — Hard-delete stale TRASHED records after 30 days

### MCP (Read-only)
- `GET /api/mcp` — MCP capability descriptor
- `POST /api/mcp` — `tools/list`, `tools/call` (`records.list`, `records.get`, `records.search`)

## External Ingest

Use only free integrations by sending payloads to the ingest endpoints.

- Human/LLM guide: `GET /api/capture/guide`

### Readwise CSV import

Capture > CSV import supports Readwise export columns:
`Highlight`, `Book Title`, `Book Author`, `Note`, `Tags`, `Highlighted at`

Preview shows total rows, importable rows, and Readwise format detection.

## Chrome Extension (MVP)

- Path: `extension/`
- Guide: `docs/chrome-extension.md`
- Supports: highlight/article clipping, opens authenticated `/share` auto-save flow

Extension no longer requires per-user API key/user ID input. It forwards clips to `/share` and relies on your normal REBAR login session.

## Docs

- `docs/rebar-architecture.md` — Full architecture + roadmap
- `docs/improvements.md` — 구체적 개선 사항 (버그, 성능, 보안, UX)
- `docs/design_system.md` — Industrial Brutalism design specs
- `docs/chrome-extension.md` — Extension setup guide
