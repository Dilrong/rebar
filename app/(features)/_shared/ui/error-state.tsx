type ErrorStateProps = {
  message: string
  onRetry?: () => void
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="border-4 border-foreground bg-destructive p-4 font-mono text-xs font-bold uppercase text-destructive-foreground">
      <p>ERR: {message}</p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 border-2 border-current bg-transparent px-2 py-1 font-mono text-[10px] font-bold uppercase text-destructive-foreground"
        >
          Retry
        </button>
      ) : null}
    </div>
  )
}
