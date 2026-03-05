import Link from "next/link"
import { BookOpen, CheckSquare, Plus, Search } from "lucide-react"
import { cn } from "@/lib/utils"

type NavMobileBottomProps = {
  pathname: string
  onOpenQuickSearch: () => void
}

export function NavMobileBottom({ pathname, onOpenQuickSearch }: NavMobileBottomProps) {
  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t-4 border-foreground bg-background shadow-none pb-[env(safe-area-inset-bottom)]">
      <div className="flex flex-row items-center justify-around px-1 py-1 relative">
        <Link
          href="/library"
          className={cn(
            "flex flex-col items-center justify-center p-3 min-w-[64px] transition-colors",
            pathname.includes("/library") ? "text-accent" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <BookOpen className="h-6 w-6 stroke-[2.5]" />
          <span className="font-mono text-[9px] font-bold uppercase mt-1.5">LIBRARY</span>
        </Link>

        <Link
          href="/review"
          className={cn(
            "flex flex-col items-center justify-center p-3 min-w-[64px] transition-colors",
            pathname.includes("/review") ? "text-accent" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <CheckSquare className="h-6 w-6 stroke-[2.5]" />
          <span className="font-mono text-[9px] font-bold uppercase mt-1.5">REVIEW</span>
        </Link>

        <Link
          href="/capture"
          className="flex flex-col flex-1 items-center justify-center relative -top-5"
          aria-label="Capture"
        >
          <div className={cn(
            "flex h-[60px] w-[60px] items-center justify-center border-[3px] border-foreground bg-accent shadow-brutal-sm transition-transform active:translate-y-1 active:shadow-none rounded-none rotate-3",
            pathname === "/capture" && "bg-foreground text-background"
          )}>
            <Plus className="h-8 w-8 text-white stroke-[3] -rotate-3" />
          </div>
          <span className="sr-only">Capture</span>
        </Link>

        <button
          type="button"
          onClick={onOpenQuickSearch}
          className="flex flex-col items-center justify-center p-3 min-w-[64px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Search className="h-6 w-6 stroke-[2.5]" />
          <span className="font-mono text-[9px] font-bold uppercase mt-1.5">SEARCH</span>
        </button>
      </div>
    </div>
  )
}
