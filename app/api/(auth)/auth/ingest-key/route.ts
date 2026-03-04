import { getUserId } from "@/lib/auth"
import { fail, ok } from "@/lib/http"

export async function GET(request: Request) {
  const userId = await getUserId(new Headers(request.headers))
  if (!userId) {
    return fail("Unauthorized", 401)
  }

  return ok({
    enabled: Boolean(process.env.REBAR_INGEST_API_KEY)
  })
}
