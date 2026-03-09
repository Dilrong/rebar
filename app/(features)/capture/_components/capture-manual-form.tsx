import Link from "next/link"
import { AlertTriangle, ArrowUpRight, Link as LinkIcon } from "lucide-react"
import { useMemo, useState, type FormEventHandler, type KeyboardEvent } from "react"
import type { UseFormReturn } from "react-hook-form"
import { LoadingSpinner } from "@shared/ui/loading"
import type { CreateRecordInput } from "@/lib/schemas"
import type { TagRow } from "@/lib/types"

type CaptureManualFormProps = {
  t: (key: string, fallback?: string) => string
  form: UseFormReturn<CreateRecordInput>
  tags: TagRow[]
  selectedTagIds: string[]
  savedCount: number
  lastSavedPreview: string | null
  onSubmit: FormEventHandler<HTMLFormElement>
  mutationPending: boolean
  mutationErrorMessage: string | null
  duplicateRecordId: string | null
  onMergeDuplicate: () => void
}

function getErrorMessage(message: unknown): string | null {
  return typeof message === "string" ? message : null
}

export function CaptureManualForm({
  t,
  form,
  tags,
  selectedTagIds,
  savedCount,
  lastSavedPreview,
  onSubmit,
  mutationPending,
  mutationErrorMessage,
  duplicateRecordId,
  onMergeDuplicate
}: CaptureManualFormProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)
  const { errors } = form.formState
  const kindError = getErrorMessage(errors.kind?.message)
  const contentError = getErrorMessage(errors.content?.message)
  const urlError = getErrorMessage(errors.url?.message)
  const sourceTitleError = getErrorMessage(errors.source_title?.message)
  const tagIdsError = getErrorMessage(errors.tag_ids?.message)
  const content = form.watch("content") ?? ""
  const kind = form.watch("kind")
  const currentUrl = form.watch("url") ?? ""

  const detectedUrl = useMemo(() => {
    const match = content.match(/https?:\/\/[^\s]+/i)
    return match?.[0] ?? null
  }, [content])

  const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <form className="space-y-8" onSubmit={onSubmit}>
      {savedCount > 0 ? (
        <div className="border-2 border-accent bg-accent/10 p-3">
          <p className="font-mono text-[10px] font-bold uppercase text-accent">
            {t("capture.savedCount", "ITEMS SAVED")}
          </p>
          <p className="mt-1 font-mono text-xs font-bold uppercase text-foreground">
            {savedCount}건 저장됨{lastSavedPreview ? ` — 마지막: ${lastSavedPreview}` : ""}
          </p>
        </div>
      ) : null}

      {detectedUrl && kind !== "link" ? (
        <div className="border-2 border-foreground bg-background p-3">
          <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
            {t("capture.urlDetected", "URL DETECTED — SWITCH TO LINK?")}
          </p>
          <button
            type="button"
            onClick={() => {
              form.setValue("kind", "link", { shouldDirty: true, shouldValidate: true })
              if (!currentUrl) {
                form.setValue("url", detectedUrl, { shouldDirty: true, shouldValidate: true })
              }
            }}
            className="mt-3 inline-flex min-h-[44px] items-center justify-center gap-2 border-4 border-foreground bg-background px-4 py-2 font-mono text-xs font-bold uppercase shadow-brutal-sm transition-all hover:bg-foreground hover:text-background active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            <LinkIcon className="h-4 w-4" strokeWidth={2.5} />
            {t("capture.kind.link", "Web Link")}
          </button>
        </div>
      ) : null}

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="capture-content" className="font-mono text-sm font-bold uppercase text-foreground">{`>> ${t("capture.quickMode", "QUICK INPUT")}`}</label>
          <button
            type="button"
            onClick={() => setShowAdvanced((current) => !current)}
            className="inline-flex min-h-[40px] items-center gap-2 border-2 border-foreground bg-background px-3 py-2 font-mono text-[10px] font-bold uppercase shadow-brutal-sm transition-all hover:bg-foreground hover:text-background active:translate-x-1 active:translate-y-1 active:shadow-none"
          >
            {showAdvanced ? "HIDE" : t("capture.advancedMode", "ADVANCED OPTIONS")}
            <ArrowUpRight className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} strokeWidth={2.5} />
          </button>
        </div>
        <textarea
          id="capture-content"
          rows={8}
          placeholder={t("capture.contentPlaceholder", "Paste your content")}
          aria-invalid={Boolean(contentError)}
          aria-describedby={contentError ? "capture-content-error" : undefined}
          className="w-full bg-background border-4 border-foreground text-foreground text-lg md:text-xl p-4 focus:outline-none focus:ring-0 shadow-brutal-sm focus:shadow-none focus:translate-x-1 focus:translate-y-1 transition-all duration-200 resize-y placeholder:text-muted-foreground/50 rounded-none"
          {...form.register("content")}
          onKeyDown={handleTextareaKeyDown}
          autoFocus
        />
        <p className="font-mono text-[10px] font-bold uppercase text-muted-foreground">
          Cmd+Enter / Ctrl+Enter
        </p>
        {contentError ? (
          <p id="capture-content-error" role="alert" className="font-mono text-[10px] font-bold uppercase text-destructive">
            ERR: {contentError}
          </p>
        ) : null}
      </div>

      {showAdvanced ? (
        <>
          <div className="space-y-2 border-t-4 border-dashed border-border pt-8">
            <label htmlFor="capture-kind" className="font-mono text-sm font-bold uppercase text-foreground">{`>> ${t("capture.dataType", "DATA.TYPE")}`}</label>
            <div className="relative">
              <select
                id="capture-kind"
                {...form.register("kind")}
                aria-invalid={Boolean(kindError)}
                aria-describedby={kindError ? "capture-kind-error" : undefined}
                className="min-h-[44px] w-full bg-background border-4 border-foreground text-foreground p-4 focus:outline-none focus:ring-0 shadow-brutal-sm focus:shadow-none focus:translate-x-1 focus:translate-y-1 transition-all duration-200 appearance-none cursor-pointer font-bold uppercase rounded-none"
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
            {kindError ? (
              <p id="capture-kind-error" role="alert" className="font-mono text-[10px] font-bold uppercase text-destructive">
                ERR: {kindError}
              </p>
            ) : null}
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="capture-meta-url" className="font-mono text-sm font-bold uppercase text-foreground">{`>> ${t("capture.metaUrl", "META.URL")}`}</label>
              <input
                id="capture-meta-url"
                placeholder="https://..."
                aria-invalid={Boolean(urlError)}
                aria-describedby={urlError ? "capture-meta-url-error" : undefined}
                className="min-h-[44px] w-full bg-background border-4 border-foreground text-foreground p-3 focus:outline-none focus:ring-0 shadow-brutal-sm focus:shadow-none focus:translate-x-1 focus:translate-y-1 transition-all duration-200 placeholder:text-muted-foreground/40 font-mono text-sm rounded-none"
                {...form.register("url")}
              />
              {urlError ? (
                <p id="capture-meta-url-error" role="alert" className="font-mono text-[10px] font-bold uppercase text-destructive">
                  ERR: {urlError}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <label htmlFor="capture-meta-ref" className="font-mono text-sm font-bold uppercase text-foreground">{`>> ${t("capture.metaRef", "META.REF")}`}</label>
              <input
                id="capture-meta-ref"
                placeholder="SOURCE IDENTIFIER"
                aria-invalid={Boolean(sourceTitleError)}
                aria-describedby={sourceTitleError ? "capture-meta-ref-error" : undefined}
                className="min-h-[44px] w-full bg-background border-4 border-foreground text-foreground p-3 focus:outline-none focus:ring-0 shadow-brutal-sm focus:shadow-none focus:translate-x-1 focus:translate-y-1 transition-all duration-200 placeholder:text-muted-foreground/40 font-mono text-sm uppercase rounded-none"
                {...form.register("source_title")}
              />
              {sourceTitleError ? (
                <p id="capture-meta-ref-error" role="alert" className="font-mono text-[10px] font-bold uppercase text-destructive">
                  ERR: {sourceTitleError}
                </p>
              ) : null}
            </div>
          </div>

          <fieldset
            className="space-y-3 border-t-2 border-border pt-6"
            aria-invalid={Boolean(tagIdsError)}
            aria-describedby={tagIdsError ? "capture-tags-error" : undefined}
          >
            <legend className="font-mono text-sm font-bold uppercase text-foreground">{`>> ${t("capture.tags", "TAGS")}`}</legend>
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => {
                const checked = selectedTagIds.includes(tag.id)
                const inputId = `capture-tag-${tag.id}`

                return (
                  <div key={tag.id}>
                    <input
                      id={inputId}
                      type="checkbox"
                      className="peer sr-only"
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
                      className={`min-h-[44px] px-4 py-2 border-4 font-mono text-xs font-bold uppercase flex items-center justify-center transition-all duration-200 active:translate-y-1 active:translate-x-1 hover:bg-foreground hover:text-background shadow-brutal-sm hover:shadow-none hover:translate-x-1 hover:translate-y-1 cursor-pointer peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-accent peer-focus-visible:outline-offset-2 ${checked
                        ? "border-foreground bg-foreground text-background animate-scale-in"
                        : "border-foreground bg-background text-foreground"
                        }`}
                    >
                      #{tag.name}
                    </label>
                  </div>
                )
              })}
            </div>
            {tagIdsError ? (
              <p id="capture-tags-error" role="alert" className="font-mono text-[10px] font-bold uppercase text-destructive">
                ERR: {tagIdsError}
              </p>
            ) : null}
          </fieldset>
        </>
      ) : null}

      <div className="pt-6 border-t-4 border-foreground flex flex-col items-start gap-4">
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
                className="min-h-[44px] flex items-center justify-center border-4 border-foreground bg-foreground px-4 py-2 font-mono text-xs font-bold uppercase text-background transition-all duration-200 active:translate-y-1 active:translate-x-1 hover:bg-background hover:text-foreground shadow-brutal hover:shadow-none hover:translate-x-1 hover:translate-y-1"
              >
                {t("capture.mergeDuplicate", "중복 병합 저장")}
              </button>
              <Link
                href={`/records/${duplicateRecordId}?from=${encodeURIComponent("/capture")}`}
                className="min-h-[44px] flex items-center justify-center border-4 border-foreground bg-background px-4 py-2 font-mono text-xs font-bold uppercase text-foreground transition-all duration-200 active:translate-y-1 active:translate-x-1 hover:bg-foreground hover:text-background shadow-brutal hover:shadow-none hover:translate-x-1 hover:translate-y-1"
              >
                {t("capture.openExisting", "기존 항목 보기")}
              </Link>
            </div>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={mutationPending}
          className="w-full mt-4 bg-foreground text-background font-black text-xl uppercase py-5 border-4 border-foreground hover:bg-accent hover:border-accent hover:text-accent-foreground transition-all duration-200 active:translate-y-1 active:translate-x-1 hover:translate-y-1 hover:translate-x-1 hover:shadow-none disabled:opacity-50 disabled:cursor-not-allowed rounded-none shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)] active:shadow-none group"
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
