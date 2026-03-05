import Link from "next/link"
import { AlertTriangle, CheckSquare } from "lucide-react"
import type { FormEventHandler } from "react"
import type { UseFormReturn } from "react-hook-form"
import { LoadingSpinner } from "@shared/ui/loading"
import type { CreateRecordInput } from "@/lib/schemas"
import type { TagRow } from "@/lib/types"

type CaptureManualFormProps = {
  t: (key: string, fallback?: string) => string
  form: UseFormReturn<CreateRecordInput>
  tags: TagRow[]
  selectedTagIds: string[]
  onSubmit: FormEventHandler<HTMLFormElement>
  mutationPending: boolean
  mutationErrorMessage: string | null
  mutationSuccess: boolean
  showSavedToast: boolean
  duplicateRecordId: string | null
  onMergeDuplicate: () => void
}

export function CaptureManualForm({
  t,
  form,
  tags,
  selectedTagIds,
  onSubmit,
  mutationPending,
  mutationErrorMessage,
  mutationSuccess,
  showSavedToast,
  duplicateRecordId,
  onMergeDuplicate
}: CaptureManualFormProps) {
  return (
    <form className="space-y-8" onSubmit={onSubmit}>
      <div className="space-y-2">
        <label htmlFor="capture-kind" className="font-mono text-sm font-bold uppercase text-foreground">{`>> ${t("capture.dataType", "DATA.TYPE")}`}</label>
        <div className="relative">
          <select
            id="capture-kind"
            {...form.register("kind")}
            className="min-h-[44px] w-full bg-background border-4 border-foreground text-foreground p-4 focus:outline-none focus:ring-0 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[inset_4px_4px_0px_0px_rgba(255,255,255,0.1)] transition-none appearance-none cursor-pointer font-bold uppercase rounded-none"
          >
            <option value="quote">{t("capture.kind.quote", "Quote / Highlight")}</option>
            <option value="note">{t("capture.kind.note", "Personal Note")}</option>
            <option value="link">{t("capture.kind.link", "Web Link")}</option>
            <option value="ai">{t("capture.kind.ai", "AI Content")}</option>
          </select>
          <div className="absolute top-1/2 right-4 -translate-y-1/2 pointer-events-none font-black text-xl">
            ▼
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="capture-content" className="font-mono text-sm font-bold uppercase text-foreground">{`>> ${t("capture.dataPayload", "DATA.PAYLOAD")}`}</label>
        <textarea
          id="capture-content"
          rows={6}
          placeholder={t("capture.contentPlaceholder", "Paste your content")}
          className="w-full bg-background border-4 border-foreground text-foreground text-lg md:text-xl p-4 focus:outline-none focus:ring-0 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[inset_4px_4px_0px_0px_rgba(255,255,255,0.1)] transition-none resize-y placeholder:text-muted-foreground/50 rounded-none"
          {...form.register("content")}
          autoFocus
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t-4 border-dashed border-border pt-8">
        <div className="space-y-2">
          <label htmlFor="capture-meta-url" className="font-mono text-sm font-bold uppercase text-foreground">{`>> ${t("capture.metaUrl", "META.URL")}`}</label>
          <input
            id="capture-meta-url"
            placeholder="https://..."
            className="min-h-[44px] w-full bg-background border-4 border-foreground text-foreground p-3 focus:outline-none focus:ring-0 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[inset_4px_4px_0px_0px_rgba(255,255,255,0.1)] transition-none placeholder:text-muted-foreground/40 font-mono text-sm rounded-none"
            {...form.register("url")}
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="capture-meta-ref" className="font-mono text-sm font-bold uppercase text-foreground">{`>> ${t("capture.metaRef", "META.REF")}`}</label>
          <input
            id="capture-meta-ref"
            placeholder="SOURCE IDENTIFIER"
            className="min-h-[44px] w-full bg-background border-4 border-foreground text-foreground p-3 focus:outline-none focus:ring-0 shadow-[inset_4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[inset_4px_4px_0px_0px_rgba(255,255,255,0.1)] transition-none placeholder:text-muted-foreground/40 font-mono text-sm uppercase rounded-none"
            {...form.register("source_title")}
          />
        </div>
      </div>

      <div className="space-y-3 border-t-2 border-border pt-6">
        <p className="font-mono text-sm font-bold uppercase text-foreground">{`>> ${t("capture.tags", "TAGS")}`}</p>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => {
            const checked = selectedTagIds.includes(tag.id)
            const inputId = `capture-tag-${tag.id}`

            return (
              <div key={tag.id}>
                <input
                  id={inputId}
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() => {
                    const current = form.getValues("tag_ids") ?? []
                    const next = checked
                      ? current.filter((id) => id !== tag.id)
                      : [...current, tag.id]
                    form.setValue("tag_ids", next)
                  }}
                />
                <label
                  htmlFor={inputId}
                  className={`min-h-[44px] px-4 py-2 border-4 font-mono text-xs font-bold uppercase flex items-center justify-center transition-transform active:translate-y-[2px] active:translate-x-[2px] hover:bg-foreground hover:text-background shadow-brutal-sm cursor-pointer ${checked
                    ? "border-foreground bg-foreground text-background"
                    : "border-foreground bg-background text-foreground"
                    }`}
                >
                  #{tag.name}
                </label>
              </div>
            )
          })}
        </div>
      </div>

      <div className="pt-6 border-t-4 border-foreground flex flex-col items-start gap-4">
        {Object.values(form.formState.errors).map((error, index) => (
          <div key={`${error.message ?? "form-error"}-${index}`} className="flex items-center text-destructive-foreground bg-destructive font-mono text-xs font-bold px-3 py-2 uppercase">
            <AlertTriangle className="w-4 h-4 mr-2" strokeWidth={3} />
            ERR: {error.message}
          </div>
        ))}

        {mutationErrorMessage ? (
          <div className="flex items-center text-destructive-foreground bg-destructive font-mono text-xs font-bold px-3 py-2 uppercase">
            <AlertTriangle className="w-4 h-4 mr-2" strokeWidth={3} />
            SYS.ERR: {mutationErrorMessage}
          </div>
        ) : null}

        {duplicateRecordId ? (
          <div className="w-full border-2 border-foreground bg-background p-3">
            <p className="font-mono text-xs font-bold uppercase text-foreground">
              {t("capture.duplicateFound", "중복 항목이 있어 병합 저장을 권장합니다.")}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onMergeDuplicate}
                disabled={mutationPending}
                className="min-h-[44px] flex items-center justify-center border-4 border-foreground bg-foreground px-4 py-2 font-mono text-xs font-bold uppercase text-background transition-transform active:translate-y-[2px] active:translate-x-[2px] hover:bg-background hover:text-foreground hover:shadow-brutal-sm shadow-brutal"
              >
                {t("capture.mergeDuplicate", "중복 병합 저장")}
              </button>
              <Link
                href={`/records/${duplicateRecordId}?from=${encodeURIComponent("/capture")}`}
                className="min-h-[44px] flex items-center justify-center border-4 border-foreground bg-background px-4 py-2 font-mono text-xs font-bold uppercase text-foreground transition-transform active:translate-y-[2px] active:translate-x-[2px] hover:bg-foreground hover:text-background hover:shadow-brutal"
              >
                {t("capture.openExisting", "기존 항목 보기")}
              </Link>
            </div>
          </div>
        ) : null}

        {mutationSuccess && !showSavedToast ? (
          <div className="flex items-center text-accent-foreground bg-accent font-mono text-xs font-bold px-3 py-2 uppercase animate-pulse">
            <CheckSquare className="w-4 h-4 mr-2" strokeWidth={3} />
            {t("capture.committed", "COMMITTED TO DATABASE.")}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={mutationPending}
          className="w-full mt-4 bg-foreground text-background font-black text-xl uppercase py-5 border-4 border-foreground hover:bg-accent hover:border-accent hover:text-accent-foreground transition-transform active:translate-y-[4px] active:translate-x-[4px] disabled:opacity-50 disabled:cursor-not-allowed rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)] active:shadow-none"
        >
          {mutationPending ? (
            <div className="flex items-center justify-center gap-3">
              <LoadingSpinner className="w-6 h-6" />
              <span>{t("capture.transmitting", "SAVING...")}</span>
            </div>
          ) : t("capture.commit", "SAVE")}
        </button>
      </div>
    </form>
  )
}
