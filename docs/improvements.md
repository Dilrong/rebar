# Rebar — 개선 사항 목록

다른 AI 에이전트가 이 문서를 보고 바로 작업할 수 있도록 구체적으로 작성되었다.
각 항목에 파일 경로, 현재 코드, 수정 방향을 포함한다.

**작업 원칙**: 이 프로젝트는 인간 중심 볼트다. AI가 분류/요약/태깅을 대신하는 기능은 절대 추가하지 않는다.

---

## 진행 상태

### Round 1 (완료)

- `S-1` ~ `S-4`: 버그/데이터 무결성
- `A-1` ~ `A-4`: 성능/보안
- `B-1` ~ `B-5`: 코드 품질
- `C-1` ~ `C-4`: 프론트엔드 UX
- `D-1`: 테스트 (61개 유닛 테스트)
- `E`: 인프라 기본 구현
  - Cursor 기반 API 파라미터
  - Cron 엔드포인트 (`/api/cron/ingest-jobs/retry`, `/api/cron/records/cleanup`)
  - Rate limiting 유틸
  - semantic-ready 검색 경로 (`semantic=1`)
  - MCP read-only 엔드포인트 (`/api/mcp`)
  - Obsidian export (`format=obsidian`)

### Round 2 (현재)

아래 항목 작업 필요.

---

## Round 2-S: 버그 / 보안 잔여

### 2S-1. lib/cron.ts — 시크릿 비교에 timingSafeEqual 미사용

**파일**: `lib/cron.ts`

**문제**: auth.ts에서는 `timingSafeEqual`을 쓰지만, cron.ts에서는 `===`로 비교한다. 타이밍 공격으로 시크릿을 추론할 수 있다.

**현재 코드**:
```ts
if (headerSecret === expected || bearer === expected) {
  return { ok: true }
}
```

**수정**: auth.ts와 동일한 패턴 적용.
```ts
import { timingSafeEqual } from "node:crypto"

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

const headerSecret = headers.get("x-cron-secret") ?? ""
const bearer = (headers.get("authorization") ?? "").replace("Bearer ", "")
if (safeEqual(headerSecret, expected) || safeEqual(bearer, expected)) {
  return { ok: true }
}
```

---

### 2S-2. lib/rate-limit.ts — 만료 엔트리 메모리 누수

**파일**: `lib/rate-limit.ts`

**문제**: `Map<string, { count, resetAt }>` 스토어에서 윈도우가 지난 엔트리가 영구 잔류. 장기 운영 시 메모리 증가.

**수정**: `checkRateLimit()` 호출 시 만료 엔트리 정리하는 로직 추가. 또는 주기적 sweep.
```ts
// checkRateLimit 시작부에 추가
const now = Date.now()
if (store.size > 1000) {
  for (const [key, entry] of store) {
    if (entry.resetAt < now) store.delete(key)
  }
}
```

---

### 2S-3. export/route.ts — stateParam 검증 결과 미사용

**파일**: `app/api/export/route.ts`

**문제**: S-1과 동일한 패턴. Zod으로 검증하지만 `parsedState.data`를 버리고 원본 `stateParam`을 쿼리에 사용.

**수정**: records/route.ts와 동일하게 `validState` 변수에 저장 후 사용.

---

### 2S-4. search/route.ts — stateParam 동일 이슈 확인

**파일**: `app/api/search/route.ts`

**문제**: export와 같은 패턴인지 확인 후 동일하게 수정.

---

## Round 2-A: UX 개선 (인간 중심)

매일 이 앱을 쓰는 사용자 관점에서 가장 불편한 것들.

### 2A-1. 벌크 작업 없음 — Library 최대 마찰

**파일**: `app/library/page.tsx`

**문제**: 레코드를 하나씩만 상태 변경/태그 부여할 수 있다. 100개 INBOX 아이템을 ACTIVE로 전환하려면 100번 클릭해야 한다.

**수정**:
1. 카드에 체크박스 추가 (선택 모드)
2. 선택 시 상단에 벌크 액션 바 표시: [ACTIVATE] [PIN] [ARCHIVE] [TRASH] [TAG]
3. 벌크 상태 변경 API: `PATCH /api/records/bulk` `{ ids: string[], state: RecordState }`
4. 벌크 태그: `POST /api/records/bulk/tags` `{ ids: string[], tag_ids: string[] }`

**UI 참고**:
```
┌─ BULK ACTIONS ─────────────────────────────────┐
│  3 SELECTED  [ACTIVATE] [TAG] [ARCHIVE] [TRASH]│
└────────────────────────────────────────────────┘
```

---

### 2A-2. Obsidian Export가 UI에 노출 안 됨

**파일**: `app/library/page.tsx` (export 버튼 영역)

**문제**: `format=obsidian` 파라미터는 API에 존재하지만, UI에서 Markdown만 보인다. Obsidian 사용자는 이 기능을 발견할 수 없다.

**수정**: Export 버튼을 드롭다운으로 변경.
```
[EXPORT ▾]
├─ Markdown (.md)
└─ Obsidian (frontmatter)
```

---

### 2A-3. Library 정렬 옵션 없음

**파일**: `app/library/page.tsx`

**문제**: 항상 created_at DESC. 리뷰 횟수순, 마지막 리뷰순, 이름순 등 정렬 불가.

**수정**: 정렬 드롭다운 추가.
```
[SORT: NEWEST ▾]
├─ Newest first (created_at DESC)
├─ Oldest first (created_at ASC)
├─ Most reviewed (review_count DESC)
└─ Due soonest (due_at ASC)
```

API: `GET /api/records?sort=created_at&order=desc`

---

### 2A-4. 리뷰 후 실수 취소 불가

**파일**: `app/review/page.tsx`

**문제**: ACKNOWLEDGE 누르면 즉시 다음 카드로 넘어간다. 실수로 누르면 되돌릴 수 없다.

**수정**: 리뷰 완료 후 짧은 toast + undo 제공 (4초).
```
┌─────────────────────────────────────┐
│  ACKNOWLEDGED. interval → 4d  [UNDO]│
└─────────────────────────────────────┘
```

Undo 시: review_log 마지막 항목 삭제 + records의 interval/due_at 복원.

**주의**: review_log는 원래 append-only이지만, undo는 사용자가 즉시(4초 내) 실행하는 것이므로 "잘못 기록된 것을 정정하는" 행위로 허용. 또는 review_log에 `action: "undo"` 타입을 추가해서 append-only 원칙을 유지하면서 기존 리뷰를 무효화.

---

### 2A-5. Capture 페이지가 너무 길고 복잡

**파일**: `app/capture/page.tsx`

**문제**: 5개 모드(수동/URL/JSON/CSV/OCR) + API 문서 + 재시도 큐가 한 페이지에 있다. 스크롤이 과도하고, 주요 기능(수동 입력)이 묻힌다.

**수정 방향**:
1. 기본 뷰는 수동 입력 폼만 노출
2. 나머지 모드는 접히는 섹션 또는 탭으로 분리
3. API 문서와 재시도 큐는 별도 페이지(`/capture/advanced`) 또는 설정 페이지로 이동
4. 또는: 수동 입력을 항상 상단에 고정하고, 하단에 "더 많은 가져오기 방법" 섹션

---

### 2A-6. 리뷰 통계/진행 현황 없음

**파일**: `app/review/page.tsx`

**문제**: 오늘 몇 개 리뷰했는지, 전체 리뷰 횟수가 얼마인지, 리뷰 연속일수(스트릭)가 몇일인지 알 수 없다.

**수정**: 리뷰 페이지 상단에 간단한 통계 바.
```
┌─ TODAY ───────────────────────────┐
│  REVIEWED: 12 / 20  │  STREAK: 7d │
└───────────────────────────────────┘
```

- `reviewed_count`: 오늘 review_log에서 count
- `streak`: review_log에서 연속 일수 계산

API: `GET /api/review/stats` → `{ today_count, total_due, streak_days }`

---

### 2A-7. 글로벌 검색 없음

**파일**: `components/layout/app-nav.tsx`

**문제**: 검색하려면 반드시 `/search` 페이지로 이동해야 한다. 어디서든 빠르게 검색할 수 없다.

**수정**: 네비게이션 바에 검색 아이콘 + Cmd+K (또는 Ctrl+K) 단축키로 검색 모달.
```
┌─ QUICK SEARCH (⌘K) ──────────────────┐
│  [검색어 입력...]                       │
│                                       │
│  최근: "..."  "..."  "..."              │
│  결과 미리보기 (상위 5건)                 │
└───────────────────────────────────────┘
```

모달에서 Enter → `/search?q=검색어`로 이동하거나, 결과 클릭 → `/records/:id`.

---

### 2A-8. 모바일 터치 타겟 크기

**파일**: `app/review/page.tsx` (스누즈 버튼), `app/library/page.tsx` (태그 버튼)

**문제**: 스누즈 버튼 `text-[10px]`, 태그 버튼 `text-xs h-7` 등 작은 터치 타겟. WCAG 권장 최소 44x44px.

**수정**: 모든 인터랙티브 요소에 `min-h-[44px] min-w-[44px]` 보장. 스누즈 버튼은 최소 `text-xs py-2 px-3`.

---

## Round 2-B: 코드 품질 잔여

### 2B-1. Cron 재시도 루프가 순차적

**파일**: `app/api/cron/ingest-jobs/retry/route.ts`

**문제**: 각 잡을 순차적으로 processIngest + 상태 업데이트. 100개 잡이면 직렬 실행.

**수정**: `Promise.allSettled`로 병렬 처리 (동시 제한 5~10개).

---

### 2B-2. vercel.json Cron 스케줄 설정 누락

**문제**: Cron 엔드포인트는 있지만 실제 스케줄을 트리거하는 설정이 없다.

**수정**: `vercel.json` 추가.
```json
{
  "crons": [
    {
      "path": "/api/cron/ingest-jobs/retry",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/records/cleanup",
      "schedule": "0 3 * * *"
    }
  ]
}
```

---

### 2B-3. semantic search RPC 함수 존재 여부

**파일**: `app/api/search/route.ts`

**문제**: `supabase.rpc("search_records_semantic", ...)` 를 호출하지만 `db/schema.sql`에 해당 함수 정의가 없다. pgvector 확장도 아직 활성화하지 않았다면, 이 경로는 항상 실패 후 ILIKE 폴백으로 간다.

**수정 방향 2가지**:
1. pgvector를 당장 안 쓸 거면: semantic 코드 경로를 제거하고, 향후 구현 시 다시 추가
2. pgvector를 쓸 거면: `db/schema.sql`에 함수 정의 + `CREATE EXTENSION vector` 추가

**권장**: 옵션 1. 지금은 tsvector FTS만 쓰고, semantic 경로는 주석이나 feature flag 뒤로 숨김.

---

### 2B-4. 테스트 커버리지 부족 영역

현재 61개 유닛 테스트는 lib 함수만 커버. 아래 영역 추가 필요:

| 대상 | 테스트 내용 |
|---|---|
| `lib/rate-limit.ts` | 윈도우 내 요청 차단, 윈도우 리셋 후 허용, 클라이언트 키 추출 |
| `lib/pagination.ts` | 커서 인코딩/디코딩, 잘못된 커서 처리 |
| `lib/cron.ts` | 시크릿 검증 성공/실패, 환경변수 미설정 |

---

## Round 2-C: 기능 추가

### 2C-1. 벌크 API 엔드포인트

`2A-1` (벌크 작업)을 위한 API.

```
PATCH /api/records/bulk
  Body: { ids: string[], state: RecordState }
  - 최대 100건
  - 각 id에 대해 상태 전이 규칙 검증
  - 성공/실패 건수 반환

POST /api/records/bulk/tags
  Body: { ids: string[], tag_ids: string[], mode: "add" | "replace" }
  - add: 기존 태그 유지 + 새 태그 추가
  - replace: 기존 태그 제거 + 새 태그로 교체
```

---

### 2C-2. 리뷰 통계 API

`2A-6` (리뷰 통계)을 위한 API.

```
GET /api/review/stats
  Response: {
    today_reviewed: number,
    today_remaining: number,
    streak_days: number,
    total_active: number,
    total_records: number
  }
```

streak 계산: review_log에서 user_id 기준으로 오늘부터 역순으로 연속된 날짜 수.

---

### 2C-3. 리뷰 Undo API

`2A-4` (리뷰 실수 취소)를 위한 API.

```
POST /api/review/:id/undo
  - review_log에서 해당 record의 마지막 항목 조회
  - 4초 이내인지 확인 (서버 시간 기준)
  - review_log에 action: "undo" 항목 추가 (append-only 유지)
  - records의 interval_days, due_at, review_count를 이전 값으로 복원
```

review_log action enum 확장 필요: `'reviewed' | 'resurface' | 'undo'`

---

## 작업 순서 권장

1. **2S-1 ~ 2S-4** → 보안/버그 잔여
2. **2B-2** → vercel.json Cron 설정 (기존 기능 활성화)
3. **2B-3** → semantic search 정리
4. **2C-1 ~ 2C-3** → 벌크 API, 리뷰 통계, 리뷰 Undo (신규 API)
5. **2A-1** → 벌크 작업 UI (2C-1 API 필요)
6. **2A-2 ~ 2A-3** → Export 드롭다운, 정렬 옵션
7. **2A-4** → 리뷰 Undo UI (2C-3 API 필요)
8. **2A-5** → Capture 페이지 간소화
9. **2A-6** → 리뷰 통계 UI (2C-2 API 필요)
10. **2A-7** → 글로벌 검색 모달 (Cmd+K)
11. **2A-8** → 모바일 터치 타겟
12. **2B-1** → Cron 병렬화
13. **2B-4** → 테스트 추가

---

## 참고: Round 1 완료 항목 (아카이브)

<details>
<summary>Round 1 상세 (접기)</summary>

### S-1. GET /api/records — 검증된 값을 사용하지 않음 (완료)

stateParam/kindParam을 Zod 검증 후 validState/validKind 변수로 저장하여 사용.

### S-2. POST /api/review/:id — 리뷰 불가 상태 검증 (완료)

ARCHIVED/TRASHED 상태 레코드 리뷰 차단.

### S-3. POST /api/review/:id — review_log INSERT 순서 (완료)

records UPDATE 먼저, 성공 시 review_log INSERT.

### S-4. PATCH /api/records/:id — 태그 교체 레이스 컨디션 (완료)

UPSERT + 불필요한 링크 제거 패턴.

### A-1. lib/ingest.ts — N+1 쿼리 (완료)

배치 INSERT로 전환. 태그/레코드/링크 모두 배치.

### A-2. lib/auth.ts — 인증 레이어 강화 (완료)

timingSafeEqual, Bearer 실패 시 폴백 차단, NODE_ENV 체크.

### A-3. tsvector 전환 (완료)

fts 컬럼 + GIN 인덱스. simple 사전 사용.

### A-4. fetch 타임아웃 (완료)

AbortController 10초 타임아웃.

### B-1 ~ B-5, C-1 ~ C-4, D-1 (완료)

매직 상수 추출, 응답 포맷 통일, snooze 제약, i18n, a11y, 빈/로딩 상태, 디자인 시스템, 테스트 61개.

### E: 인프라 (완료)

Cursor 페이지네이션, Cron 엔드포인트, Rate limiting, MCP, Obsidian export.

</details>
