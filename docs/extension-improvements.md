# REBAR Clipper Extension — Improvement Plan

> **Status**: In progress
> **Scope**: `extension/` 디렉토리 전체 (manifest.json, background.js, content.js, popup.*, options.*)
> **Total LOC**: ~869줄 (9 files)

## 구현 반영 로그

- 2026-02-27: P0 URL 쿼리 전달 제거 및 직접 POST 저장 적용
  - `extension/background.js`: `/api/capture/share` 직접 POST로 전환, URL 쿼리 전달/트리밍 로직 제거
  - `extension/shared.js`: `DEFAULT_SETTINGS`, `parseTags`, `normalizeBaseUrl` 공통화
  - `extension/options.html`, `extension/options.js`: API Key(선택) 입력/저장 추가
  - `extension/popup.html`, `extension/popup.js`: "Open REBAR Share" 흐름을 "Save to REBAR" 저장 흐름으로 변경

---

## 현재 아키텍처 요약

```
Popup (popup.js)
  ├─ content.js에 GET_SELECTION / GET_ARTICLE 메시지 → 페이로드 수신
  ├─ 프리뷰 UI 표시 (태그 제안, 편집 가능)
  └─ SAVE_CAPTURE 메시지 → background.js

Background (background.js)
  ├─ 설정(chrome.storage.sync) 관리
  └─ openSharePage(): URL 쿼리 파라미터에 콘텐츠를 담아 /share?... 탭 열기

Content Script (content.js)
  ├─ getSelectionPayload(): 선택 텍스트 캡처
  └─ getArticlePayload(): DOM에서 본문 추출

Options (options.js)
  └─ apiBaseUrl, defaultTags, enableDomainTags 설정 관리

Share Page (app/share/page.tsx)
  └─ URL 파라미터 파싱 → auto=1이면 자동 POST /api/capture/share
```

---

## P0 — 보안: URL 파라미터 데이터 노출

### 문제

`background.js:29-62`에서 콘텐츠, 제목, URL, 태그를 **URL 쿼리 파라미터**로 전달한다.

```js
const shareUrl = `${settings.apiBaseUrl}/share?${params.toString()}`
await chrome.tabs.create({ url: shareUrl })
```

**위험 요소:**
- 브라우저 히스토리에 전체 콘텐츠 노출
- 서버 access log에 쿼리스트링 기록
- Referrer 헤더로 제3자 사이트에 유출 가능
- 브라우저 주소창에 전체 콘텐츠 노출
- URL 길이 제한(~8KB)으로 대용량 콘텐츠 손실

### 해결 방향

**옵션 A — Background에서 직접 POST (권장)**

background.js가 `/api/capture/share`에 직접 `fetch()` POST 요청을 보내고, 성공 시 결과 탭(캡처 완료 페이지)을 여는 방식. 인증이 필요하므로 쿠키 기반이면 `credentials: "include"`, API key면 설정에서 키를 관리해야 한다.

```
[변경 파일]
- extension/background.js: openSharePage() → fetch POST 방식으로 교체
- extension/options.html / options.js: API Key 입력 필드 추가 (Bearer token 또는 API key)
- extension/popup.js: 결과 처리 로직 수정 (탭 열기 대신 성공/실패 피드백)
```

장점: 데이터가 URL에 노출되지 않음, 2500자 트리밍 제한 불필요, 깔끔한 UX
단점: 인증 토큰 관리 필요

**옵션 B — POST로 Share 페이지에 전달 (차선)**

새 탭을 열되, 콘텐츠는 `chrome.storage.local`에 일시 저장 → Share 페이지가 로드 시 storage에서 읽어오는 방식.

```
[변경 파일]
- extension/background.js: storage.local.set → 탭 열기 (/share?clipId=xxx)
- app/share/page.tsx: clipId 파라미터로 storage에서 데이터 로드
```

장점: 기존 Share 페이지 UX 유지
단점: 크로스-오리진 storage 접근 문제(content script 주입 또는 message passing 필요)

### 구현 가이드 (옵션 A 기준)

1. `options.html`에 "API Key" 입력 필드 추가, `options.js`에서 `chrome.storage.sync`에 저장
2. `background.js`의 `openSharePage()`를 다음과 같이 변경:
   ```js
   async function saveCapture(payload) {
     const settings = await getSettings()
     const tags = Array.from(new Set([
       ...(payload.tags || []),
       ...parseTags(settings.defaultTags)
     ]))
     const body = {
       content: payload.content,
       title: payload.title || undefined,
       url: payload.url || undefined,
       tags: tags.length > 0 ? tags : undefined
     }
     const res = await fetch(`${settings.apiBaseUrl}/api/capture/share`, {
       method: "POST",
       headers: {
         "Content-Type": "application/json",
         "Authorization": `Bearer ${settings.apiKey}`
       },
       body: JSON.stringify(body)
     })
     if (!res.ok) throw new Error(`Save failed: ${res.status}`)
     return res.json()
   }
   ```
3. `popup.js`에서 "Open REBAR Share" 버튼 → "Save to REBAR"로 변경, 성공 시 인라인 피드백 표시
4. MAX_QUERY_CONTENT_LENGTH 제한과 트리밍 로직 제거 (POST body는 길이 제한 없음)
5. `app/share/page.tsx`의 URL 파라미터 파싱 + auto submit 로직은 수동 폼용으로 유지하되, 익스텐션 경로와 분리

---

## P1 — 코드 품질: 중복 상수와 유틸

### 문제

`DEFAULT_SETTINGS`, `parseTags()`, `normalizeBaseUrl()`가 `background.js`, `popup.js`, `options.js`에 각각 중복 정의되어 있다.

| 함수/상수 | background.js | popup.js | options.js |
|-----------|:---:|:---:|:---:|
| DEFAULT_SETTINGS / DEFAULTS | L1-5 | (getSettings fallback) | L10-14 |
| parseTags() | L13-18 | L34-39 | — |
| normalizeBaseUrl() | L9-11 | — | L21-25 |

`normalizeBaseUrl()`는 `background.js`와 `options.js`에서 **구현이 다르다**:
- `background.js`: 단순 trailing slash 제거
- `options.js`: 프로토콜 자동 추가 + trailing slash 제거

### 해결

`extension/shared.js`(또는 `constants.js`) 파일을 만들어 공통 상수와 유틸을 한 곳에서 export한다.

```
[새 파일] extension/shared.js
  - DEFAULT_SETTINGS 객체
  - parseTags(tagText) → string[]
  - normalizeBaseUrl(value) → string (프로토콜 보정 포함)

[변경 파일]
- extension/background.js: import from shared.js, 로컬 정의 제거
- extension/popup.js: import from shared.js, 로컬 정의 제거
- extension/options.js: import from shared.js, 로컬 정의 제거
- extension/manifest.json: background.js는 이미 type: "module"이므로 OK.
  popup.js/options.js는 <script type="module">로 이미 로드됨.
  content.js는 manifest content_scripts로 주입되므로 ES module import 불가 →
  content.js에는 공유할 것이 없으므로 그대로 둔다.
```

---

## P1 — UX: 콘텐츠 트리밍 사전 경고

### 문제

`background.js:38-41`에서 2500자 초과 콘텐츠를 조용히 잘라낸다. 사용자가 프리뷰에서 긴 콘텐츠를 편집했는데, 전송 시 잘리는 것을 모른다. (P0에서 직접 POST로 전환하면 이 문제가 해소되지만, Share 페이지 방식을 유지하는 경우 필요.)

### 해결

`popup.js` 프리뷰의 Content textarea 아래에 글자수 카운터를 표시한다.

```
[변경 파일]
- extension/popup.html: textarea 아래에 <span id="charCount"> 추가
- extension/popup.js:
  - previewContentInput에 input 이벤트 리스너 추가
  - 2500자 초과 시 카운터를 빨간색으로 표시 + 경고 텍스트
```

---

## P1 — UX: chrome:// 및 특수 페이지 에러 처리

### 문제

`chrome://`, `chrome-extension://`, `edge://` 등 브라우저 내부 페이지에서 content script 주입이 실패한다. 현재 에러 메시지가 `"Cannot access contents of the page"` 같은 Chrome 기본 에러로 표시되어 사용자가 혼란스럽다.

### 해결

```
[변경 파일]
- extension/popup.js: runCapture() 내에서 tab.url을 먼저 체크
  - chrome://, edge://, about:, chrome-extension:// 접두어면
    "이 페이지에서는 클리핑할 수 없습니다" 친절한 메시지 표시
  - 빈 탭(chrome://newtab)도 처리
```

---

## P2 — 콘텐츠 추출: 하드코딩된 도메인 태그

### 문제

`popup.js:90-118`의 `guessDomainTags()`가 6개 도메인을 if-else 체인으로 판단한다. 확장성이 낮고, 사용자가 커스텀 규칙을 추가할 수 없다.

### 해결

도메인-태그 매핑을 설정 기반으로 변경한다.

```
[변경 파일]
- extension/shared.js (또는 별도 domain-tags.js):
  기본 매핑 객체 정의
  const DOMAIN_TAG_RULES = [
    { pattern: "youtube.com|youtu.be", tags: ["video", "youtube"] },
    { pattern: "github.com", tags: ["code", "github"] },
    { pattern: "medium.com", tags: ["article", "medium"] },
    { pattern: "x.com|twitter.com", tags: ["social", "x"] },
    { pattern: "reddit.com", tags: ["social", "reddit"] },
    { pattern: "naver.com", tags: ["korea", "naver"] },
  ]

- extension/popup.js: guessDomainTags()를 DOMAIN_TAG_RULES 기반으로 리팩토링
  function guessDomainTags(urlValue) {
    const host = new URL(urlValue).hostname.replace(/^www\./i, "").toLowerCase()
    return DOMAIN_TAG_RULES
      .filter(rule => rule.pattern.split("|").some(p => host.includes(p)))
      .flatMap(rule => rule.tags)
  }
```

**선택적 확장**: options 페이지에서 사용자 커스텀 도메인-태그 규칙 추가/삭제 UI를 제공할 수 있다. 이 경우 `chrome.storage.sync`에 사용자 규칙을 저장하고 기본 규칙과 합친다.

---

## P2 — 콘텐츠 추출: article 추출 품질 개선

### 문제

`content.js:30-51`의 `getArticleText()`가 단순 CSS 셀렉터 폴백 체인을 사용한다:
1. `article` → `main` → `[class*='content']` → `[class*='article']` → `body`
2. `[class*='content']`는 지나치게 넓어서 `sidebar-content`, `footer-content` 등을 매칭할 수 있다
3. `cloneWithoutNoise()`가 `<aside>`, `<form>`을 제거하지만 광고 div, 댓글 영역은 남음
4. 최소 180자 기준이 낮아서 네비게이션 텍스트만으로도 통과 가능

### 해결

```
[변경 파일]
- extension/content.js:
  1. 셀렉터 우선순위 개선:
     - [role="main"] 추가 (ARIA 역할 기반)
     - [class*='content']를 더 구체적 셀렉터로 교체:
       [class*='post-content'], [class*='entry-content'],
       [class*='article-body'], [class*='article-content'],
       [id*='article'], [id*='content']
  2. 노이즈 제거 강화:
     - 기존: script,style,noscript,svg,nav,header,footer,aside,form,button
     - 추가: [class*='comment'], [class*='sidebar'], [class*='ad-'],
             [class*='social'], [class*='share'], [class*='related'],
             [role='complementary'], [role='banner'], [role='navigation']
  3. 최소 기준 상향: 180 → 300자
  4. 후보 요소 점수제 도입 (선택적):
     - 텍스트 길이, <p> 태그 밀도, 링크 밀도(낮을수록 좋음) 기반 점수 산출
     - 가장 높은 점수의 후보 선택
```

---

## P2 — UX: 키보드 접근성

### 문제

- 프리뷰 폼 입력 필드에 `aria-label` 없음 (label 태그로 감싸고 있어 기본 접근성은 있지만, 명시적 `for` 속성 없음)
- 키보드 단축키 없음 (파워 유저가 마우스 없이 빠르게 클리핑하기 어려움)
- focus 상태 스타일이 브라우저 기본값 의존

### 해결

```
[변경 파일]
- extension/popup.html:
  - 각 input/textarea에 aria-label 추가
  - accesskey 속성 추가: Clip Highlight(h), Clip Article(a)

- extension/popup.css:
  - 커스텀 focus 스타일 추가:
    *:focus-visible { outline: 3px solid #111; outline-offset: 2px; }
    (Industrial Brutalism 스타일에 맞게 두꺼운 아웃라인)
```

---

## P2 — 안정성: Service Worker 생명주기

### 문제

Manifest v3 서비스 워커는 30초 유휴 시 unload된다. `background.js`의 `onMessage` 리스너는 워커가 활성화되어 있을 때만 동작한다. 일반적으로 popup이 메시지를 보내면 워커가 깨어나지만, 간헐적으로 타이밍 이슈가 발생할 수 있다.

### 해결

```
[변경 파일]
- extension/popup.js: sendCapture() / getSettings()에 재시도 로직 추가
  - chrome.runtime.lastError가 "Could not establish connection" 이면 500ms 후 1회 재시도
  - 최대 1회 재시도로 무한 루프 방지
```

---

## P3 — UX: 오프라인/실패 캡처 큐

### 문제

네트워크 실패 시 캡처가 유실된다. 직접 POST 방식(P0)으로 전환하면 네트워크 오류를 감지할 수 있지만, 재시도 메커니즘이 없다.

### 해결

```
[변경 파일]
- extension/background.js:
  - 캡처 실패 시 chrome.storage.local에 pending 큐 저장
  - chrome.alarms API로 주기적 재시도 (5분 간격)
  - 큐 최대 크기: 50건 (그 이상이면 가장 오래된 것부터 폐기)

- extension/popup.js:
  - 큐에 대기 중인 캡처 수를 배지 또는 상태 표시
  - "N개 캡처 대기 중" 메시지

- extension/manifest.json:
  - "alarms" 퍼미션 추가
```

---

## P3 — UX: 캡처 성공 피드백 강화

### 문제

현재 "Opened. Finish on REBAR Share page." 메시지만 표시된다. 사용자가 실제로 저장이 완료되었는지 알기 어렵다.

### 해결 (P0 직접 POST 전환 후)

```
[변경 파일]
- extension/popup.js:
  - 성공 시: 초록색 체크 아이콘 + "Saved to REBAR" + 3초 후 자동 닫기
  - 실패 시: 빨간색 X 아이콘 + 에러 메시지 + "Retry" 버튼
- extension/popup.css:
  - 성공/실패 상태 스타일 추가
```

---

## P3 — 코드 품질: Content Script 중복 주입 방지

### 문제

`manifest.json`의 `content_scripts`로 모든 페이지에 content.js를 자동 주입하는 동시에, `popup.js:187-204`의 `injectContentScript()`로 수동 주입도 한다. 이중 주입 시 `onMessage` 리스너가 2개 등록되어 응답이 중복될 수 있다.

### 해결

두 가지 옵션 중 택 1:

**옵션 A — manifest 자동 주입 제거 (권장)**
```
[변경 파일]
- extension/manifest.json: content_scripts 섹션 제거
- extension/popup.js: 항상 injectContentScript() 호출 (현재 try-catch 패턴 유지)
```

장점: 필요한 페이지에서만 주입, 리소스 절약
단점: 첫 주입 시 약간의 지연

**옵션 B — 수동 주입 제거**
```
[변경 파일]
- extension/popup.js: injectContentScript() 제거, sendMessageToTab() 실패 시
  "페이지를 새로고침한 후 다시 시도하세요" 메시지 표시
```

---

## P3 — 스타일: Construction Orange 액센트 누락

### 문제

REBAR의 디자인 시스템은 Industrial Brutalism + **Construction Orange (#FF6600 또는 유사)** 액센트를 사용하지만, 익스텐션 UI는 순수 흑백(#111 + #fff)으로만 구성되어 있다. 본 앱과의 시각적 일관성이 부족하다.

### 해결

```
[변경 파일]
- extension/popup.css:
  - 주요 액션 버튼(Clip Highlight, Open REBAR Share)에 Construction Orange 배경 적용
  - hover 시 더 진한 오렌지 또는 반전
  - .badge ON 상태에 오렌지 강조

- extension/options.css:
  - Save 버튼에 동일한 오렌지 적용
```

---

## 구현 순서 권장

| 순서 | 항목 | 우선순위 | 의존성 |
|:---:|------|:---:|------|
| 1 | 공통 모듈 추출 (shared.js) | P1 | 없음 — 이후 작업의 기반 |
| 2 | URL 파라미터 → 직접 POST 전환 | P0 | shared.js, Options에 API key 필드 |
| 3 | 콘텐츠 글자수 카운터 | P1 | POST 전환 후에도 프리뷰 UX로 유효 |
| 4 | chrome:// 페이지 에러 처리 | P1 | 없음 |
| 5 | 도메인 태그 설정 기반 전환 | P2 | shared.js |
| 6 | Article 추출 개선 | P2 | 없음 |
| 7 | 키보드 접근성 | P2 | 없음 |
| 8 | Service Worker 재시도 | P2 | 없음 |
| 9 | 캡처 성공 피드백 강화 | P3 | POST 전환 후 |
| 10 | 오프라인 캡처 큐 | P3 | POST 전환 후 |
| 11 | Content Script 중복 주입 정리 | P3 | 없음 |
| 12 | Construction Orange 액센트 | P3 | 없음 |

---

## 참고: 현재 코드의 장점 (유지할 것)

- **깔끔한 관심사 분리**: content.js(DOM) / background.js(설정+라우팅) / popup.js(UI)
- **방어적 프로그래밍**: try-catch, chrome.runtime.lastError 체크
- **스마트 폴백**: content script 주입 실패 시 수동 주입 시도
- **태그 중복 제거**: Set 기반 dedup
- **적절한 콘텐츠 정리**: noise 요소 제거, whitespace 정규화
- **Manifest v3 준수**: 서비스 워커, 올바른 퍼미션
