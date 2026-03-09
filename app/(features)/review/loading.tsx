import { Skeleton } from "@shared/ui/skeleton"

export default function Loading() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <main className="mx-auto flex w-full max-w-5xl flex-col animate-fade-in-up">
        <div className="mb-8 border-4 border-foreground bg-card p-4 shadow-brutal">
          <Skeleton className="h-16 w-full" />
        </div>
        <div className="mb-6 grid grid-cols-2 gap-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="min-h-[32rem] w-full" />
      </main>
    </div>
  )
}
