# Rebar — Architecture Document v2

## 프로젝트 개요

개인이 생산하거나 수집한 데이터(발췌, 메모, 링크, AI 대화 인사이트)를 단일 DB에 정규화해서 저장하고, 주기적으로 다시 마주치게 만드는 **개인용 SSOT 데이터 파이프라인**이다.

Readwise와 유사한 Capture → Review → Vault 플로우를 기반으로 하되, **Export/MCP를 통해 AI가 볼트를 읽어가는 구조**가 핵심 차별점이다.

**핵심 문제**: 데이터를 저장만 하면 뭐가 있는지 잊어버린다. 주기적 리뷰가 없으면 SSOT는 무용지물이다.

**인간 중심 원칙**: 캡처, 태깅, 리뷰, 정리 — 볼트의 모든 관리는 인간이 한다. AI 대화에서 인사이트를 얻으면 인간이 판단해서 볼트에 넣는다. AI는 Export/MCP를 통해 볼트를 **읽어가는 소비자**다.

```
사람 → [캡처] → SSOT (볼트) → [리뷰] → 사람
                    ↓
            [Export / MCP] → AI가 활용
```

**현재 사용자**: 개인(1인). 멀티테넌트 구조는 유지하되 지금은 단일 사용자로 운영.

---

## 설계 원칙

| 원칙 | 구체적 의미 |
|---|---|
| 단일 진실(SSOT) | 모든 데이터의 원본은 DB 하나. 파생 저장 없음 |
| 불변 원본 | `records.content`는 저장 후 절대 수정하지 않는다. 보강은 `annotations`로만 |
| 상태 머신 | 모든 Record는 명확한 상태를 가지며, 정의된 전이 규칙으로만 이동한다 |
| 마찰 최소화 | 리뷰 시 의사결정을 요구하지 않는다. 기본 동작만으로 흐름이 완성된다 |
| 인간 중심 | 캡처, 태깅, 리뷰, 정리 전부 사용자가 한다. 시스템은 무엇을 볼지 제안할 뿐이다 |
| AI는 소비자 | AI는 Export/MCP로 볼트를 읽어가는 소비자다. 볼트를 관리하거나 분류하지 않는다 |

---

## 기술 스택

| 레이어 | 선택 | 버전 | 비고 |
|---|---|---|---|
| Frontend | Next.js (App Router) | 16.x | SSR/SSG |
| Runtime | React | 19.x | RSC 지원 |
| Server State | TanStack Query v5 | 5.69 | 캐싱, 낙관적 업데이트 |
| Form | React Hook Form + Zod | 7.54 / 3.24 | 스키마를 API와 공유 |
| Auth | Supabase Auth | 2.49 | JWT, passwordless |
| DB | Supabase PostgreSQL | managed | RLS, pgvector 확장 가능 |
| Styling | Tailwind CSS | 3.4 | Industrial Brutalism 테마 |
| OCR | Tesseract.js | 7.0 | 클라이언트 사이드 텍스트 추출 |
| Deploy | Vercel | - | 서버리스 |
| Testing | Vitest | 4.0 | 유닛 테스트 |
| i18n | 커스텀 | - | Korean-first |

### Zod 스키마 공유 전략

`/lib/schemas.ts`에 Zod 스키마를 정의하고, API route와 React Hook Form 양쪽에서 동일하게 import해서 사용한다. 타입은 `z.infer<>`로 추출한다.

---

## 데이터 모델

### Record (현재)

모든 입력은 Record 하나로 정규화된다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | UUID | PK |
| `user_id` | UUID | FK → auth.users |
| `kind` | enum | `quote` \| `note` \| `link` \| `ai` |
| `content` | TEXT | 불변 원본 본문 |
| `content_hash` | TEXT | content의 SHA-256. 중복 캡처 방지 |
| `url` | TEXT? | 출처 URL (link, quote에서 사용) |
| `source_title` | TEXT? | 출처 제목 (책명, 기사 제목 등) |
| `state` | enum | 아래 상태 머신 참고 |
| `interval_days` | INTEGER | 현재 리뷰 주기 (일). 기본값 1 |
| `due_at` | TIMESTAMPTZ? | 다음 리뷰 예정 시각. 첫 캡처 시 NULL |
| `last_reviewed_at` | TIMESTAMPTZ? | 마지막 리뷰 시각 |
| `review_count` | INTEGER | 누적 리뷰 횟수. 기본값 0 |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | 상태 변경, 태그 변경 시 갱신 |

### Record 확장 필드 (v2 예정)

| 필드 | 타입 | 설명 |
|---|---|---|
| `source_author` | TEXT? | 저자명 (책/기사) |
| `content_type` | enum | `plain` \| `markdown` \| `html`. 기본 `plain` |
| `metadata` | JSONB? | 확장 메타데이터 (Readwise 원본 필드, 외부 소스 정보 등) |
| `embedding` | vector(1536)? | 콘텐츠 벡터 임베딩 (pgvector). 시맨틱 검색용 |

**kind별 필드 사용 규칙**

| kind | content | url | source_title |
|---|---|---|---|
| `quote` | 발췌 원문 | 출처 URL (선택) | 책명/기사명 (선택) |
| `note` | 내 생각 | - | - |
| `link` | URL 설명 또는 본문 요약 | 필수 | 페이지 제목 (선택) |
| `ai` | AI 산출물 원문 | - | 프롬프트/도구명 (선택) |

---

### 상태 머신

```
          캡처
           │
           ▼
         INBOX ──────────────────────────────→ TRASHED
           │                                      ▲
        사용자 활성화                               │
        (Library)                                 │
           ▼                                      │
         ACTIVE ──→ PINNED                        │
           │          │                           │
           └──────────┴──→ ARCHIVED ──→ ACTIVE    │
           │                                      │
           └──────────────────────────────────────┘
```

**상태 정의**

| 상태 | 의미 |
|---|---|
| `INBOX` | 아직 한 번도 리뷰하지 않은 신규 항목 |
| `ACTIVE` | 정기 리뷰 대상 |
| `PINNED` | 집중 리뷰 대상. ACTIVE보다 먼저 노출 |
| `ARCHIVED` | 리뷰 제외. 보관 상태 |
| `TRASHED` | 삭제 예정. 소프트 딜리트 |

**전이 규칙**

| 전이 | 트리거 | 비고 |
|---|---|---|
| `INBOX → ACTIVE` | 첫 리뷰 시 자동 전이 또는 Library에서 수동 활성화 | |
| `ACTIVE → PINNED` | 사용자 수동 | |
| `ACTIVE → ARCHIVED` | 사용자 수동 | |
| `PINNED → ACTIVE` | 사용자 수동 | |
| `PINNED → ARCHIVED` | 사용자 수동 | |
| `ARCHIVED → ACTIVE` | 사용자 수동 | |
| `* → TRASHED` | 사용자 수동 | 모든 상태에서 가능 |

---

## DB 스키마

현재 구현된 스키마. 상세는 `db/schema.sql` 참고.

**테이블 목록**:
- `records` — 핵심 엔터티
- `annotations` — 레코드 보강 (highlight, comment, correction)
- `review_log` — 리뷰 감사 로그 (append-only, 절대 UPDATE/DELETE 금지)
- `tags` — 사용자 태그
- `record_tags` — M:N 관계
- `ingest_jobs` — 비동기 인입 작업 큐 (PENDING/DONE/FAILED)

**보안**: 모든 테이블에 `user_id = auth.uid()` RLS 정책 적용.

**인덱스 전략**:
- `records_user_content_hash` (UNIQUE) — 중복 방지
- `records_user_state` — 상태별 필터링
- `records_due` (partial) — `state IN ('ACTIVE', 'PINNED')` 리뷰 대상 조회
- `records_user_created_at` — 시간순 정렬
- `review_log_record` — 레코드별 리뷰 이력
- `review_log_user_reviewed_at` — 사용자별 리뷰 타임라인

---

## 핵심 플로우

### 1. Capture (캡처)

**진입점**:
1. 웹 UI (`/capture`) — 수동 입력
2. URL 메타데이터 추출 (`POST /api/capture/extract`)
3. 배치 CSV/JSON 인입 (`POST /api/capture/ingest`)
4. 모바일 공유 페이지 (`/share`)
5. Chrome Extension — 하이라이트 & 아티클 스크래핑

**처리 흐름**:
1. 사용자/에이전트가 content, kind, url, source_title, tags 전달
2. SHA-256 해시 계산 → 중복 검사
3. 중복 시: 409 반환 또는 `on_duplicate=merge`로 병합
4. 신규 시: `INBOX` 상태, `interval_days=1`, `due_at=NULL`로 생성
5. 태그 생성/연결

**스마트 인입** (`lib/ingest.ts`):
- 외부 포맷 자동 해석: `content|text|highlight|note` 필드 자동 매핑
- URL 존재 여부로 `kind` 자동 추론
- 배치 최대 300건
- 태그 원자적 생성/연결

### 2. Review (리뷰)

**핵심 개념**: "외웠냐?"가 아니라 "다시 마주쳤냐?"다. 리뷰의 목적은 암기가 아니라 SSOT의 내용을 주기적으로 인식하는 것이다.

**리뷰 UI**:
```
┌─────────────────────────────────────┐
│  [Record 내용]                       │
│                                     │
│  [→ 확인]        [↩ 다시 보여줘]      │
│                                     │
│  스누즈: [1일] [3일] [7일]            │
└─────────────────────────────────────┘
```

| 버튼 | action | 의미 |
|---|---|---|
| 확인 (기본) | `reviewed` | 봤다. 다음 주기에 다시 보여줘 |
| 다시 보여줘 | `resurface` | 내일 또 보고 싶다 |

**인터벌 계산**:
```ts
const MAX_INTERVAL_DAYS = 90

function calcNextInterval(current: number, action: 'reviewed' | 'resurface'): number {
  if (action === 'resurface') return 1
  return Math.min(Math.round(current * 2), MAX_INTERVAL_DAYS)
}
// 인터벌: 1 → 2 → 4 → 8 → 16 → 32 → 64 → 90 → 90 → ...
```

**리뷰 완료 처리**:
1. `review_log`에 action 기록 (INSERT only)
2. `records` 업데이트: `interval_days`, `due_at = now() + interval`, `last_reviewed_at`, `review_count++`
3. `INBOX`였다면 → `ACTIVE`로 자동 전이

**오늘 리뷰 목록 쿼리**:
```sql
SELECT * FROM records
WHERE user_id = $1
  AND state IN ('ACTIVE', 'PINNED')
  AND due_at <= now()
ORDER BY
  CASE state WHEN 'PINNED' THEN 0 ELSE 1 END ASC,
  due_at ASC
LIMIT $2;
```

### 3. Library / Vault (보관함)

- 상태별 필터: INBOX, ACTIVE, PINNED, ARCHIVED, ALL
- kind별 필터: quote, note, link, ai
- 태그 필터, 키워드 검색
- 페이지네이션 (20건/페이지, 최대 100)
- 벌크 액션: 활성화, 핀, 아카이브, 삭제, 태그 관리
- Markdown 내보내기

### 4. Search (검색)

- 현재: ILIKE 기반 키워드 검색 (`content`, `source_title`)
- 필터: state, tag_id, 날짜 범위 (from/to)
- TRASHED 기본 제외

---

## API 명세

### Records

```
POST /api/records
  Body: { kind, content, url?, source_title?, tag_ids?: string[], on_duplicate?: "error"|"merge" }
  - content_hash 계산 후 중복이면 409 또는 병합
  - 201: 생성된 record 반환

GET /api/records
  Query: state?, kind?, tag_id?, q?, page?, limit?
  Response: { data: Record[], total: number }

GET /api/records/:id
  Response: { record: Record, annotations: Annotation[], tags: Tag[] }

PATCH /api/records/:id
  Body: { state?, tag_ids?, url?, source_title? }
  - content, kind, content_hash는 변경 불가
  - 상태 전이 규칙 위반 시 400

DELETE /api/records/:id
  → state를 TRASHED로 변경 (소프트 딜리트)
```

### Review

```
GET /api/review/today?n=20
  Response: { data: Record[], total: number }

POST /api/review/:id
  Body: { action: 'reviewed' | 'resurface', snooze_days?: number }
  Response: { record: Record }

GET /api/review/history
  Response: { data: ReviewLog[] }
```

### Annotations

```
POST /api/records/:id/annotations
  Body: { kind: 'highlight' | 'comment' | 'correction', body: string }

GET /api/records/:id/annotations
  Response: { data: Annotation[] }
```

### Search

```
GET /api/search?q=검색어&state?&tag_id?&from?&to?
  Response: { data: Record[] }
```

### Export

```
GET /api/export?format=markdown&state?&tag_id?
  Content-Type: text/markdown
  파일명: rebar-export-{YYYY-MM-DD}.md
```

### Capture (External Ingest)

```
POST /api/capture/extract
  Body: { url: string }
  → URL 메타데이터 추출 (title, description, image)

POST /api/capture/ingest
  Body: { items: ExternalItem[], default_kind?, default_tags? }
  Auth: x-rebar-ingest-key + x-user-id
  → 배치 인입 (최대 300건)

POST /api/capture/share
  Body: { content, title?, url?, kind?, tags? }
  → 단건 인입 (모바일/확장프로그램)

GET /api/capture/guide
  → 인입 포맷 가이드 (사용자/LLM 공용)
```

### Tags

```
POST /api/tags          — 태그 생성
GET /api/tags           — 태그 목록
PATCH /api/tags/:id     — 태그 이름 변경
DELETE /api/tags/:id    — 태그 삭제
```

### Ingest Jobs

```
GET /api/ingest-jobs    — 인입 작업 목록
POST /api/ingest-jobs   — 재시도 작업 생성
POST /api/ingest-jobs/retry — 실패 작업 재시도
```

---

## 인증 레이어

**이중 인증 구조** (`lib/auth.ts`):

| 방식 | 용도 | 헤더 |
|---|---|---|
| Bearer Token | 웹 UI (Supabase Auth) | `Authorization: Bearer <token>` |
| API Key | 외부 에이전트/익스텐션 | `x-rebar-ingest-key` + `x-user-id` |
| Dev Mode | 개발 환경 | `REBAR_DEV_USER_ID` env |

---

## Chrome Extension (MVP)

`extension/` 디렉토리. Manifest v3.

**기능**:
1. 선택 텍스트 저장 (하이라이트)
2. 아티클 콘텐츠 스크래핑 (article/main/content DOM 탐색)
3. 스마트 DOM 추출 (Medium, Velog, Naver, Tistory 등 블로그 플랫폼 대응)

**설정**: API Base URL, Ingest API Key, User ID, 기본 태그.

---

## 아키텍처 개선 계획

### Phase 1: 검색 고도화

**문제**: 현재 ILIKE 검색은 O(n) 풀스캔. 데이터가 수천 건만 돼도 성능 저하.

**해결**: PostgreSQL Full-Text Search + 벡터 검색 이중 구조.

#### 1-A. Full-Text Search (tsvector)

```sql
-- records 테이블에 tsvector 컬럼 추가
ALTER TABLE records ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(source_title, '')), 'A') ||
    setweight(to_tsvector('simple', content), 'B')
  ) STORED;

CREATE INDEX records_fts_idx ON records USING GIN (fts);
```

- `simple` 사전 사용 (한국어 호환. 형태소 분석 불필요한 키워드 매칭)
- `source_title`에 가중치 A, `content`에 가중치 B
- GIN 인덱스로 밀리초 단위 검색

**API 변경**:
```
GET /api/search?q=검색어
→ WHERE fts @@ plainto_tsquery('simple', $q)
   ORDER BY ts_rank(fts, query) DESC
```

#### 1-B. 벡터 검색 (pgvector)

```sql
-- Supabase에서 pgvector 활성화
CREATE EXTENSION IF NOT EXISTS vector;

-- 임베딩 컬럼 추가
ALTER TABLE records ADD COLUMN embedding vector(1536);
CREATE INDEX records_embedding_idx ON records
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

- 캡처 시 또는 비동기 잡으로 임베딩 생성
- 사용자가 볼트에서 유사 레코드를 찾는 검색 도구
- MCP를 통해 AI가 볼트를 검색할 때도 활용

**새 API**:
```
GET /api/search/semantic?q=자연어 질문&limit=10
POST /api/records/:id/similar?limit=5
```

---

### Phase 2: 연결 그래프 + 데이터 모델 확장

사용자가 레코드 간 관계를 직접 만들고 탐색할 수 있는 도구.

#### 2-A. 연결 그래프 (Connected Notes)

```sql
-- 레코드 간 관계 테이블
CREATE TABLE record_links (
  source_id UUID NOT NULL REFERENCES records ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES records ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('similar', 'related', 'references')),
  score     REAL,           -- 유사도 점수 (벡터 기반)
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, target_id, link_type)
);
```

- 사용자가 수동으로 레코드 간 연결 생성
- 벡터 유사도 검색 결과에서 "이 레코드와 연결" 액션 제공
- 리뷰 시 연결된 레코드 패널 표시

---

### Phase 3: 외부 연동 / MCP

#### 3-A. MCP (Model Context Protocol) 서버

AI 어시스턴트가 볼트 데이터를 **읽어가는** 인터페이스. 볼트의 관리(태깅, 상태 변경, 삭제)는 MCP로 노출하지 않는다.

**제공 도구**:
```
rebar_search(query, filters?)    → 볼트 검색 (읽기 전용)
rebar_get(id)                    → 레코드 상세 조회
rebar_today()                    → 오늘 리뷰 목록 조회
```

캡처는 기존 Ingest API(`POST /api/capture/ingest`)를 사용. AI 대화에서 인사이트를 얻은 인간이 판단해서 볼트에 넣는 흐름.

**구현 방식**: `@modelcontextprotocol/sdk`로 HTTP 서버 또는 stdio 서버 구현.

#### 3-B. Webhook / Event System

```
Record 생성 → webhook 발송 (URL, payload)
Record 상태 변경 → webhook 발송
리뷰 완료 → webhook 발송
```

- 사용자 설정에서 webhook URL 등록
- n8n, Zapier, Make 등 자동화 도구 연동 가능

#### 3-C. Export 확장

| 형식 | 상태 | 비고 |
|---|---|---|
| Markdown | 구현 완료 | |
| Obsidian | v2 예정 | vault 폴더 구조 + YAML frontmatter |
| Notion API | v3 예정 | 데이터베이스 연동 |
| JSON-LD | v3 예정 | 구조화 데이터, AI 학습 소스 |

---

### Phase 4: 인프라 강화

#### 4-A. 검색 인덱스 → tsvector 마이그레이션

ILIKE → tsvector 전환. Phase 1-A 참고.

#### 4-B. Cursor 기반 페이지네이션

현재 offset 방식은 대량 데이터에서 느려진다.

```
GET /api/records?cursor=<last_id>&limit=20
→ WHERE id < $cursor ORDER BY id DESC LIMIT $limit
```

#### 4-C. Ingest 배치 최적화

현재 `processIngest`가 N+1 쿼리 (아이템마다 개별 INSERT).

**개선**: Supabase `.insert()` 배치 사용 + 해시 충돌은 `ON CONFLICT DO NOTHING`으로 처리.

```ts
// Before (N+1)
for (const item of items) {
  await supabase.from("records").insert(item).select("id").single()
}

// After (batch)
const rows = items.map(toRecordRow)
const { data } = await supabase.from("records").insert(rows).select("id")
```

#### 4-D. 백그라운드 잡 프로세서

`ingest_jobs` 테이블이 존재하지만 실제 워커가 없다.

**옵션**:
1. Vercel Cron (`vercel.json` cron job → API route 호출)
2. Supabase Edge Function (pg_cron 트리거)
3. 외부 워커 (BullMQ + Redis) — 오버킬일 가능성

**권장**: Vercel Cron으로 시작. 5분마다 `POST /api/ingest-jobs/process` 호출.

#### 4-E. TRASHED 자동 정리

```sql
-- 30일 이상 된 TRASHED 레코드 하드 딜리트
DELETE FROM records
WHERE state = 'TRASHED'
  AND updated_at < now() - interval '30 days';
```

Vercel Cron으로 일 1회 실행.

#### 4-F. Rate Limiting

```ts
// Vercel Edge Middleware 또는 API route 내 간단한 구현
// IP 기반 또는 API key 기반 제한
// 기본: 60 req/min (인증), 10 req/min (비인증)
```

---

## 리뷰 로직 개선 방향

### 현재: 단순 배수 인터벌

`1 → 2 → 4 → 8 → 16 → 32 → 64 → 90`

### 개선안: 적응형 인터벌

사용자의 리뷰 행동 데이터를 반영한 스케줄링. 사용자가 직접 판단한 결과(reviewed/resurface)만 신호로 사용한다.

| 신호 | 영향 |
|---|---|
| resurface 빈도 높음 | 인터벌 증가 속도 낮춤 |
| annotation 추가 | 관심도 높음 → 인터벌 약간 단축 |
| 같은 태그 레코드 resurface 패턴 | 태그 전체 인터벌 조정 |
| 오래 리뷰 안 된 PINNED | 자동 리마인더 |

**구현 시기**: Phase 2 이후. 충분한 review_log 데이터 축적 후. AI 판단이 아닌 사용자 행동 기반.

---

## 데이터 모델 확장 스키마 (v2)

기존 스키마에 추가할 마이그레이션.

```sql
-- Phase 1: 검색 강화
ALTER TABLE records ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('simple', coalesce(source_title, '')), 'A') ||
    setweight(to_tsvector('simple', content), 'B')
  ) STORED;
CREATE INDEX records_fts_idx ON records USING GIN (fts);

-- Phase 1: 벡터 검색 (pgvector 확장 필요)
CREATE EXTENSION IF NOT EXISTS vector;
ALTER TABLE records ADD COLUMN embedding vector(1536);
CREATE INDEX records_embedding_idx ON records
  USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Phase 2: 데이터 모델 확장
ALTER TABLE records ADD COLUMN source_author TEXT;
ALTER TABLE records ADD COLUMN content_type TEXT NOT NULL DEFAULT 'plain'
  CHECK (content_type IN ('plain', 'markdown', 'html'));
ALTER TABLE records ADD COLUMN metadata JSONB DEFAULT '{}';

-- Phase 2: 레코드 연결
CREATE TABLE record_links (
  source_id UUID NOT NULL REFERENCES records ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES records ON DELETE CASCADE,
  link_type TEXT NOT NULL CHECK (link_type IN ('similar', 'related', 'references')),
  score REAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (source_id, target_id, link_type)
);
ALTER TABLE record_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY record_links_owner_policy ON record_links
USING (
  EXISTS (SELECT 1 FROM records r WHERE r.id = record_links.source_id AND r.user_id = auth.uid())
)
WITH CHECK (
  EXISTS (SELECT 1 FROM records r WHERE r.id = record_links.source_id AND r.user_id = auth.uid())
);

-- Phase 3: Webhook 설정
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL DEFAULT '{}',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY webhooks_owner_policy ON webhooks
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
```

---

## 페이지 라우트

| Route | 용도 |
|---|---|
| `/` | 랜딩/인증 리다이렉트 |
| `/signup` | 회원가입 |
| `/capture` | 수동 캡처 + CSV 임포트 |
| `/review` | 데일리 리뷰 카드 |
| `/review/history` | 리뷰 감사 로그 타임라인 |
| `/library` | 볼트 (필터, 검색, 벌크 액션) |
| `/records/:id` | 레코드 상세 + annotations |
| `/search` | 고급 검색 |
| `/settings` | 사용자 설정 |
| `/share` | 모바일 퀵 공유 |

---

## 구현 로드맵

### MVP (완료)

- [x] Supabase 환경 설정 (Auth, DB Schema, RLS)
- [x] Capture — 웹 UI 입력 + CSV/JSON 배치 인입
- [x] Daily Review — 카드 뷰 (확인/다시 보여줘 + 스누즈)
- [x] Library — 상태/태그/kind 필터 + 키워드 검색
- [x] Record Detail — 원본 + annotations
- [x] Search — 키워드 + 필터 (state/tag/date)
- [x] Export — Markdown
- [x] Chrome Extension — 하이라이트, 아티클 스크래핑
- [x] 인입 재시도 큐 (ingest_jobs)
- [x] 중복 병합 플로우

### Phase 1: 검색 고도화

- [ ] tsvector 컬럼 + GIN 인덱스 마이그레이션
- [ ] 검색 API를 tsquery 기반으로 전환
- [ ] pgvector 확장 활성화 + embedding 컬럼
- [ ] 캡처 시 임베딩 생성 (비동기)
- [ ] 시맨틱 검색 API (`/api/search/semantic`)
- [ ] "비슷한 레코드" API (`/api/records/:id/similar`)

### Phase 2: 연결 그래프 + 데이터 모델 확장

- [ ] records 테이블 확장 (source_author, content_type, metadata)
- [ ] record_links 테이블 + 사용자 수동 연결 UI
- [ ] 리뷰 UI에 연결된 레코드 패널
- [ ] 적응형 리뷰 인터벌 (review_log 분석)

### Phase 3: 외부 연동

- [ ] MCP 서버 (검색, 캡처, 조회)
- [ ] Webhook 시스템 (레코드 이벤트)
- [ ] Obsidian Export (vault 구조 + frontmatter)
- [ ] Notion API 연동

### Phase 4: 인프라

- [ ] Cursor 기반 페이지네이션
- [ ] Ingest 배치 최적화 (N+1 제거)
- [ ] 백그라운드 잡 프로세서 (Vercel Cron)
- [ ] TRASHED 자동 정리 (30일)
- [ ] Rate limiting
- [ ] 리뷰 통계 대시보드

### 코드 품질 개선 (Phase 무관)

구체적인 버그, 보안, 성능, UX 개선 사항은 `docs/improvements.md` 참고.
우선순위 S(버그) → A(성능/보안) → B(코드품질) → C(UX) → D(테스트) → E(인프라).
