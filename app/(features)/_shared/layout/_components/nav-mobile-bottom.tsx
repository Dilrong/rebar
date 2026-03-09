import Link from "next/link"
import { BookOpen, CheckSquare, Plus, Search } from "lucide-react"
import { cn } from "@/lib/utils"

type NavMobileBottomProps = {
  pathname: string
  captureSheetOpen?: boolean
  onOpenCapture?: () => void
}

export function NavMobileBottom({ pathname, captureSheetOpen = false, onOpenCapture }: NavMobileBottomProps) {
  return (
    <div className="md:hidden fixed bottom-0 left-[calc(50%-50vw)] right-[calc(50%-50vw)] z-40 border-t-[3px] border-foreground bg-background bg-noise shadow-[0_-8px_0_0_rgba(0,0,0,1)] dark:shadow-[0_-8px_0_0_rgba(255,255,255,0.05)] pb-[env(safe-area-inset-bottom)]">
      <div className="relative grid min-h-[72px] grid-cols-4 items-end">
        <Link
          href="/library"
          className={cn(
            "flex min-h-[72px] w-full flex-col items-center justify-center px-2 py-3 transition-all duration-200 active:translate-y-1",
            pathname.includes("/library") ? "text-accent text-glitch" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <BookOpen className="h-6 w-6 stroke-[2.5]" />
          <span className="font-mono text-[9px] font-bold uppercase mt-1.5">LIBRARY</span>
        </Link>

        <Link
          href="/review"
          className={cn(
            "flex min-h-[72px] w-full flex-col items-center justify-center px-2 py-3 transition-all duration-200 active:translate-y-1",
            pathname.includes("/review") ? "text-accent text-glitch" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <CheckSquare className="h-6 w-6 stroke-[2.5]" />
          <span className="font-mono text-[9px] font-bold uppercase mt-1.5">REVIEW</span>
        </Link>

        <button
          type="button"
          onClick={onOpenCapture}
          className="relative -top-5 flex min-h-[72px] w-full flex-col items-center justify-center"
          aria-label="Capture"
        >
          <div className={cn(
            "flex h-[60px] w-[60px] items-center justify-center border-[3px] border-foreground bg-accent shadow-brutal transition-all duration-200 active:translate-y-1 active:shadow-none rounded-none rotate-3",
            (pathname === "/capture" || captureSheetOpen) && "bg-foreground text-background rotate-0 translate-y-1 shadow-none"
          )}>
            <Plus className="h-8 w-8 text-white stroke-[3] -rotate-3" />
          </div>
          <span className="sr-only">Capture</span>
        </button>

        <Link
          href="/search"
          className={cn(
            "flex min-h-[72px] w-full flex-col items-center justify-center px-2 py-3 transition-all duration-200 active:translate-y-1",
            pathname.includes("/search") ? "text-accent text-glitch" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Search className="h-6 w-6 stroke-[2.5]" />
          <span className="font-mono text-[10px] font-bold uppercase mt-1.5">SEARCH</span>
        </Link>
      </div>
    </div>
  )
}
