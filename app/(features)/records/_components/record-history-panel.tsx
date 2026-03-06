import type { RecordAnnotation, RecordNoteVersion, Translate } from "./types"

type RecordHistoryPanelProps = {
  t: Translate
  annotations: RecordAnnotation[]
  noteVersions: RecordNoteVersion[]
  updateRecordError: string | null
  deleteRecordError: string | null
}

export function RecordHistoryPanel({
  t,
  annotations,
  noteVersions,
  updateRecordError,
  deleteRecordError
}: RecordHistoryPanelProps) {
  return (
    <div className="border-4 border-foreground bg-card p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)]">
      {updateRecordError ? <p className="font-mono text-xs text-destructive">{updateRecordError}</p> : null}
      {deleteRecordError ? <p className="font-mono text-xs text-destructive">{deleteRecordError}</p> : null}

      <div className="flex flex-col gap-4">
        <h2 className="font-black text-2xl text-foreground uppercase pt-4 px-2">{t("record.logHistory", "LOG.HISTORY")}</h2>

        {annotations.length === 0 && noteVersions.length === 0 ? (
          <p className="font-mono text-sm font-bold text-muted-foreground uppercase border-2 border-dashed border-border p-4 text-center">{t("record.noLogs", "NO LOGS FOUND.")}</p>
        ) : null}

        <div className="space-y-4">
          {noteVersions.map((noteVersion) => (
            <div key={noteVersion.id} className="border-2 border-foreground bg-background p-4 relative shadow-brutal-sm">
              <span className="inline-block bg-foreground text-background font-mono text-[10px] font-bold px-1.5 py-0.5 uppercase mb-2">
                {t("record.noteHistory", "NOTE")}
              </span>
              <p className="text-foreground font-medium text-sm whitespace-pre-wrap">{noteVersion.body}</p>
            </div>
          ))}
          {annotations.map((annotation) => (
            <div key={annotation.id} className="border-2 border-foreground bg-background p-4 relative shadow-brutal-sm">
              <span className="inline-block bg-accent text-white font-mono text-[10px] font-bold px-1.5 py-0.5 uppercase mb-2">
                {annotation.kind}
              </span>
              <p className="text-foreground font-medium text-sm whitespace-pre-wrap">{annotation.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
