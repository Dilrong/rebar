# Rebar

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

Legacy fallback is supported:

- `SUPABASE_SERVICE_ROLE_KEY`

3. Install and run

```bash
npm install
npm run dev
```

## Pages

- `/capture`
- `/review`
- `/review/history`
- `/library`
- `/records/:id`
- `/search`
- `/settings`
- `/signup`

## API

- `POST/GET /api/records`
- `GET/PATCH/DELETE /api/records/:id`
- `POST/GET /api/records/:id/annotations`
- `GET /api/review/today`
- `POST /api/review/:id`
- `GET /api/review/history`
- `GET /api/search?q=...`
- `GET /api/export?format=markdown`
- `GET/POST /api/tags`
- `PATCH/DELETE /api/tags/:id`
- `POST /api/capture/extract` (url 메타데이터 가져오기)
- `POST /api/capture/ingest` (JSON/CSV/agent 배치 인입)
- `POST /api/capture/share` (공유형 단건 인입: 카카오/텔레그램 등)
- `GET /api/capture/guide` (사용자/LLM 공용 JSON 가이드)

## External Ingest (Free)

Use only free integrations by sending payloads to the ingest endpoints.

- Human/LLM guide: `GET /api/capture/guide`

```bash
curl -X POST "http://localhost:3000/api/capture/share" \
  -H "x-rebar-ingest-key: <REBAR_INGEST_API_KEY>" \
  -H "x-user-id: <USER_UUID>" \
  -H "content-type: application/json" \
  -d '{"content":"공유 텍스트","title":"공유 제목","url":"https://example.com"}'
```
