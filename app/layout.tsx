import type { Metadata } from "next"
import { Inter, Roboto_Mono } from "next/font/google"
import type { ReactNode } from "react"
import "./globals.css"
import Providers from "@/app/providers"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })
const mono = Roboto_Mono({ subsets: ["latin"], variable: "--font-mono" })

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
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className={`${inter.variable} ${mono.variable}`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
