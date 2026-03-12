type ErrorStateProps = {
  message: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="border-4 border-foreground bg-destructive p-4 font-mono text-xs font-bold uppercase text-destructive-foreground shadow-brutal-sm md:shadow-brutal">
      <p>ERR: {message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 border-2 border-current bg-transparent px-2 py-1 font-mono text-[10px] font-bold uppercase text-destructive-foreground transition-all hover:bg-current hover:text-background active:translate-x-1 active:translate-y-1"
        >
          Retry
        </button>
      ) : null}
    </div>
  )
}
