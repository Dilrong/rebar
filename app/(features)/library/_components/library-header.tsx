import Link from "next/link"
import { Database, Plus } from "lucide-react"
import type { KeyboardEvent as ReactKeyboardEvent, MutableRefObject, RefObject } from "react"
import { LibraryExportMenu } from "./library-export-menu"

type LibraryHeaderProps = {
  t: (key: string, fallback?: string) => string
  totalRows: number
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

export function LibraryHeader({
  t,
  totalRows,
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
}: LibraryHeaderProps) {
  return (
    <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end justify-between border-b-[3px] md:border-b-4 border-foreground pb-3 md:pb-4 gap-3 md:gap-4">
      <h1 className="font-black text-4xl md:text-5xl uppercase text-foreground leading-none flex items-center gap-3 md:gap-4">
        <Database className="w-8 h-8 md:w-10 md:h-10" strokeWidth={3} />
        {t("library.title", "VAULT")}
      </h1>
      <div className="flex items-center gap-2 md:gap-3">
        <span className="min-h-[44px] flex items-center justify-center font-mono text-xs md:text-sm font-bold bg-foreground text-background px-3 py-2 uppercase">
          {t("library.rows", "ROWS")}: {totalRows}
        </span>
        <LibraryExportMenu
          t={t}
          exportMenuOpen={exportMenuOpen}
          exportPending={exportPending}
          exportMenuWrapRef={exportMenuWrapRef}
          exportTriggerRef={exportTriggerRef}
          exportItemRefs={exportItemRefs}
          onToggleMenu={onToggleMenu}
          onOpenMenuFromKeyboard={onOpenMenuFromKeyboard}
          onCloseMenu={onCloseMenu}
          onExportMarkdown={onExportMarkdown}
          onExportObsidian={onExportObsidian}
          onMenuItemKeyDown={onMenuItemKeyDown}
        />
        <Link
          href="/capture"
          className="max-md:hidden min-h-[44px] inline-flex items-center justify-center gap-2 font-mono text-xs font-bold uppercase border-4 border-foreground px-4 py-3 bg-background hover:bg-foreground hover:text-background shadow-brutal-sm transition-transform active:translate-y-[2px] active:translate-x-[2px]"
        >
          <Plus className="w-4 h-4" />
          {t("library.newRecord", "NEW RECORD")}
        </Link>
      </div>
    </header>
  )
}
