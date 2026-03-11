import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"
import { isAllowedOrigin } from "@/lib/security/origin"

export async function proxy(request: NextRequest) {
  const origin = request.headers.get("origin")
  const host = request.headers.get("host")

  // ── CORS Preflight ──
  if (request.method === "OPTIONS") {
    if (!origin || !isAllowedOrigin(origin, host)) {
      return new NextResponse(null, { status: 403 })
    }
    return new NextResponse(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type,Authorization,x-rebar-ingest-key,x-user-id,x-cron-secret",
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Max-Age": "86400"
      }
    })
  }

  // ── Origin check for mutating requests ──
  if (origin && !isAllowedOrigin(origin, host) && request.method !== "GET") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // ── Supabase session refresh ──
  let supabaseResponse = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (url && key) {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          supabaseResponse = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            supabaseResponse.cookies.set(name, value, options)
          }
        }
      }
    })

    // Refresh the session — this call updates expired cookies automatically
    try {
      await supabase.auth.getUser()
    } catch {
    }
  }

  // ── Attach CORS headers on response ──
  if (origin && isAllowedOrigin(origin, host)) {
    supabaseResponse.headers.set("Access-Control-Allow-Origin", origin)
    supabaseResponse.headers.set("Access-Control-Allow-Credentials", "true")
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
}
