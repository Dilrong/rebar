import { Skeleton } from "@shared/ui/skeleton"

export default function Loading() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <main className="mx-auto w-full max-w-5xl animate-fade-in-up pb-24">
        <div className="border-4 border-foreground bg-card p-6 shadow-brutal">
          <Skeleton className="mb-6 h-16 w-full" />
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
          <Skeleton className="h-56 w-full" />
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        </div>
      </main>
    </div>
  )
}
