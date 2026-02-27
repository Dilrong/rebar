# Chrome Extension 인증 및 UX 전면 수정 — 구현 사항

## 배경

익스텐션이 `credentials: "include"` (쿠키)로 서버에 요청하지만, 서버의 `getUserId()`는 Bearer 토큰과 API key만 체크하고 쿠키를 전혀 읽지 않았다. 웹앱은 `client-http.ts`에서 Supabase localStorage의 `access_token`을 꺼내 Bearer 헤더로 보내지만, 익스텐션은 웹앱 localStorage에 접근 불가. 결과: 프로덕션에서 익스텐션 인증이 작동하지 않음.

## 변경 파일 요약 (14개)

| 파일 | 변경 타입 | 설명 |
|------|-----------|------|
| `package.json` | 의존성 | `@supabase/ssr` 추가, `@supabase/supabase-js` 2.49.1→2.98.0 |
| `lib/supabase-server.ts` | **신규** | 서버 Supabase 클라이언트 — Request 쿠키에서 세션 읽기 |
| `lib/supabase-browser.ts` | 수정 | `createClient` → `createBrowserClient` (`@supabase/ssr`) 전환 |
| `middleware.ts` | **신규** | `/api/:path*` 매칭, 만료된 Supabase 토큰 자동 갱신 + 쿠키 재설정 |
| `lib/auth.ts` | 수정 | 쿠키 인증 경로 추가 + `isValidOrigin()` CSRF 방어 |
| `app/api/auth/check/route.ts` | 수정 | 중복 인증 로직 제거, `getUserId()` 직접 호출 |
| `app/api/capture/share/route.ts` | 수정 | Origin 검증 추가 |
| `app/api/capture/ingest/route.ts` | 수정 | Origin 검증 추가 |
| `extension/content.js` | 수정 | `tags: ["web-scrape"]` → `tags: ["web"]` |
| `extension/background.js` | 수정 | `fetchWithRetry()` 추가, 429 메시지 개선 |
| `extension/popup.js` | 수정 | 로딩 상태, storage 리스너, 연결 에러 구분 |
| `extension/options.js` | 수정 | URL 유효성 검사, "연결 테스트" 기능 |
| `extension/options.html` | 수정 | "연결 테스트" 버튼 마크업 |
| `extension/options.css` | 수정 | `.button-row`, `.test-btn` 스타일 |
| `extension/i18n.js` | 수정 | 새 i18n 키 8개 (en/ko) |

---

## Phase 1: 서버 — 쿠키 기반 인증

### 1.1 `@supabase/ssr` 설치

```bash
pnpm add @supabase/ssr
pnpm add @supabase/supabase-js@latest  # peer dependency 해결
```

### 1.2 `lib/supabase-server.ts` (신규)

- `createServerClient` (`@supabase/ssr`) 사용
- `cookies()` (next/headers)로 Request 쿠키에서 Supabase 세션 읽기
- `getAll()` / `setAll()` 구현으로 쿠키 CRUD 지원

### 1.3 `lib/supabase-browser.ts` (수정)

- `createClient` (supabase-js) → `createBrowserClient` (`@supabase/ssr`) 전환
- `@supabase/ssr`의 `createBrowserClient`는 localStorage와 쿠키 동시 저장을 자동 처리
- 싱글톤 패턴 유지

### 1.4 `middleware.ts` (신규)

- `/api/:path*` 매칭 (모든 API 라우트에 적용)
- 만료된 Supabase 토큰을 `supabase.auth.getUser()` 호출로 자동 갱신
- 갱신된 토큰을 Response 쿠키에 재설정
- `NextResponse.next({ request })` 패턴으로 Request/Response 쿠키 동기화

### 1.5 `lib/auth.ts` (수정)

인증 경로를 4단계로 확장:

1. **Bearer 토큰** — 웹앱, 명시적 토큰 (기존)
2. **API key** — 외부 ingest, cron (기존)
3. **쿠키 세션** — Chrome 익스텐션, same-site 브라우저 (**신규**)
   - Bearer 토큰이 없을 때만 시도
   - `getSupabaseServer()` dynamic import + try/catch (테스트/비Route Handler 환경 안전)
4. **개발 모드 fallback** (기존)

`isValidOrigin()` 헬퍼 추가:
- `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL` 기반 허용 Origin 목록
- `chrome-extension://` 프로토콜 항상 허용
- Origin 헤더 없으면 (same-origin 또는 비브라우저 클라이언트) 통과

### 1.6 `app/api/auth/check/route.ts` (수정)

- 기존: 자체 Bearer 체크 로직 + 개발 모드 fallback → 중복
- 변경: `getUserId()` 하나로 통합 → 쿠키 인증 자동 지원

### 1.7–1.8 `share/route.ts`, `ingest/route.ts` (수정)

- `isValidOrigin(request.headers)` 호출 추가
- 잘못된 Origin이면 `403 Forbidden` 즉시 반환

---

## Phase 2: 익스텐션 — UX 개선

### 2.1 `content.js` — 태그 일관성

- `tags: ["web-scrape"]` → `tags: ["web"]`
- `popup.js`의 `suggestTags()`에서 `kind === "link"`일 때 `["web"]`을 생성하는데, `content.js`에서는 `"web-scrape"`를 보내고 있어 불일치 발생 → 수정

### 2.2 `background.js` — 네트워크 안정성

`fetchWithRetry(url, options, maxRetries = 2)` 추가:
- 네트워크 에러(`TypeError`) 시 최대 2회 재시도 (1s, 2s 백오프)
- 429 응답 시 `Retry-After` 헤더 파싱 후 대기 & 재시도 (최대 10초 cap)
- 429 최종 실패 메시지: i18n `ext.tooManyReq` 사용
- `saveCapture()`에서 `fetch()` → `fetchWithRetry()` 교체

### 2.3 `popup.js` — 상태 관리 개선

- `refreshSettings()`: auth 체크 시작 시 `setBusy(true)` + "로그인 확인 중..." 메시지
- auth 체크 실패 시 연결 에러 메시지 (네트워크 문제 vs 미인증 구분)
  - `catch`: "연결 실패. 설정을 확인해주세요." (네트워크/서버 문제)
  - `!res.ok`: 기존 로그인 필요 UI 표시
- `chrome.storage.onChanged` 리스너 추가 → 옵션 페이지에서 설정 변경 시 자동 갱신
- auth 체크 완료 후에만 "Ready" 표시

### 2.4 `options.js` — URL 검증 + 연결 테스트

- `isValidUrl()`: `http://` 또는 `https://`만 허용
- `save()`: 저장 전 URL 유효성 검사 → 실패 시 에러 메시지
- `testConnection()`: `/api/auth/check` 호출
  - 200 → "연결 및 인증 성공!"
  - 401 → "연결됨, 로그인 필요"
  - 기타/에러 → "서버에 연결할 수 없습니다."

### 2.5 `options.html` — UI

- `.button-row` 컨테이너에 "Save Settings"과 "Test Connection" 버튼 나란히 배치

### 2.6 `i18n.js` — 새 키 8개

| 키 | EN | KO |
|----|----|----|
| `ext.status.checking` | Checking login... | 로그인 확인 중... |
| `ext.status.connError` | Connection failed. Check settings. | 연결 실패. 설정을 확인해주세요. |
| `ext.opt.invalidUrl` | Please enter a valid URL (https://...) | 올바른 URL을 입력해주세요 (https://...) |
| `ext.opt.testConn` | Test Connection | 연결 테스트 |
| `ext.opt.connOk` | Connected and authenticated! | 연결 및 인증 성공! |
| `ext.opt.connNoAuth` | Connected, but not logged in. | 연결됨, 로그인 필요 |
| `ext.opt.connFail` | Cannot reach server. | 서버에 연결할 수 없습니다. |
| `ext.tooManyReq` | Too many requests. Wait a moment. | 요청이 너무 많습니다. 잠시 후 다시 시도해주세요. |

---

## 인증 흐름 다이어그램

```
익스텐션 팝업 열기
  → popup.js: refreshSettings()
    → GET /api/auth/check (credentials: "include")
      → middleware.ts: 쿠키에서 세션 갱신
      → auth.ts: getUserId()
        1. Bearer 토큰? → 없음 (익스텐션은 보내지 않음)
        2. API key? → 없음
        3. 쿠키 세션? → getSupabaseServer() → 쿠키에서 세션 읽기 → userId 반환
      → 200 { authenticated: true }
    → 팝업: 액션 버튼 활성화

클립 저장
  → background.js: saveCapture()
    → fetchWithRetry() POST /api/capture/share (credentials: "include")
      → middleware.ts: 쿠키 세션 갱신
      → share/route.ts: isValidOrigin() → OK
      → ingest/route.ts: getUserId() → 쿠키에서 userId
      → 200 { created, duplicates }
```

---

## 검증 결과

- `pnpm build` — 성공
- `pnpm test` — 17 파일, 57 테스트 전체 통과

## 수동 테스트 체크리스트

- [ ] 웹앱 로그인 → 익스텐션 팝업 열기 → 인증 체크 성공 확인
- [ ] 아티클 스크랩 → 저장 성공 확인
- [ ] 하이라이트 스크랩 → 저장 성공 확인
- [ ] 옵션 페이지 → 잘못된 URL 입력 시 에러 표시 확인
- [ ] 옵션 페이지 → "연결 테스트" 버튼 동작 확인
- [ ] 옵션 변경 후 팝업 재오픈 → 설정 자동 반영 확인
