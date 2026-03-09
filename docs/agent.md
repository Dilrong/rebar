# Rebar — AI Agent Reference

> AI 에이전트가 이 프로젝트에서 작업할 때 참고하는 문서.
> 사람이 아닌 AI가 읽는 것을 전제로 작성됨.

## 프로젝트 정체성

Rebar는 개인용 SSOT 지식 파이프라인이다.
Capture → Review → Vault 플로우를 통해 콘텐츠를 수집·복습·관리한다.

**핵심 원칙: Vault는 100% 인간이 관리한다.**
- AI는 Export/MCP를 통해 읽기만 한다 (read-only consumer)
- AI auto-tagging, AI summary, AI classification 금지
- MCP 도구: search, get, today — 쓰기/관리 없음

## 기술 스택

| 영역 | 기술 |
|------|------|
| Framework | Next.js 16 (App Router) + React 19 |
| State | TanStack Query v5 |
| DB/Auth | Supabase (Auth + PostgreSQL + RLS) |
| Validation | Zod (서버/클라이언트 공유 스키마) |
| Style | Tailwind CSS (Industrial Brutalism) |
| Test | Vitest (269 tests) + pa11y-ci (a11y) |
| Package | pnpm |
| Deploy | Vercel |
| Extension | Chrome Manifest V3 |

## 디렉토리 구조

```
app/
  (auth)/          # signup
  (features)/      # capture, library, review, search, settings, share, records/[id]
  api/
    (auth)/        # auth/check, auth/ingest-key
    (capture)/     # capture/ingest, capture/share, capture/extract, capture/guide
    (review)/      # review/today, review/[id], review/history, review/stats, review/[id]/undo
    (records)/     # records, records/[id], records/[id]/annotations, records/bulk, bulk/tags, records/[id]/assist
    (tags)/        # tags, tags/[id]
    (search)/      # search
    (export)/      # export
    (mcp)/         # mcp
    (jobs)/        # ingest-jobs, ingest-jobs/retry
    (ops)/         # cron/run, cron/records/cleanup, cron/ingest-jobs/retry
    (settings)/    # settings/preferences


lib/
  auth.ts          # 듀얼 인증 (Bearer/API key/cookie)
  schemas.ts       # Zod 스키마 + 상태 전이 규칙
  rate-limit.ts    # 인메모리 + Upstash 폴백
  pagination.ts    # 커서 기반 페이지네이션
  cron.ts          # Cron 요청 검증
  hash.ts          # SHA-256 content hash (dedup)
  constants.ts     # PG 에러 코드
  http.ts          # HTTP 응답 헬퍼
  record-tags.ts   # 태그 조작
  record-search.ts # tsvector FTS
  crypto.ts        # timingSafeEqual 래퍼
  client-http.ts   # 클라이언트 fetch 래퍼
  query.ts         # TanStack Query 설정
  supabase-*.ts    # Supabase 클라이언트 (server/browser/admin)
  database.types.ts
  types.ts
  features/
    capture/ingest.ts      # 배치 인제스트 (N+1 제거)
    capture/retry-jobs.ts  # 실패 재시도
    review/review.ts       # 리뷰 간격 계산 (1→2→4→...→90)
    content/assist.ts      # AI 어시스트
    content/strip-markdown.ts
    settings/preferences.ts
  security/
    origin.ts      # CORS 오리진 검증
    localhost.ts   # 루프백 호스트 파싱
  i18n/
    messages.ts    # ko/en 번역
    state-label.ts # 상태 레이블

db/
  schema.sql       # 전체 스키마 (RLS + FTS + GIN index)
  migrations/      # 마이그레이션

extension/
  manifest.json    # Manifest V3 (activeTab + scripting)
  background.js    # 서비스 워커 (save orchestration, context menu, message dispatch)
  content.js       # 페이지 DOM→Markdown 추출, 배너 UI
  shared.js        # 상수, 유틸리티 (MSG, parseTags, isValidUrl 등)
  i18n.js          # ko/en 번역
  options.*        # 설정 페이지

tests/             # 165+ Vitest 테스트
```

## 데이터 모델

### 핵심 테이블

- **records**: 불변 콘텐츠 + 상태 + 스케줄링. `content`는 생성 후 수정 불가
- **annotations**: 레코드별 추가 메모/하이라이트 (additive)
- **review_log**: 리뷰 이벤트 (append-only, UPDATE/DELETE 없음)
- **tags / record_tags**: 사용자 태그 (many-to-many)
- **ingest_jobs**: 실패 인제스트 재시도 큐
- **user_preferences**: 사용자별 UI 설정

### Record 상태 머신

```
INBOX → ACTIVE (첫 리뷰 또는 수동)
ACTIVE ↔ PINNED
ACTIVE ↔ ARCHIVED
* → TRASHED (어디서든 soft delete)
```

전이 규칙은 `lib/schemas.ts`의 `ALLOWED_TRANSITIONS`에 정의.

### Record 종류

`quote | note | link | ai` (Zod enum: `RecordKindSchema`)

## 인증

| 경로 | 방식 |
|------|------|
| 웹 앱 | Bearer token (Supabase session) |
| 외부 API | API key + timingSafeEqual (`/api/capture/ingest` 전용) |
| 익스텐션 | Cookie session (same-site) |
| Cron | 시크릿 비교 (`lib/cron.ts`) |
| E2E 테스트 | localhost-only bypass (env flag 필수) |

모든 테이블에 RLS 적용: `user_id = auth.uid()`

## 보안 체크리스트

- URL extract: 내부 호스트/private IP 차단, TOCTOU-resistant DNS, redirect depth 제한
- 입력 제한: content 50K, title 500, annotation 10K
- Bulk mutation: rate-limited
- Tag 필터: 소유권 검증 후 조회
- CORS: origin-less OPTIONS → 403

## 익스텐션 구조

| 파일 | 역할 |
|------|------|
| `background.js` | chromeAsync 래퍼, 설정 로드, fetchWithRetry, saveCapture, oneShotSave, context menu/message dispatch |
| `content.js` | IIFE guard, DOM→Markdown 변환, 페이지 추출, 배너 UI, message handler |
| `shared.js` | DEFAULT_SETTINGS, MSG 상수, parseTags, isValidUrl, normalizeUrl, errorMessage |
| `i18n.js` | ko/en 번역, t(), initI18n() |
| `options.js` | 설정 저장/연결 테스트 |

익스텐션 → `/api/capture/share` (cookie session)

## 명령어

```bash
pnpm dev          # 개발 서버
pnpm build        # 프로덕션 빌드
pnpm test         # Vitest 전체 실행
pnpm lint         # ESLint (--max-warnings=0)
pnpm typecheck    # tsc --noEmit
pnpm a11y         # pa11y-ci 접근성 검사
```

## 작업 시 규칙

1. **records.content는 수정하지 않는다** — enrichment는 annotations 테이블 사용
2. **review_log는 append-only** — UPDATE/DELETE 금지
3. **상태 전이는 ALLOWED_TRANSITIONS만 허용** — `lib/schemas.ts` 참조
4. **API 변경 시 반드시 `pnpm test && pnpm typecheck` 실행**
5. **새 쿼리 경로는 RLS + 소유권 검증 필수**
6. **AI 자동 관리 기능 추가 금지** — vault는 인간이 관리
7. **Korean-first** — UI 텍스트는 한국어 우선, i18n 체계 사용
8. **Industrial Brutalism** — 둥근 모서리 없음, 두꺼운 보더, Construction Orange (#e85d04) 액센트

## 문서 맵

| 문서 | 내용 |
|------|------|
| `docs/architecture.md` | 시스템 아키텍처, API surface, 보안 모델 |
| `docs/project_context.md` | 프로젝트 정체성, 도메인 개념, 우선순위 |
| `docs/session_context.md` | 라운드별 작업 이력, 리스크 워치리스트, 다음 액션 |
| `docs/agent.md` | 이 문서 (AI 에이전트 레퍼런스) |
