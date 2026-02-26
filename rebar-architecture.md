# Rebar — Architecture Document

## 프로젝트 개요

개인이 생산하거나 수집한 데이터(발췌, 메모, 링크, AI 산출물)를 단일 DB에 정규화해서 저장하고, 주기적으로 다시 마주치게 만드는 **개인용 SSOT 데이터 파이프라인**이다.

**핵심 문제**: 데이터를 저장만 하면 뭐가 있는지 잊어버린다. 주기적 리뷰가 없으면 SSOT는 무용지물이다.

**인간 중심 원칙**: 관리 주체는 항상 사용자다. 자동화는 보조 수단에 그쳐야 한다.

```
사람 → [캡처] → 단일 DB (SSOT) → [리뷰] → 사람
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
| 인간 중심 | 결정은 사람이 한다. 시스템은 무엇을 볼지 제안할 뿐이다 |

---

## 데이터 모델

### Record

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
| `INBOX → ACTIVE` | Library INBOX 탭에서 사용자가 수동으로 활성화 | |
| `ACTIVE → PINNED` | 사용자 수동 | |
| `ACTIVE → ARCHIVED` | 사용자 수동 | |
| `ACTIVE → TRASHED` | 사용자 수동 | |
| `PINNED → ACTIVE` | 사용자 수동 | |
| `PINNED → ARCHIVED` | 사용자 수동 | |
| `ARCHIVED → ACTIVE` | 사용자 수동 | |
| `* → TRASHED` | 사용자 수동 | 모든 상태에서 가능 |

---

## DB 스키마 (SQL)

```sql
-- records
CREATE TABLE records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind             TEXT NOT NULL CHECK (kind IN ('quote', 'note', 'link', 'ai')),
  content          TEXT NOT NULL,
  content_hash     TEXT NOT NULL,
  url              TEXT,
  source_title     TEXT,
  state            TEXT NOT NULL DEFAULT 'INBOX'
                   CHECK (state IN ('INBOX', 'ACTIVE', 'PINNED', 'ARCHIVED', 'TRASHED')),
  interval_days    INTEGER NOT NULL DEFAULT 1,
  due_at           TIMESTAMPTZ,
  last_reviewed_at TIMESTAMPTZ,
  review_count     INTEGER NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX records_user_content_hash ON records (user_id, content_hash);
CREATE INDEX records_user_state ON records (user_id, state);
CREATE INDEX records_due ON records (user_id, due_at) WHERE state IN ('ACTIVE', 'PINNED');

-- annotations
CREATE TABLE annotations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id   UUID NOT NULL REFERENCES records ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('highlight', 'comment', 'correction')),
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- review_log (append-only, 절대 UPDATE/DELETE 하지 않는다)
CREATE TABLE review_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  record_id   UUID NOT NULL REFERENCES records ON DELETE CASCADE,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  action      TEXT NOT NULL CHECK (action IN ('reviewed', 'resurface'))
);

CREATE INDEX review_log_record ON review_log (record_id, reviewed_at DESC);

-- tags
CREATE TABLE tags (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name    TEXT NOT NULL,
  UNIQUE (user_id, name)
);

-- record_tags
CREATE TABLE record_tags (
  record_id UUID NOT NULL REFERENCES records ON DELETE CASCADE,
  tag_id    UUID NOT NULL REFERENCES tags ON DELETE CASCADE,
  PRIMARY KEY (record_id, tag_id)
);
```

**RLS 정책**: 모든 테이블에 `user_id = auth.uid()` 조건의 RLS를 활성화한다. 사용자는 자신의 데이터만 접근 가능하다.

---

## 리뷰 로직

### 핵심 개념

"외웠냐?"가 아니라 "다시 마주쳤냐?"다. 리뷰의 목적은 암기가 아니라 SSOT의 내용을 주기적으로 인식하는 것이다.

### 리뷰 UI

```
┌─────────────────────────────────────┐
│  [Record 내용]                       │
│                                     │
│  [→ 확인]        [↩ 다시 보여줘]      │
└─────────────────────────────────────┘
```

| 버튼 | action | 의미 |
|---|---|---|
| 확인 (기본) | `reviewed` | 봤다. 다음 주기에 다시 보여줘 |
| 다시 보여줘 | `resurface` | 내일 또 보고 싶다 |

### 인터벌 계산

```ts
const MAX_INTERVAL_DAYS = 90

function calcNextInterval(current: number, action: 'reviewed' | 'resurface'): number {
  if (action === 'resurface') return 1
  return Math.min(Math.round(current * 2), MAX_INTERVAL_DAYS)
}

// 인터벌 예시 (reviewed 연속 시)
// 1 → 2 → 4 → 8 → 16 → 32 → 64 → 90 → 90 → ...
```

### 리뷰 완료 처리 흐름

```
1. review_log에 action 기록 (INSERT, 절대 UPDATE 없음)
2. records 업데이트:
   - interval_days = calcNextInterval(...)
   - due_at = now() + interval_days
   - last_reviewed_at = now()
   - review_count += 1
   - state: INBOX였다면 → ACTIVE로 전이
3. 응답 반환
```

### 오늘 리뷰 목록 쿼리

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

PINNED가 항상 먼저 노출된다.

---

## API 명세

### Records

```
POST /api/records
  Body: { kind, content, url?, source_title?, tag_ids?: string[] }
  - content_hash 계산 후 중복이면 409 반환
  - 성공 시 생성된 record 반환

GET /api/records
  Query: state?, kind?, tag_id?, q?(키워드 검색), page?, limit?
  Response: { data: Record[], total: number }

GET /api/records/:id
  Response: { record: Record, annotations: Annotation[], tags: Tag[] }

PATCH /api/records/:id
  Body: { state?, tag_ids?, url?, source_title? }
  - content, kind, content_hash는 변경 불가
  - 상태 전이 규칙 위반 시 400 반환

DELETE /api/records/:id
  → state를 TRASHED로 변경 (소프트 딜리트)
```

### Review

```
GET /api/review/today?n=20
  Response: { data: Record[], total: number }
  - due_at <= now(), state IN ('ACTIVE', 'PINNED')
  - PINNED 우선 정렬

POST /api/review/:id
  Body: { action: 'reviewed' | 'resurface' }
  Response: { record: Record }
  처리 흐름: 위 "리뷰 완료 처리 흐름" 참고
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
GET /api/search?q=검색어
  - records.content, source_title 대상 ILIKE 검색
  - TRASHED 제외
  Response: { data: Record[] }
```

### Export

```
GET /api/export?format=markdown&state?&tag_id?
  - 현재 지원: markdown
  - Content-Type: text/markdown
  - 파일명: rebar-export-{YYYY-MM-DD}.md
```

**Markdown Export 형식**

```markdown
# Rebar Export — 2026-02-26

## {source_title or kind} ({created_at})

{content}

Tags: #tag1 #tag2
URL: {url}

---
```

---

## 기술 스택

| 레이어 | 선택 | 비고 |
|---|---|---|
| Frontend | Next.js 14+ (App Router) | |
| Server State | TanStack Query v5 | 캐싱, 낙관적 업데이트 |
| Form | React Hook Form + Zod | 스키마를 API와 공유 |
| Auth | Supabase Auth | |
| DB | Supabase PostgreSQL | RLS 필수 |
| Deploy | Vercel | |

### Zod 스키마 공유 전략

`/lib/schemas.ts`에 Zod 스키마를 정의하고, API route와 React Hook Form 양쪽에서 동일하게 import해서 사용한다. 타입은 `z.infer<>`로 추출한다.

---

## 캡처 로드맵

| 단계 | 수단 |
|---|---|
| MVP | 웹 UI 직접 입력 |
| v2 | 브라우저 익스텐션 (url + 선택 텍스트 자동 채움) |
| v3 | 모바일 앱 |

---

## Export 로드맵

| 단계 | 형식 |
|---|---|
| MVP | Markdown |
| v2 | Obsidian (vault 폴더 구조 + frontmatter) |
| v3 | Notion API 연동 |

---

## MVP 범위

MVP에서 구현할 것:

- [ ] Supabase 환경 설정 (Auth, DB Schema, RLS)
- [ ] Next.js 프로젝트 초기화 + Zod 스키마 정의
- [ ] 화면
  - [ ] Capture — 웹 UI 입력 폼
  - [ ] Daily Review — 카드 뷰 (확인 / 다시 보여줘)
  - [ ] Library — INBOX 탭(신규 항목 확인 + ACTIVE 활성화) + 상태/태그/kind 필터 + 키워드 검색
  - [ ] Record Detail — 원본 + annotations
- [ ] API — Records CRUD, Review, Search, Export(Markdown)
- [ ] 에러 핸들링 + 입력 검증 (Zod)

MVP에서 제외할 것:

- 브라우저 익스텐션, 모바일 앱
- Obsidian/Notion Export
- Semantic Search
