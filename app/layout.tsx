import type { Metadata, Viewport } from "next"
import type { ReactNode } from "react"
import { Noto_Sans_KR } from "next/font/google"
import "./globals.css"
import Providers from "@/app/providers"

const notoSansKr = Noto_Sans_KR({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-korean",
  display: "swap"
})

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
}

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://rebar.vercel.app"),
  title: "REBAR_ | Data Infrastructure",
  description: "Personal Single Source of Truth data pipeline.",
  icons: {
    icon: "/icon.svg",
  },
  openGraph: {
    title: "REBAR_",
    description: "Industrial Data Infrastructure and SSOT Pipeline.",
    url: "https://rebar.local",
    siteName: "REBAR_",
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "REBAR_",
    description: "Personal Single Source of Truth data pipeline.",
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  // Inline script to prevent FOUC when applying font setting.
  const themeScript = `
    (function() {
      try {
        var font = window.localStorage.getItem('rebar.fontFamily');
        if (font) {
          document.documentElement.setAttribute('data-font', font);
        } else {
          document.documentElement.setAttribute('data-font', 'sans');
        }
      } catch (e) {}
    })();
  `

  return (
    <html lang="ko" suppressHydrationWarning className={notoSansKr.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div className="bg-noise pointer-events-none fixed inset-0 z-[9999] opacity-[0.04] mix-blend-multiply dark:opacity-[0.06] dark:mix-blend-screen" aria-hidden="true" />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
