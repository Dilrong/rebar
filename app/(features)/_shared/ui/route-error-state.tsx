"use client"

import { useI18n } from "@app-shared/i18n/i18n-provider"

type RouteErrorStateProps = {
  reset: () => void
}

export function RouteErrorState({ reset }: RouteErrorStateProps) {
  const { t } = useI18n()

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-4">
      <h2 className="text-lg font-bold uppercase tracking-wider">{t("error.title")}</h2>
      <p className="text-sm text-muted-foreground">{t("error.desc")}</p>
      <button
        type="button"
        onClick={reset}
        className="border-2 border-foreground bg-background px-4 py-2 text-sm font-bold uppercase tracking-wider hover:bg-foreground hover:text-background"
      >
        {t("error.retry")}
      </button>
    </div>
  )
}
