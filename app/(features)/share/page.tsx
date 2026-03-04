"use client"

import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useMutation } from "@tanstack/react-query"
import AuthGate from "@shared/auth/auth-gate"
import AppNav from "@shared/layout/app-nav"
import { useI18n } from "@app-shared/i18n/i18n-provider"
import { apiFetch } from "@/lib/client-http"

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
  const searchParams = useSearchParams()
  const [content, setContent] = useState("")
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")
  const [tags, setTags] = useState("")
  const autoSubmitKeyRef = useRef<string | null>(null)

  const share = useMutation({
    mutationFn: (payload: SharePayload) =>
      apiFetch<ShareResponse>("/api/capture/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
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
      share.mutate({
        content: contentParam,
        title: titleParam || undefined,
        url: urlParam || undefined,
        tags: parsedTags.length > 0 ? parsedTags : undefined
      })
    }
  }, [searchParams, share])

  const autoMode = searchParams.get("auto") === "1"

  const submitManual = () => {
    const parsedTags = parseTags(tags)
    share.mutate({
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
                {share.isPending
                  ? t("share.autoSaving", "Clip received. Saving automatically...")
                  : t("share.autoReady", "Clip received. Saving after login.")}
              </p>
            ) : null}
            <div className="space-y-3">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t("share.titlePlaceholder", "Title (optional)")}
                className="w-full border-2 border-foreground bg-background p-3 font-mono text-sm"
              />
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder={t("share.urlPlaceholder", "https://... (optional)")}
                className="w-full border-2 border-foreground bg-background p-3 font-mono text-sm"
              />
              <input
                value={tags}
                onChange={(event) => setTags(event.target.value)}
                placeholder={t("share.tagsPlaceholder", "tags,comma,separated")}
                className="w-full border-2 border-foreground bg-background p-3 font-mono text-sm"
              />
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={8}
                placeholder={t("share.contentPlaceholder", "Paste shared text")}
                className="w-full border-2 border-foreground bg-background p-3 font-mono text-sm"
              />
              <button
                type="button"
                onClick={submitManual}
                disabled={!content.trim() || share.isPending}
                className="w-full border-2 border-foreground bg-foreground px-3 py-3 font-mono text-sm font-bold uppercase text-background disabled:opacity-60"
              >
                {share.isPending ? t("share.saving", "Saving...") : t("share.save", "Save to Vault")}
              </button>
              {share.error ? <p className="font-mono text-xs text-destructive">{share.error.message}</p> : null}
              {share.data ? (
                <p className="font-mono text-xs text-foreground">
                  {t("share.saved", "Saved")}: {share.data.created}
                </p>
              ) : null}
            </div>
          </section>
        </main>
      </AuthGate>
    </div>
  )
}
