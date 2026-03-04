import { LoadingSpinner } from "@shared/ui/loading"

export function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center py-20 border-4 border-dashed border-border">
      <LoadingSpinner className="mb-4 h-10 w-10 text-muted-foreground" />
      <p className="font-mono text-xs font-bold uppercase text-muted-foreground">{label}</p>
    </div>
  )
}
