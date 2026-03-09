import { Skeleton } from "@shared/ui/skeleton"

export default function Loading() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <main className="mx-auto w-full max-w-5xl animate-fade-in-up pb-24">
        <Skeleton className="mb-6 h-16 w-full" />
        <div className="mb-6 border-4 border-foreground bg-card p-4 shadow-brutal">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-64 w-full" />
          ))}
        </div>
      </main>
    </div>
  )
}
