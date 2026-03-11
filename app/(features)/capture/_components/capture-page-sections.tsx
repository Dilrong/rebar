import type { ReactNode } from "react"

type CapturePageSectionsProps = {
  t: (key: string, fallback?: string) => string
  children: ReactNode
}

export function CapturePageSections({ t, children }: CapturePageSectionsProps) {
  return (
    <div className="border-[3px] border-foreground bg-card p-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_0px_rgba(255,255,255,0.1)] md:border-4 md:p-10 md:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:dark:shadow-[8px_8px_0px_0px_rgba(255,255,255,0.1)]">
      <header className="mb-6 flex flex-col justify-between gap-4 border-b-[3px] border-foreground pb-4 md:mb-10 md:flex-row md:items-end md:border-b-4 md:pb-6">
        <h1 className="font-black text-3xl uppercase leading-none text-foreground md:text-5xl">{t("capture.title", "CAPTURE")}</h1>
        <span className="w-fit bg-foreground px-2 py-1 font-mono text-[10px] font-bold uppercase text-background md:text-xs">
          {t("capture.ready", "READY TO ADD")}
        </span>
      </header>
      {children}
    </div>
  )
}
