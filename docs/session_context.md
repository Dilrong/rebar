# Rebar Session Context

## Purpose

This document tracks recent implementation context, completed rounds, and next actionable work so contributors can resume quickly.

## Recently Stabilized Areas

- Extension authentication aligned with server-side cookie session flow
- API auth path unified to reduce duplicated checks
- Origin validation added on sensitive capture routes
- API key exposure path removed from auth helper endpoint (`/api/auth/ingest-key` now returns `enabled` only)
- URL extract flow hardened with host/scheme guards against internal/private targets
- Bulk record mutation APIs are now rate-limited
- Tag-filter ownership checks enforced on export/list/search flows
- Extension UX improved (loading states, connectivity messaging, options validation)
- Retry behavior improved for transient network and rate-limit scenarios
- Import model now preserves source provenance, current note separation, note history, and ingest event snapshots
- DB migration source of truth clarified under `db/migrations/` with timestamped filenames

## Current Implementation Snapshot

- Capture paths support web/manual, batch ingest, share endpoint, and extension clipping through a shared ingest model
- Review loop and history endpoints are active
- Library filtering and record detail flows are active
- Export, cron maintenance, and MCP read-only paths are present

## Completed Work Rounds (Condensed)

### Round 1 (Completed)

- Major bug/data integrity fixes
- Performance and security baseline upgrades
- Code quality and frontend UX pass
- Initial test expansion and infra baseline

### Round 2 (Completed)

- Remaining bug/security backlog items addressed
- UX backlog items advanced for core screens
- Additional API and behavior hardening

### Round 3 (Completed/Advanced)

- Bulk-tag ownership validation reinforced
- Undo flow atomicity/concurrency safety improved
- Cron auth response hardening and messaging cleanup
- Rate-limit strategy extended (distributed path + fallback)
- Accessibility and interaction polish for nav/export/library interactions
- Initial API integration test coverage expanded

### Round 4 (Completed)

- Security preflight executed with dependency audit + route review
- Capture extract route hardening verified with dedicated API tests
- Bulk mutation route throttling and related test updates applied
- Export route integrity fix and markdown response completion verified
- Full verification pass: typecheck, test, lint, build

### Round 5 (Completed)

- **Security**: Eliminated PostgREST string interpolation in tag filtering (bulk tags, record PATCH) — replaced with safe `.in()` array filtering
- **Security**: Added input length limits on ingest content (50K), titles (500), annotation body (10K) to prevent memory exhaustion
- **Security**: Bearer token auth path wrapped in try-catch for consistent error handling
- **Security**: Favicon URL hostname now properly encoded with `encodeURIComponent()`
- **Bug fix**: Review interval `calcNextInterval` now guards against negative/zero input values
- **Observability**: Upstash rate-limit fallback now logs errors instead of failing silently
- **Performance**: Rate-limit in-memory store cleanup improved (time-based + lower threshold)
- **Performance**: Bulk tag replace mode N+1 loop eliminated — now uses batch upsert + single stale cleanup query
- **UX**: Error boundaries added for all feature routes (review, library, capture, records/[id], features layout)
- **i18n**: Error boundary messages added (ko/en)
- Full verification pass: typecheck ✓, 69 tests ✓, lint ✓

### Round 6 (Completed)

- **Security**: `/api/capture/extract` hardened with TOCTOU-resistant DNS resolution checks and guarded redirect traversal
- **UX/Architecture**: `capture` page decomposed into mode/section subcomponents (`url`, `batch`, `csv`, `ocr`, `manual-form`)
- **UX/Architecture**: `library` page decomposed into `header`, `record-grid`, `pagination` plus previously extracted `filters`, `tag-manager`, `export-menu`, `selection-toolbar`
- **Accessibility**: capture tag toggles migrated to explicit `input + label htmlFor` structure
- **A11y Automation**: pa11y-ci pipeline integrated (`pnpm a11y`)
- Full verification pass: typecheck ✓, tests ✓, lint ✓, build ✓, a11y ✓

### Round 7 (Completed)

- **Frontend decomposition**: `records/[id]` sidebar split into `RecordAssistPanel`, `RecordManagePanel`, `RecordTagsPanel`, `RecordHistoryPanel`
- **Frontend decomposition**: `app-nav` split into `NavDesktop`, `NavMobileTop`, `NavMobileBottom`, `QuickSearchDialog`
- **Frontend decomposition**: `review` split with `ReviewHeader` and `ReviewCurrentCard`
- **A11y robustness**: authenticated protected-page checks enabled in `pnpm a11y` via localhost-only e2e bypass flags
- Full verification pass: typecheck ✓, tests ✓, lint ✓, build ✓, a11y ✓

### Round 7 (Completed) — Performance Optimization

- **Bundle**: `react-markdown` converted to `next/dynamic` lazy load — removed from main bundle
- **Rendering**: `LibraryRecordCard` wrapped with `React.memo()`, id-based callback pattern adopted
- **Rendering**: Library page handlers (`toggleSelect`, `prefetchRecord`, `toRecordHref`, `handleActivate`, `handleInboxTodo`, `handleInboxArchive`) stabilized with `useCallback`
- **API payload**: List endpoints (`records`, `review/today`, `search`) now select explicit columns instead of `SELECT *` — excludes `content_hash`, `user_id`
- **Query cache**: Global defaults set (`staleTime: 2min`, `gcTime: 15min`), review-today staleTime increased from 30s → 2min
- Full verification pass: typecheck ✓, 79 tests ✓

### Round 8 (Completed) — Auth Bypass Hardening

- **Security**: localhost bypass host checks hardened to strict loopback parsing (`localhost`, `127.0.0.1`, `[::1]`) with no prefix matching
- **Security**: bypass now requires all present host headers (`host`, `x-forwarded-host`) to be loopback-safe before activation
- **Regression tests**: added spoofed-host rejection tests (`localhost.attacker.com`, `127.0.0.1.attacker.com`, mixed forwarded/direct host mismatch)
- **Regression tests**: added `lib/security/localhost` utility tests for host parsing edge cases and loopback matching

### Round 9 (Completed) — Utility/Test Hardening

- **Bug fix**: `processIngest` now backfills `favicon_url` when duplicate merge later acquires a missing URL
- **Test coverage**: added `tests/preferences.test.ts` for client/server start-page preference helpers (localStorage, API success/failure, fallback behavior)
- **Test coverage**: expanded `tests/ingest.test.ts` with ingest error-path assertions (tag lookup/upsert refresh, records upsert, record_tags upsert)
- **Test coverage**: added `tests/origin.test.ts` for security-critical origin validation branches
- Full verification pass: typecheck ✓, 111 tests ✓, lint ✓, build ✓, a11y ✓

### Round 10 (Completed) — Capture Extract Guard Expansion

- **Security/Correctness**: YouTube host detection tightened from substring matching to strict host matching (`youtube.com`/`*.youtube.com`, `youtu.be`/`*.youtu.be`) to avoid lookalike false positives
- **API tests**: `tests/api-capture-extract-route.test.ts` expanded with auth/rate-limit/invalid-payload and blocked hostname variants (`.local`, `.internal`)
- **Guard tests**: added `tests/api-capture-extract-fetch-guards.test.ts` with mocked DNS/HTTP paths for redirect-to-private blocking and extraction behavior
- Full verification pass: typecheck ✓, 120 tests ✓, lint ✓, build ✓, a11y ✓

### Round 11 (Completed) — Proxy Reliability and CORS Regression Coverage

- **Reliability**: `proxy.ts` now tolerates transient Supabase session refresh failures (`supabase.auth.getUser`) without breaking request flow
- **Proxy tests**: expanded `tests/proxy.test.ts` with OPTIONS-without-origin wildcard behavior and session-refresh-failure survival checks
- **Proxy tests**: CORS/origin branch coverage now includes preflight allow/deny, mutating request block, GET pass-through, response header attachment, and missing env path
- Full verification pass: typecheck ✓, 128 tests ✓, lint ✓, build ✓, a11y ✓

### Round 12 (Completed) — Proxy/Extract Integration Test Expansion

- **Proxy integration**: added `tests/proxy-origin-integration.test.ts` to validate real `isAllowedOrigin` policy behavior (site URL allowlist, extension allow/deny in prod, dev extension path, malformed origin block)
- **Capture guard tests**: expanded `tests/api-capture-extract-fetch-guards.test.ts` with redirect depth limit, missing redirect location, non-http redirect, preflight DNS private resolution block, and pinned-lookup private IP rejection
- **Proxy reliability**: maintained non-failing request path when Supabase refresh throws, now backed by both unit-style and integration-style middleware tests
- Full verification pass: typecheck ✓, 139 tests ✓, lint ✓, build ✓, a11y ✓

### Round 13 (Completed) — Extract Content Heuristic Coverage

- **Extract tests**: expanded `tests/api-capture-extract-fetch-guards.test.ts` with content-selection heuristic checks (long description priority, short-main fallback-to-body, 1800-char truncation cap)
- **Redirect guard tests**: added explicit regressions for redirect depth limit, missing redirect location, and non-http redirect protocol rejection
- **DNS guard tests**: added preflight lookup private-resolution block and pinned-lookup private-IP rejection scenarios
- Full verification pass: typecheck ✓, 142 tests ✓, lint ✓, build ✓, a11y ✓

### Round 14 (Completed) — Split UI Smoke Coverage

- **UI smoke tests**: added `tests/ui-split-components-smoke.test.ts` to server-render key split components (`CaptureImportModeTabs`, `LibraryPagination`, `NavMobileBottom`) and verify essential labels/accessibility markers
- **Regression resilience**: smoke coverage now ensures split component imports/render paths remain healthy after refactors without needing browser e2e
- **Lint alignment**: test imports were adjusted to follow project import boundary rules (`@shared/*` and relative feature paths)
- Full verification pass: typecheck ✓, 146 tests ✓, lint ✓, build ✓, a11y ✓

### Round 15 (Completed) — jsdom/RTL + Property-Based Validation Expansion

- **Browser interaction tests**: added `tests/ui/split-components-interaction.test.ts` with jsdom + RTL click-path coverage for split components (`CaptureImportModeTabs`, `LibraryPagination`, `NavMobileBottom`)
- **Property tests**: added `tests/api-settings-preferences-property.test.ts` and `tests/api-capture-extract-property.test.ts` using `fast-check` to stress API input validation invariants
- **Infra stabilization**: Vitest include patterns expanded to `.test.tsx` support, worker pool set to `threads`, and `jsdom` pinned to a compatible version to avoid ESM worker startup failures
- **Autonomous follow-up**: expanded settings property coverage to reject arbitrary non-conforming JSON payloads
- Full verification pass: typecheck ✓, 156 tests ✓, lint ✓, build ✓, a11y ✓

### Round 16 (Completed) — Mutation Property Tests + Broader A11y Coverage

- **Property tests (mutations)**: added `tests/api-records-bulk-tags-property.test.ts` and `tests/api-review-route-property.test.ts` covering dedup/ownership invariants and triage transition invariants (ARCHIVE/ACT/DEFER)
- **RTL expansion**: `tests/ui/split-components-interaction.test.ts` now covers split `LibraryFiltersToolbar` and `ReviewCurrentCard` interaction flows in addition to capture/nav controls
- **A11y coverage expansion**: `.pa11yci.json` URL set expanded to protected feature pages (`/review/history`, `/search`, `/projects`, `/share`) with stable pass set at 9 URLs
- **A11y stabilization**: increased pa11y navigation timeout and kept `/settings` excluded from CI URL set due persistent environment-specific navigation hang under headless runner
- Full verification pass: typecheck ✓, lint ✓, build ✓, tests 164 ✓, a11y 9/9 ✓

### Round 17 (Completed) — Security Review & Hardening

- **Security (CRITICAL)**: Fixed CORS wildcard + credentials violation in `proxy.ts` — origin-less OPTIONS preflight now returns 403 instead of `Access-Control-Allow-Origin: *` with `credentials: true`
- **Security (CRITICAL)**: Removed `x-forwarded-host` from E2E auth bypass check in `lib/auth.ts` — header is client-spoofable; bypass now only checks `host` header
- **Test updates**: `tests/proxy.test.ts` updated to expect 403 for origin-less OPTIONS; `tests/auth.test.ts` updated with explicit x-forwarded-host spoofing rejection test
- Full verification pass: typecheck ✓, 165 tests ✓

### Round 18 (Completed) — Import Provenance and DB Migration Cleanup

- **Data model**: added `sources`, `record_note_versions`, and `record_ingest_events` to preserve provenance and note history
- **Data model**: `records` now carry `source_id`, `current_note`, `note_updated_at`, and `adopted_from_ai`
- **Import pipeline**: manual/CSV/JSON/share capture paths now normalize through the same source-aware ingest flow
- **Dedup semantics**: dedupe moved from global `content_hash` to source-aware `user_id + source_id + content_hash`
- **UX**: record detail now shows `current_note` separately and exposes note history in the history panel
- **Search/Export**: `current_note` participates in search/export output alongside canonical content/source metadata
- **DB ops**: canonical migration path documented in `db/README.md`; migration filenames normalized to sortable timestamp form
- Full verification pass: typecheck ✓, lint ✓, tests 190 ✓

### Round 19 (Completed) — Export Format Expansion and Incremental Filtering

- **Export API**: `/api/export` now supports `json`, `csv`, and `logseq` in addition to existing `markdown` and `obsidian`
- **Incremental export**: all export formats now accept `since` and filter on `records.updated_at`
- **Provenance export**: JSON/CSV payloads now include source metadata and resolved tag names for migration/analysis use
- **Library UX**: library export controls now expose the new formats and an incremental `since` date filter
- Full verification pass: typecheck ✓, lint ✓, tests 195 ✓, build ✓

### Round 20 (Completed) — Telegram Ingest, Review Digests, and Extension Capture Enrichment

- **Telegram import**: added `/api/capture/telegram` webhook route for bot-driven link/text capture into the existing ingest pipeline
- **Review loop automation**: added cron routes for `/api/cron/review/daily` and `/api/cron/review/weekly-digest`
- **Notifications**: daily review and weekly digest payloads can now fan out to Telegram and/or outbound webhook targets
- **Webhook export**: state-changing record mutations now emit outbound `record.state_changed` webhook events
- **Readwise import**: batch JSON import parser now maps Readwise-style book/article payloads more completely, including note/anchor/source metadata
- **Extension UX**: clipper now shows a Quick Tag picker with existing tags before save and preserves surrounding context for selection captures
- **Reader heuristics**: content-script extraction now prioritizes Kindle Cloud Reader, Ridibooks, and Millie viewer selectors before generic article fallbacks
- Full verification pass: typecheck ✓, lint ✓, tests 207 ✓, build ✓

### Round 21 (Completed) — Email Digest Delivery

- **Review loop automation**: daily review and weekly digest notifications now support direct email delivery in addition to Telegram/webhook fan-out
- **Delivery config**: optional Resend-backed notification delivery can be enabled with sender/recipient env vars without changing cron routes
- Full verification pass: typecheck ✓, lint ✓, tests 209 ✓, build ✓

### Round 22 (Completed) — Flow Cleanup, Scope Alignment, and UX Polish

- **Notification cleanup**: outbound email/telegram/webhook delivery now shares one timeout-aware helper, reducing duplication and preventing hanging notification fetches
- **Digest usability**: weekly digest skips delivery on zero-activity weeks, while daily/weekly responses now return consistent delivery metadata
- **Telegram ingest**: webhook parsing now accepts `text_link` entities and edited channel posts for more reliable saved-link capture
- **Library export UX**: export now follows current library scope more closely (`kind` filter support, trash excluded by default), and the header adds quick incremental date presets plus a visible scope summary
- **Extension UX**: quick-tag picker preserves custom preselected tags, shows selected-tag count, and newly used tags are cached immediately for the next clip
- Full verification pass: typecheck ✓, lint ✓, tests 212 ✓, build ✓

## Active Risk Watchlist

- Keep semantic search path aligned with actual DB capabilities
- Ensure cron schedules and endpoint protections stay synchronized
- Continue monitoring extension service worker lifecycle edge cases
- Maintain strict ownership checks on all bulk and mutation APIs
- Continue reducing oversized pages (`review`, `records/[id]`, `app-nav`) to lower regression risk
- Keep component boundaries coherent as `records/[id]` and `app-nav` evolve
- Investigate `/settings` pa11y navigation hang in headless CI environment
- Watch for drift between runtime DB state and `db/schema.sql` after future migrations
- Review whether legacy SQL RPC functions should eventually be made source-aware or retired completely

## Import/Export Pipeline Roadmap

Readwise 분석에서 도출한 "자연스러운 데이터 파이프라인" 전략. 핵심 원칙: 기존 사용자 프로세스에 개입하지 않는 무마찰 연동.

### Active — Import 마찰 제거

#### Telegram Bot Import
- 텔레그램 봇으로 링크/텍스트 전송 → Rebar 자동 캡처
- 기존 `/api/capture/share` 엔드포인트 재활용
- Telegram Bot API webhook → share endpoint 연결
- 모바일에서 "나에게 보내기" 습관을 그대로 활용

#### Readwise 호환 Import
- Readwise CSV/JSON export 포맷에 정확히 맞춘 필드 매핑
- `highlight → content`, `book_title → source_title`, `note → current_note`, `location → anchor`
- Readwise → Rebar 마이그레이션 경로 공식 지원

#### 브라우저 확장 강화
- 선택 텍스트 캡처 시 주변 문맥(앞뒤 1-2문단) 함께 저장
- Quick Tag: 캡처 시 기존 태그 목록에서 선택하는 팝업
- Kindle Cloud Reader 하이라이트 추출 content script
- 밀리의서재/리디북스 웹뷰어 하이라이트 추출 (한국 서비스 차별화)

### Active — Export 자연스러움

#### Export 포맷 확장 + 증분 지원
- JSON export: 마이그레이션/백업용
- CSV export: 스프레드시트 분석용
- Logseq 포맷 지원
- 모든 export에 `since` 파라미터로 증분(incremental) export 지원

#### Webhook Export (Push 방식)
- record 상태 변경 시 외부 서비스에 webhook 발송
- 예: PINNED → Notion DB 자동 추가 (n8n/Zapier 경유)
- Export를 사용자가 "가져가는" 게 아니라 Rebar가 "보내주는" 구조

### Active — Review Loop 강화

#### Daily Review 알림 (이메일/텔레그램)
- 현재 review interval doubling 시스템 활용
- 매일 아침 due된 record 5개를 이메일 또는 텔레그램으로 전송
- 앱을 열지 않아도 복습 가능

#### Weekly Digest
- 주 1회 캡처 요약 + 복습 통계
- 캡처 수, 복습 수, 태그 분포, 가장 많이 캡처한 소스

### Backlog — 장기 과제

#### Email Forward Import
- 고유 이메일 주소 발급 (`capture-{hash}@rebar.app`)
- 이메일 본문 자동 파싱 → record 생성
- 뉴스레터 구독을 캡처 주소로 설정하면 자동 수집
- 구현: Cloudflare Email Workers 또는 SendGrid Inbound Parse
- 인프라 의존성이 높아 후순위

#### Obsidian 지속 Sync
- 현재 일회성 다운로드 → Obsidian vault 자동 동기화로 전환
- 방법 A: Obsidian Community Plugin (API 호출 → vault 파일 생성/업데이트, 템플릿 커스터마이징)
- 방법 B: CLI 도구 `rebar sync --to obsidian --vault ~/vault` (cron 자동화)
- Plugin 생태계 이해 및 Obsidian API 학습 필요

## Recommended Next Actions

- Expand property-based coverage to undo/history mutation paths and retry-job mutation APIs
- Add deterministic repro instrumentation for pa11y `/settings` timeout (capture console/network traces in CI)
- Add deeper RTL coverage around `review` defer/act panel keyboard flows and focus management
- Consider follow-up schema/API work for explicit source editing flows instead of treating source title/url as record-level fields in the UI

## Handoff Checklist

- Verify auth assumptions before touching capture/review routes
- Re-check state transition constraints for any record mutation changes
- Confirm RLS and ownership validation on every new query path
- Run tests/build after API or extension flow changes
