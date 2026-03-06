import { NextRequest } from "next/server"
import { z } from "zod"
import { getUserId } from "@/lib/auth"
import { fail, internalError, ok, rateLimited } from "@/lib/http"
import { checkRateLimitDistributed, resolveClientKey } from "@/lib/rate-limit"
import { getSupabaseAdmin } from "@/lib/supabase-admin"

const ParamsSchema = z.object({
    id: z.string().uuid(),
    annotationId: z.string().uuid()
})

export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string; annotationId: string }> }
) {
    const limitResult = await checkRateLimitDistributed({
        key: `annotations:delete:${resolveClientKey(request.headers)}`,
        limit: 60,
        windowMs: 60_000
    })
    if (!limitResult.ok) {
        return rateLimited(limitResult.retryAfterSec)
    }

    const userId = await getUserId(request.headers)
    if (!userId) {
        return fail("Unauthorized", 401)
    }

    const params = await context.params
    const parsed = ParamsSchema.safeParse(params)
    if (!parsed.success) {
        return fail("Invalid params", 400)
    }

    const supabase = getSupabaseAdmin()
    const result = await supabase
        .from("annotations")
        .delete()
        .eq("id", parsed.data.annotationId)
        .eq("record_id", parsed.data.id)
        .eq("user_id", userId)

    if (result.error) {
        return internalError("annotation.delete", result.error)
    }

    return ok({ deleted: true })
}
