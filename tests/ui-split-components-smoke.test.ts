import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { CaptureImportModeTabs } from "../app/(features)/capture/_components/capture-import-mode-tabs"
import { LibraryPagination } from "../app/(features)/library/_components/library-pagination"
import { NavMobileBottom } from "@shared/layout/_components/nav-mobile-bottom"

function t(_key: string, fallback?: string): string {
  return fallback ?? _key
}

describe("split component smoke coverage", () => {
  it("renders capture mode tabs with active mode description", () => {
    const html = renderToStaticMarkup(
      createElement(CaptureImportModeTabs, {
        importMode: "ocr",
        setImportMode: () => {
          return undefined
        },
        t
      })
    )

    expect(html.includes("MANUAL")).toBe(true)
    expect(html.includes("OCR")).toBe(true)
    expect(html.includes("이미지에서 텍스트 추출 후 저장")).toBe(true)
  })

  it("hides pagination when next page does not exist", () => {
    const html = renderToStaticMarkup(
      createElement(LibraryPagination, {
        t,
        hasNext: false,
        isFetching: false,
        onLoadMore: () => {
          return undefined
        }
      })
    )

    expect(html).toBe("")
  })

  it("renders loading label when pagination is fetching", () => {
    const html = renderToStaticMarkup(
      createElement(LibraryPagination, {
        t,
        hasNext: true,
        isFetching: true,
        onLoadMore: () => {
          return undefined
        }
      })
    )

    expect(html.includes("LOADING...")).toBe(true)
  })

  it("renders mobile bottom nav with capture accessible label", () => {
    const html = renderToStaticMarkup(
      createElement(NavMobileBottom, {
        pathname: "/capture"
      })
    )

    expect(html.includes('aria-label="Capture"')).toBe(true)
    expect(html.includes("LIBRARY")).toBe(true)
    expect(html.includes("REVIEW")).toBe(true)
    expect(html.includes("SEARCH")).toBe(true)
  })
})
