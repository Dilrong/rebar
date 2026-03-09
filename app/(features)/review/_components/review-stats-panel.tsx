import { Flame } from "lucide-react"

type ReviewStatsPanelProps = {
  reviewed: number
  remaining: number
  streakDays: number
  totalRecords: number
}

export function ReviewStatsPanel({ reviewed, remaining, streakDays, totalRecords }: ReviewStatsPanelProps) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-2 border-[3px] md:border-4 border-foreground bg-card bg-noise p-4 md:p-6 md:grid-cols-4 shadow-brutal-sm md:shadow-brutal relative overflow-hidden">
      <div className="absolute inset-0 bg-accent/5 pointer-events-none" />
      <p className="font-mono text-xs font-bold uppercase relative z-10 flex flex-col gap-1">
        <span className="text-muted-foreground opacity-80 text-[10px] tracking-wider">REVIEWED</span>
        <span className="text-lg md:text-xl text-foreground font-black">{reviewed}</span>
      </p>
      <p className="font-mono text-xs font-bold uppercase relative z-10 flex flex-col gap-1">
        <span className="text-muted-foreground opacity-80 text-[10px] tracking-wider">REMAINING</span>
        <span className="text-lg md:text-xl text-foreground font-black">{remaining}</span>
      </p>
      <p className="font-mono text-xs font-bold uppercase relative z-10 flex flex-col gap-1">
        <span className="text-muted-foreground opacity-80 text-[10px] tracking-wider">STREAK</span>
        <span className="flex items-center gap-2 text-lg md:text-xl text-foreground font-black">
          <span>{streakDays}d</span>
          {streakDays > 3 ? (
            <Flame className={streakDays > 7 ? "h-6 w-6 text-accent" : "h-5 w-5 text-accent"} strokeWidth={2.5} />
          ) : null}
        </span>
      </p>
      <p className="font-mono text-xs font-bold uppercase relative z-10 flex flex-col gap-1">
        <span className="text-muted-foreground opacity-80 text-[10px] tracking-wider">TOTAL</span>
        <span className="text-lg md:text-xl text-foreground font-black">{totalRecords}</span>
      </p>
    </div>
  )
}
