import type { AssistData, Translate } from "./types"

type RecordAssistPanelProps = {
  t: Translate
  pending: boolean
  errorMessage: string | null
  data: AssistData | null
  checkedTodos: string[]
  onRun: () => void
  onToggleTodo: (todo: string) => void
  onCopyTodos: () => void
}

export function RecordAssistPanel({
  t,
  pending,
  errorMessage,
  data,
  checkedTodos,
  onRun,
  onToggleTodo,
  onCopyTodos
}: RecordAssistPanelProps) {
  return (
    <div className="border-4 border-foreground bg-card p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
      <h3 className="font-black text-xl uppercase text-foreground mb-4 border-b-4 border-foreground pb-2">
        {t("record.assist.title", "AI EXECUTION")}
      </h3>
      <button
        type="button"
        onClick={onRun}
        disabled={pending}
        className="min-h-[44px] w-full border-2 border-foreground bg-background px-3 py-2 font-mono text-xs font-bold uppercase hover:bg-foreground hover:text-background disabled:opacity-60"
      >
        {pending
          ? t("record.assist.running", "GENERATING...")
          : t("record.assist.run", "GENERATE SUMMARY + TODO")}
      </button>

      {errorMessage ? (
        <p className="mt-3 font-mono text-xs text-destructive">{errorMessage}</p>
      ) : null}

      {data ? (
        <div className="mt-4 space-y-4">
          <div>
            <p className="mb-2 font-mono text-[10px] font-bold uppercase text-muted-foreground">
              {t("record.assist.summary", "SUMMARY")}
            </p>
            <div className="space-y-2">
              {data.summary.map((item) => (
                <p key={item} className="border-2 border-foreground bg-background p-2 font-mono text-xs font-bold">
                  {item}
                </p>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 font-mono text-[10px] font-bold uppercase text-muted-foreground">
              {t("record.assist.questions", "KEY QUESTIONS")}
            </p>
            <div className="space-y-2">
              {data.questions.map((item) => (
                <p key={item} className="border border-foreground bg-background p-2 font-mono text-xs">
                  {item}
                </p>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
                {t("record.assist.todos", "ACTION TODOS")}
              </p>
              <button
                type="button"
                onClick={onCopyTodos}
                className="min-h-[36px] border border-foreground px-2 py-1 font-mono text-[10px] font-bold uppercase hover:bg-foreground hover:text-background"
              >
                {t("record.assist.copyTodos", "COPY")}
              </button>
            </div>
            <div className="space-y-2">
              {data.todos.map((todo) => {
                const checked = checkedTodos.includes(todo)
                return (
                  <button
                    key={todo}
                    type="button"
                    onClick={() => onToggleTodo(todo)}
                    className={`min-h-[44px] w-full border-2 px-3 py-2 text-left font-mono text-xs font-bold transition-colors ${checked
                      ? "border-foreground bg-foreground text-background"
                      : "border-foreground bg-background text-foreground hover:bg-muted"
                      }`}
                  >
                    <span className="mr-2">{checked ? "[x]" : "[ ]"}</span>
                    {todo}
                  </button>
                )
              })}
            </div>
          </div>

          {data.signals.topKeywords.length > 0 ? (
            <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
              {t("record.assist.keywords", "KEYWORDS")}: {data.signals.topKeywords.join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
