type ReviewStatsPanelProps = {
  reviewed: number
  remaining: number
  streakDays: number
  totalRecords: number
}

export function ReviewStatsPanel({ reviewed, remaining, streakDays, totalRecords }: ReviewStatsPanelProps) {
  return (
    <div className="mb-6 grid grid-cols-2 gap-2 border-[3px] md:border-4 border-foreground bg-card p-4 md:p-6 md:grid-cols-4 shadow-brutal-sm md:shadow-brutal">
      <p className="font-mono text-xs font-bold uppercase">REVIEWED: {reviewed}</p>
      <p className="font-mono text-xs font-bold uppercase">REMAINING: {remaining}</p>
      <p className="font-mono text-xs font-bold uppercase">STREAK: {streakDays}d</p>
      <p className="font-mono text-xs font-bold uppercase">TOTAL: {totalRecords}</p>
    </div>
  )
}
