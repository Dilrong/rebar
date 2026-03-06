"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import AuthGate from "@shared/auth/auth-gate"
import AppNav from "@shared/layout/app-nav"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { apiFetch } from "@/lib/client-http"
import { Toast } from "@shared/ui/toast"

type ShareResponse = {
  created: number
  ids: string[]
}

type SharePayload = {
  content: string
  title?: string
  url?: string
  tags?: string[]
}

function parseTags(tagText: string): string[] {
  return tagText
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

export default function SharePage() {
  const { t } = useI18n()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [content, setContent] = useState("")
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [tags, setTags] = useState("")
  const [showSavedToast, setShowSavedToast] = useState(false)
  const [lastSharedRecordId, setLastSharedRecordId] = useState<string | null>(null)
  const autoSubmitKeyRef = useRef<string | null>(null)

  const shareWithFeedback = useMutation({
    mutationFn: (payload: SharePayload) =>
      apiFetch<ShareResponse>("/api/capture/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }),
    onSuccess: (data) => {
      setLastSharedRecordId(data.ids[0] ?? null)
      setShowSavedToast(true)
      window.setTimeout(() => setShowSavedToast(false), 5000)

      setContent("")
      setTitle("")
      setUrl("")
      setTags("")
    }
  })

  useEffect(() => {
    const contentParam = searchParams.get("content") ?? ""
    const titleParam = searchParams.get("title") ?? ""
    const urlParam = searchParams.get("url") ?? ""
    const tagsParam = searchParams.get("tags") ?? ""
    const auto = searchParams.get("auto") === "1"

    if (contentParam) {
      setContent(contentParam)
    }
    if (titleParam) {
      setTitle(titleParam)
    }
    if (urlParam) {
      setUrl(urlParam)
    }
    if (tagsParam) {
      setTags(tagsParam)
    }

    if (auto && contentParam.trim()) {
      const key = JSON.stringify({ contentParam, titleParam, urlParam, tagsParam })
      if (autoSubmitKeyRef.current === key) {
        return
      }

      autoSubmitKeyRef.current = key
      const parsedTags = parseTags(tagsParam)
      shareWithFeedback.mutate({
        content: contentParam,
        title: titleParam || undefined,
        url: urlParam || undefined,
        tags: parsedTags.length > 0 ? parsedTags : undefined
      })
    }
  }, [searchParams, shareWithFeedback])

  const autoMode = searchParams.get("auto") === "1"

  const submitManual = () => {
    const parsedTags = parseTags(tags)
    shareWithFeedback.mutate({
      content,
      title: title || undefined,
      url: url || undefined,
      tags: parsedTags.length > 0 ? parsedTags : undefined
    })
  }

  return (
    <div className="min-h-screen bg-background p-4 font-sans">
      <AuthGate>
        <main className="mx-auto max-w-xl pb-20">
          <AppNav />
          <section className="border-4 border-foreground bg-card p-4">
            <h1 className="mb-4 border-b-4 border-foreground pb-2 font-black text-3xl uppercase">{t("share.title", "Quick Share")}</h1>
            {autoMode ? (
              <p className="mb-3 border-2 border-foreground bg-background p-2 font-mono text-xs font-bold uppercase">
                {shareWithFeedback.isPending
                  ? t("share.autoSaving", "Clip received. Saving automatically...")
                  : t("share.autoReady", "Clip received. Saving after login.")}
              </p>
            ) : null}
            <div className="space-y-3">
              <label htmlFor="share-title" className="sr-only">
                {t("share.titlePlaceholder", "Title (optional)")}
              </label>
              <input
                id="share-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("share.titlePlaceholder", "Title (optional)")}
                className="w-full border-2 border-foreground bg-background p-3 font-mono text-sm"
              />
              <label htmlFor="share-url" className="sr-only">
                {t("share.urlPlaceholder", "https://... (optional)")}
              </label>
              <input
                id="share-url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder={t("share.urlPlaceholder", "https://... (optional)")}
                className="w-full border-2 border-foreground bg-background p-3 font-mono text-sm"
              />
              <label htmlFor="share-tags" className="sr-only">
                {t("share.tagsPlaceholder", "tags,comma,separated")}
              </label>
              <input
                id="share-tags"
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder={t("share.tagsPlaceholder", "tags,comma,separated")}
                className="w-full border-2 border-foreground bg-background p-3 font-mono text-sm"
              />
              <label htmlFor="share-content" className="sr-only">
                {t("share.contentPlaceholder", "Paste shared text")}
              </label>
              <textarea
                id="share-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={8}
                placeholder={t("share.contentPlaceholder", "Paste shared text")}
                className="w-full border-2 border-foreground bg-background p-3 font-mono text-sm"
              />
              <button
                type="button"
                onClick={submitManual}
                disabled={!content.trim() || shareWithFeedback.isPending}
                className="w-full border-2 border-foreground bg-foreground px-3 py-3 font-mono text-sm font-bold uppercase text-background disabled:opacity-60"
              >
                {shareWithFeedback.isPending ? t("share.saving", "Saving...") : t("share.save", "Save to Vault")}
              </button>
              {shareWithFeedback.error ? <p className="font-mono text-xs text-destructive">{shareWithFeedback.error.message}</p> : null}
              {shareWithFeedback.data ? (
                <p className="font-mono text-xs text-foreground">
                  {t("share.saved", "Saved")}: {shareWithFeedback.data.created}
                </p>
              ) : null}
            </div>
          </section>
        </main>
      </AuthGate>
      {showSavedToast ? (
        <Toast
          message={t("toast.saved", "Saved")}
          actionLabel={lastSharedRecordId ? t("toast.openRecord", "Open") : undefined}
          onAction={
            lastSharedRecordId
              ? () => router.push(`/records/${lastSharedRecordId}?from=${encodeURIComponent("/share")}`)
              : undefined
          }
          tone="success"
          onClose={() => {
            setShowSavedToast(false)
            setLastSharedRecordId(null)
          }}
        />
      ) : null}
    </div>
  )
}
