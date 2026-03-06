const messages = {
  en: {
    "ext.articleBtn": "Clip Article",
    "ext.status.saving": "Saving to REBAR...",
    "ext.blockedPage": "This page cannot be clipped. Open a normal website tab and try again.",
    "ext.noHighlight": "Select text before saving",
    "ext.noArticle": "Could not extract article text",
    "ext.savedSuccess": "Saved to REBAR",
    "ext.opt.title": "REBAR Clipper Settings",
    "ext.opt.conn": "Connection",
    "ext.opt.connHint": "Enter the URL where your REBAR app is hosted (e.g., https://rebarops.com or http://localhost:3000). The extension will securely use your active browser login session.",
    "ext.opt.url": "REBAR URL",
    "ext.opt.prefs": "Capture Preferences",
    "ext.opt.tags": "Default Tags (comma separated)",
    "ext.opt.save": "Save Settings",
    "ext.opt.saved": "Settings saved",
    "ext.opt.invalidUrl": "Please enter a valid URL (https://...)",
    "ext.opt.testConn": "Test Connection",
    "ext.opt.connOk": "Connected and authenticated!",
    "ext.opt.connNoAuth": "Connected, but not logged in.",
    "ext.opt.connFail": "Cannot reach server.",
    "ui.cancel": "Cancel",
    "ext.status.ready": "Ready",
    "ext.openSettings": "Open Settings",
    "ext.status.checking": "Checking login...",
    "ext.tooManyReq": "Too many requests. Wait a moment.",
    "ext.highlightBtn": "Clip Selection",
    "ext.status.authRequired": "Login required. Please sign in to your REBAR instance.",
    "ext.saveFailed": "Save failed"
  },
  ko: {
    "ext.articleBtn": "아티클 스크랩",
    "ext.status.saving": "REBAR에 저장 중...",
    "ext.blockedPage": "이 페이지는 스크랩할 수 없습니다. 일반 웹사이트에서 다시 시도해주세요.",
    "ext.noHighlight": "저장할 텍스트를 먼저 선택해주세요.",
    "ext.noArticle": "아티클 텍스트를 추출할 수 없습니다.",
    "ext.savedSuccess": "REBAR에 저장되었습니다.",
    "ext.opt.title": "REBAR 클리퍼 설정",
    "ext.opt.conn": "연결 설정",
    "ext.opt.connHint": "운영 중인 REBAR 앱의 주소를 입력하세요 (예: https://rebarops.com 또는 http://localhost:3000). 설정된 REBAR 웹사이트에 로그인된 세션을 안전하게 공유하여 사용합니다.",
    "ext.opt.url": "REBAR 웹사이트 주소",
    "ext.opt.prefs": "스크랩 기본 설정",
    "ext.opt.tags": "기본 첨부 태그 (쉼표로 구분)",
    "ext.opt.save": "설정 저장하기",
    "ext.opt.saved": "설정이 저장되었습니다.",
    "ext.opt.invalidUrl": "올바른 URL을 입력해주세요 (https://...)",
    "ext.opt.testConn": "연결 테스트",
    "ext.opt.connOk": "연결 및 인증 성공!",
    "ext.opt.connNoAuth": "연결됨, 로그인 필요",
    "ext.opt.connFail": "서버에 연결할 수 없습니다.",
    "ui.cancel": "취소",
    "ext.status.ready": "준비 완료",
    "ext.openSettings": "설정 열기",
    "ext.status.checking": "로그인 확인 중...",
    "ext.tooManyReq": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
    "ext.highlightBtn": "선택 텍스트 스크랩",
    "ext.status.authRequired": "로그인이 필요합니다. REBAR에 로그인해주세요.",
    "ext.saveFailed": "저장 실패"
  }
}

function getLocale() {
  const lang = navigator.language || navigator.userLanguage
  return lang?.toLowerCase().startsWith("ko") ? "ko" : "en"
}

export function t(key) {
  const locale = getLocale()
  return messages[locale]?.[key] || messages.en[key] || key
}

export function initI18n() {
  document.documentElement.lang = getLocale()
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n")
    if (key) el.textContent = t(key)
  })
}
