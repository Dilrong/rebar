"use client"

import { useState } from "react"
import { useMutation } from "@tanstack/react-query"
import AuthGate from "@/components/auth/auth-gate"
import AppNav from "@/components/layout/app-nav"
import { apiFetch } from "@/lib/client-http"

type ShareResponse = {
  created: number
  ids: string[]
}

export default function SharePage() {
  const [content, setContent] = useState("")
  const [title, setTitle] = useState("")
  const [url, setUrl] = useState("")

  const share = useMutation({
    mutationFn: () =>
      apiFetch<ShareResponse>("/api/capture/share", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, title: title || undefined, url: url || undefined })
      }),
    onSuccess: () => {
      setContent("")
      setTitle("")
      setUrl("")
    }
  })

  return (
    <div className="min-h-screen bg-background p-4 font-sans">
      <AuthGate>
        <main className="mx-auto max-w-xl pb-20">
          <AppNav />
          <section className="border-4 border-foreground bg-card p-4">
            <h1 className="mb-4 border-b-4 border-foreground pb-2 font-black text-3xl uppercase">Quick Share</h1>
            <div className="space-y-3">
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="제목(선택)"
                className="w-full border-2 border-foreground bg-background p-3 font-mono text-sm"
              />
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://... (선택)"
                className="w-full border-2 border-foreground bg-background p-3 font-mono text-sm"
              />
              <textarea
                value={content}
                onChange={(event) => setContent(event.target.value)}
                rows={8}
                placeholder="공유 텍스트를 붙여넣으세요"
                className="w-full border-2 border-foreground bg-background p-3 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => share.mutate()}
                disabled={!content.trim() || share.isPending}
                className="w-full border-2 border-foreground bg-foreground px-3 py-3 font-mono text-sm font-bold uppercase text-background disabled:opacity-60"
              >
                {share.isPending ? "Saving..." : "Save to Vault"}
              </button>
              {share.error ? <p className="font-mono text-xs text-destructive">{share.error.message}</p> : null}
              {share.data ? <p className="font-mono text-xs text-foreground">Saved: {share.data.created}</p> : null}
            </div>
          </section>
        </main>
      </AuthGate>
    </div>
  )
}
