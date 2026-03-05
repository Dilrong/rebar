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
    <header className="mb-6 md:mb-8 flex flex-col md:flex-row md:items-end justify-between border-[3px] md:border-4 border-foreground pb-4 p-4 md:p-6 bg-noise relative overflow-hidden shadow-brutal-sm md:shadow-brutal gap-4 md:gap-6 bg-card transition-all duration-300">
      <div className="absolute top-0 right-0 w-16 h-16 md:w-24 md:h-24 bg-accent opacity-20 pointer-events-none" style={{ clipPath: 'polygon(100% 0, 0 0, 100% 100%)' }} />
      <h1 className="font-black text-4xl sm:text-5xl uppercase text-foreground leading-none flex items-center gap-3 relative z-10 transition-transform hover:translate-x-1 cursor-default">
        <Database className="w-8 h-8 md:w-10 md:h-10 text-accent" strokeWidth={3} />
        <span className="text-glitch transition-all">{t("library.title", "VAULT")}</span>
      </h1>
      <div className="flex flex-wrap items-center gap-2 md:gap-3 relative z-10">
        <span className="min-h-[44px] flex flex-col md:flex-row md:items-center justify-center font-mono text-xs md:text-sm font-bold border-[3px] md:border-4 border-foreground text-foreground bg-background px-3 py-1 shadow-brutal-sm uppercase">
          <span className="opacity-80 text-[10px] md:mr-2 tracking-widest">{t("library.rows", "ROWS")}:</span>
          <span className="font-black text-lg leading-none">{totalRows}</span>
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
