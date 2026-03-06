import { Download } from "lucide-react"
import type { KeyboardEvent as ReactKeyboardEvent, MutableRefObject, RefObject } from "react"

type LibraryExportMenuProps = {
  t: (key: string, fallback?: string) => string
  exportMenuOpen: boolean
  exportPending: boolean
  exportMenuWrapRef: RefObject<HTMLDivElement | null>
  exportTriggerRef: RefObject<HTMLButtonElement | null>
  exportItemRefs: MutableRefObject<Array<HTMLButtonElement | null>>
  onToggleMenu: () => void
  onOpenMenuFromKeyboard: () => void
  onCloseMenu: () => void
  onExportMarkdown: () => void
  onExportObsidian: () => void
  onMenuItemKeyDown: (event: ReactKeyboardEvent<HTMLButtonElement>) => void
}

export function LibraryExportMenu({
  t,
  exportMenuOpen,
  exportPending,
  exportMenuWrapRef,
  exportTriggerRef,
  exportItemRefs,
  onToggleMenu,
  onOpenMenuFromKeyboard,
  onCloseMenu,
  onExportMarkdown,
  onExportObsidian,
  onMenuItemKeyDown
}: LibraryExportMenuProps) {
  return (
    <div ref={exportMenuWrapRef} className="relative w-full sm:w-auto">
      <button
        ref={exportTriggerRef}
        type="button"
        onClick={onToggleMenu}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault()
            onOpenMenuFromKeyboard()
          }
        }}
        disabled={exportPending}
        className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 border-4 border-foreground bg-background px-4 py-3 font-mono text-xs font-bold uppercase shadow-brutal-sm transition-transform active:translate-y-[2px] active:translate-x-[2px] hover:bg-foreground hover:text-background disabled:opacity-60 sm:w-auto"
        aria-haspopup="menu"
        aria-expanded={exportMenuOpen}
        aria-controls="library-export-menu"
      >
        <Download className="h-4 w-4" />
        {exportPending ? t("library.exporting", "EXPORTING...") : `${t("library.export", "EXPORT")} ▾`}
      </button>
      {exportMenuOpen ? (
        <div id="library-export-menu" role="menu" className="absolute left-0 right-0 z-20 mt-1 border-2 border-foreground bg-background sm:left-auto sm:right-0 sm:min-w-[180px]">
          <button
            ref={(node) => {
              exportItemRefs.current[0] = node
            }}
            type="button"
            onClick={() => {
              onCloseMenu()
              onExportMarkdown()
            }}
            onKeyDown={onMenuItemKeyDown}
            className="block w-full border-b border-foreground px-3 py-2 text-left font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background min-h-[44px]"
            role="menuitem"
          >
            Markdown (.md)
          </button>
          <button
            ref={(node) => {
              exportItemRefs.current[1] = node
            }}
            type="button"
            onClick={() => {
              onCloseMenu()
              onExportObsidian()
            }}
            onKeyDown={onMenuItemKeyDown}
            className="block w-full px-3 py-2 text-left font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background min-h-[44px]"
            role="menuitem"
          >
            Obsidian (frontmatter)
          </button>
        </div>
      ) : null}
    </div>
  )
}
