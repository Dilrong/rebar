/* @vitest-environment jsdom */

import type { AnchorHTMLAttributes, ReactNode } from "react"
import { createElement, useState } from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { CaptureImportModeTabs } from "../../app/(features)/capture/_components/capture-import-mode-tabs"
import { LibraryFiltersToolbar } from "../../app/(features)/library/_components/library-filters-toolbar"
import { LibraryHeader } from "../../app/(features)/library/_components/library-header"
import { LibraryPagination } from "../../app/(features)/library/_components/library-pagination"
import { ReviewCurrentCard } from "../../app/(features)/review/_components/review-current-card"
import { NavMobileBottom } from "@shared/layout/_components/nav-mobile-bottom"

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) =>
    createElement("a", { href, ...props }, children)
}))

vi.mock("@shared/ui/markdown-content", () => ({
  MarkdownContent: ({ content }: { content: string }) => createElement("div", null, content)
}))

vi.mock("@shared/ui/loading", () => ({
  LoadingDots: () => createElement("span", null, "...")
}))

vi.mock("@shared/ui/error-state", () => ({
  ErrorState: ({ message }: { message: string }) => createElement("div", null, message)
}))

function t(_key: string, fallback?: string): string {
  return fallback ?? _key
}

function CaptureImportTabsHarness() {
  const [importMode, setImportMode] = useState<"manual" | "url" | "batch" | "csv" | "ocr">("manual")

  return createElement(CaptureImportModeTabs, { importMode, setImportMode, t })
}

describe("split components interaction (jsdom)", () => {
  it("switches capture import mode description on tab clicks", () => {
    render(createElement(CaptureImportTabsHarness))

    expect(screen.getByText("직접 입력으로 1건 저장")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "URL" }))
    expect(screen.getByText("URL에서 메타데이터를 읽어 빠르게 캡처")).toBeTruthy()

    fireEvent.click(screen.getByRole("button", { name: "OCR" }))
    expect(screen.getByText("이미지에서 텍스트 추출 후 저장")).toBeTruthy()
  })

  it("calls load more callback and reflects fetching disabled state", () => {
    const onLoadMore = vi.fn()

    const { rerender } = render(
      createElement(LibraryPagination, {
        t,
        hasNext: true,
        isFetching: false,
        onLoadMore
      })
    )

    const loadMoreButton = screen.getByRole("button", { name: "더 불러오기 ↓" })
    fireEvent.click(loadMoreButton)
    expect(onLoadMore).toHaveBeenCalledTimes(1)

    rerender(
      createElement(LibraryPagination, {
        t,
        hasNext: true,
        isFetching: true,
        onLoadMore
      })
    )
    const loadingButton = screen.getByRole("button", { name: "LOADING..." })
    expect((loadingButton as HTMLButtonElement).disabled).toBe(true)
  })

  it("renders mobile search navigation link", () => {
    render(
      createElement(NavMobileBottom, {
        pathname: "/capture"
      })
    )

    const searchLink = screen.getByRole("link", { name: "SEARCH" })
    expect(searchLink.getAttribute("href")).toBe("/search")
    expect(screen.getByLabelText("Capture")).toBeTruthy()
  })

  it("updates library filters via query/sort controls and clear all", () => {
    const onStateChange = vi.fn()
    const onKindChange = vi.fn()
    const onQueryChange = vi.fn()
    const onTagChange = vi.fn()
    const onSortOrderChange = vi.fn()
    const onClearAllFilters = vi.fn()

    render(
      createElement(LibraryFiltersToolbar, {
        t,
        state: "INBOX",
        kind: "link",
        q: "hello",
        tagId: "tag-1",
        sort: "created_at",
        order: "desc",
        selectedTagName: "work",
        tags: [{ id: "tag-1", user_id: "user-1", name: "work" }],
        onStateChange,
        onKindChange,
        onQueryChange,
        onTagChange,
        onSortOrderChange,
        onClearAllFilters
      })
    )

    fireEvent.change(screen.getByPlaceholderText("Search content/title"), { target: { value: "updated" } })
    expect(onQueryChange).toHaveBeenCalledWith("updated")

    fireEvent.change(screen.getByRole("combobox", { name: "Sort order" }), { target: { value: "due_at:asc" } })
    expect(onSortOrderChange).toHaveBeenCalledWith("due_at", "asc")

    fireEvent.click(screen.getByRole("button", { name: "Clear all" }))
    expect(onClearAllFilters).toHaveBeenCalledTimes(1)
  })

  it("updates export since input and dispatches extended export formats", () => {
    const onExportSinceChange = vi.fn()
    const onClearExportSince = vi.fn()
    const onExport = vi.fn()

    const { container } = render(
      createElement(LibraryHeader, {
        t,
        totalRows: 3,
        exportSince: "2026-03-01",
        exportScopeLabel: "Pinned · #work · 2026-03-01",
        exportSincePresets: [
          { key: "library.exportPresetToday", fallback: "TODAY", value: "2026-03-09" },
          { key: "library.exportPreset7d", fallback: "LAST 7D", value: "2026-03-02" }
        ],
        exportMenuOpen: true,
        exportPending: false,
        exportMenuWrapRef: { current: null },
        exportTriggerRef: { current: null },
        exportItemRefs: { current: [] },
        onExportSinceChange,
        onClearExportSince,
        onToggleMenu: vi.fn(),
        onOpenMenuFromKeyboard: vi.fn(),
        onCloseMenu: vi.fn(),
        onExport,
        onMenuItemKeyDown: vi.fn()
      })
    )

    fireEvent.change(within(container).getByDisplayValue("2026-03-01"), { target: { value: "2026-03-05" } })
    expect(onExportSinceChange).toHaveBeenCalledWith("2026-03-05")

    fireEvent.click(within(container).getByRole("button", { name: "LAST 7D" }))
    expect(onExportSinceChange).toHaveBeenCalledWith("2026-03-02")
    expect(within(container).getByText("CURRENT SCOPE: Pinned · #work · 2026-03-01")).toBeTruthy()
    fireEvent.click(within(container).getByRole("button", { name: "CLEAR" }))
    expect(onClearExportSince).toHaveBeenCalledTimes(1)

    fireEvent.click(within(container).getByRole("menuitem", { name: "JSON (.json)" }))
    fireEvent.click(within(container).getByRole("menuitem", { name: "CSV (.csv)" }))

    expect(onExport).toHaveBeenCalledWith("json")
    expect(onExport).toHaveBeenCalledWith("csv")
  })

  it("dispatches review card triage and retry actions", () => {
    const onArchive = vi.fn()
    const onToggleAct = vi.fn()
    const onToggleDefer = vi.fn()
    const onSelectAct = vi.fn()
    const onSelectDefer = vi.fn()
    const onRetry = vi.fn()

    render(
      createElement(ReviewCurrentCard, {
        t,
        record: {
          id: "11111111-1111-1111-1111-111111111111",
          user_id: "user-1",
          source_id: "src-1",
          kind: "note",
          content: "Review me",
          content_hash: "hash",
          url: null,
          source_title: "Source",
          favicon_url: null,
          current_note: null,
          note_updated_at: null,
          adopted_from_ai: false,
          state: "INBOX",
          interval_days: 1,
          due_at: null,
          last_reviewed_at: null,
          review_count: 0,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z"
        },
        mutationPending: false,
        archivePending: false,
        actExpanded: true,
        deferExpanded: true,
        errorMessage: "boom",
        onArchive,
        onToggleAct,
        onToggleDefer,
        onSelectAct,
        onSelectDefer,
        onRetry
      })
    )

    fireEvent.click(screen.getByRole("button", { name: "보관" }))
    fireEvent.click(screen.getByRole("button", { name: "실행" }))
    fireEvent.click(screen.getByRole("button", { name: "보류" }))
    fireEvent.click(screen.getByRole("button", { name: "실험" }))
    fireEvent.click(screen.getByRole("button", { name: "정보부족" }))
    fireEvent.click(screen.getByRole("button", { name: "다시 시도" }))

    expect(onArchive).toHaveBeenCalledTimes(1)
    expect(onToggleAct).toHaveBeenCalledTimes(1)
    expect(onToggleDefer).toHaveBeenCalledTimes(1)
    expect(onSelectAct).toHaveBeenCalledWith("EXPERIMENT")
    expect(onSelectDefer).toHaveBeenCalledWith("NEED_INFO")
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
