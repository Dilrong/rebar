import { Skeleton } from "@shared/ui/skeleton"

export default function Loading() {
  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <main className="mx-auto w-full max-w-5xl animate-fade-in-up pb-24">
        <div className="mb-6 flex gap-3">
          <Skeleton className="h-12 w-32" />
          <Skeleton className="h-12 w-12" />
        </div>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_72px]">
          <Skeleton className="min-h-[36rem] w-full" />
          <div className="hidden gap-3 lg:flex lg:flex-col">
            {Array.from({ length: 3 }).map((_, index) => (
              <Skeleton key={index} className="h-16 w-full" />
            ))}
          </div>
        </div>
      </main>
    </div>
  )
}
