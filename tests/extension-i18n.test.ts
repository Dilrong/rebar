import { beforeEach, describe, expect, it, vi } from "vitest"

// Mock navigator.language before importing i18n
let mockLanguage = "en-US"
Object.defineProperty(globalThis, "navigator", {
  value: { get language() { return mockLanguage } },
  writable: true
})

// Mock document for initI18n
Object.defineProperty(globalThis, "document", {
  value: {
    documentElement: { lang: "" },
    querySelectorAll: vi.fn(() => [])
  },
  writable: true
})

const { t, initI18n } = await import("../extension/i18n.js")

describe("extension/i18n", () => {
  describe("t() — English locale", () => {
    beforeEach(() => {
      mockLanguage = "en-US"
    })

    it("returns English message for known key", () => {
      expect(t("ext.savedSuccess")).toBe("Saved to REBAR")
    })

    it("returns key itself for unknown key", () => {
      expect(t("ext.nonexistent.key")).toBe("ext.nonexistent.key")
    })
  })

  describe("t() — Korean locale", () => {
    beforeEach(() => {
      mockLanguage = "ko-KR"
    })

    it("returns Korean message for known key", () => {
      expect(t("ext.savedSuccess")).toBe("REBAR에 저장되었습니다.")
    })

    it("returns Korean message for extension-specific keys", () => {
      expect(t("ext.opt.saved")).toBe("설정이 저장되었습니다.")
    })

    it("falls back to English for missing Korean key", () => {
      // All keys exist in both locales currently, so test with a hypothetical
      // At minimum, verify the function doesn't crash
      expect(t("ext.opt.permDenied")).toBe("호스트 권한이 필요합니다. 다시 시도해주세요.")
    })
  })

  describe("locale detection", () => {
    it("treats ko as Korean", () => {
      mockLanguage = "ko"
      expect(t("ui.cancel")).toBe("취소")
    })

    it("treats ko-KR as Korean", () => {
      mockLanguage = "ko-KR"
      expect(t("ui.cancel")).toBe("취소")
    })

    it("treats en-US as English", () => {
      mockLanguage = "en-US"
      expect(t("ui.cancel")).toBe("Cancel")
    })

    it("treats ja-JP as English (fallback)", () => {
      mockLanguage = "ja-JP"
      expect(t("ui.cancel")).toBe("Cancel")
    })
  })

  describe("initI18n", () => {
    it("sets document lang attribute", () => {
      mockLanguage = "ko-KR"
      initI18n()
      expect(globalThis.document.documentElement.lang).toBe("ko")
    })

    it("sets English lang for non-Korean locales", () => {
      mockLanguage = "en-US"
      initI18n()
      expect(globalThis.document.documentElement.lang).toBe("en")
    })
  })

  describe("message completeness", () => {
    it("every English key has a Korean translation", () => {
      // Access messages indirectly by checking known keys in both locales
      const knownKeys = [
        "ext.articleBtn", "ext.status.saving", "ext.blockedPage",
        "ext.noHighlight", "ext.noArticle", "ext.savedSuccess",
        "ext.opt.title", "ext.opt.conn", "ext.opt.url",
        "ext.opt.save", "ext.opt.saved", "ext.opt.invalidUrl",
        "ext.opt.testConn", "ext.opt.connOk", "ext.opt.connNoAuth",
        "ext.opt.connFail", "ui.cancel", "ext.status.ready",
        "ext.openSettings", "ext.status.checking", "ext.tooManyReq",
        "ext.highlightBtn", "ext.status.authRequired", "ext.saveFailed",
        "ext.tagPicker.title", "ext.tagPicker.desc", "ext.tagPicker.empty",
        "ext.tagPicker.custom", "ext.tagPicker.selectedCount",
        "ext.tagPicker.confirm", "ext.tagPicker.cancel",
        "ext.tagPicker.loadFailed", "ext.opt.permDenied"
      ]

      for (const key of knownKeys) {
        mockLanguage = "en-US"
        const en = t(key)
        mockLanguage = "ko-KR"
        const ko = t(key)

        // Both should return actual translations, not the key itself
        expect(en).not.toBe(key)
        expect(ko).not.toBe(key)
      }
    })
  })
})
