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
      <h1 className="relative z-10 flex items-start gap-3 text-3xl font-black uppercase leading-none text-foreground transition-transform hover:translate-x-1 cursor-default sm:items-center sm:text-4xl md:text-5xl">
        <Database className="w-8 h-8 md:w-10 md:h-10 text-accent" strokeWidth={3} />
        <span className="text-glitch transition-all">{t("library.title", "LIBRARY")}</span>
      </h1>
      <div className="relative z-10 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center md:gap-3">
        <span className="min-h-[44px] flex w-full flex-col justify-center border-[3px] md:border-4 border-foreground bg-background px-3 py-1 font-mono text-xs font-bold uppercase text-foreground shadow-brutal-sm sm:w-auto sm:flex-row sm:items-center md:text-sm">
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
          className="max-md:hidden btn-cta"
        >
          <Plus className="w-4 h-4 mr-2" />
          {t("library.newRecord", "NEW RECORD")}
        </Link>
      </div>
    </header>
  )
}
