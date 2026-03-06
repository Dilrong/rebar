import { ok } from "@/lib/http"

export async function GET() {
  return ok({
    version: 1,
    auth: {
      preferred: "Authorization: Bearer <SUPABASE_ACCESS_TOKEN>",
      externalAgent: ["x-rebar-ingest-key: <REBAR_INGEST_API_KEY>", "x-user-id: <USER_UUID>"]
    },
    endpoints: {
      share: {
        method: "POST",
        path: "/api/capture/share",
        body: {
          content: "string (required)",
          title: "string (optional)",
          url: "string (optional, valid URL)",
          tags: ["string"],
          kind: "quote|note|link|ai (optional)"
        }
      },
      ingest: {
        method: "POST",
        path: "/api/capture/ingest",
        body: {
          items: [
            {
              content: "string (required)",
              note: "string (optional, stored separately when paired with content/highlight)",
              title: "string (optional)",
              source_title: "string (optional)",
              book_title: "string (optional)",
              book_author: "string (optional)",
              url: "string (optional)",
              source_type: "book|article|service|manual|ai|unknown (optional)",
              source_service: "string (optional)",
              source_identity: "string (optional)",
              tags: ["string"],
              kind: "quote|note|link|ai (optional)",
              adopted_from_ai: "boolean (optional)"
            }
          ],
          default_kind: "quote|note|link|ai (optional)",
          default_tags: ["string"],
          import_channel: "csv|json|api (optional)"
        },
        limit: "max 300 items/request"
      },
      extract: {
        method: "POST",
        path: "/api/capture/extract",
        body: {
          url: "string (required, valid URL)"
        },
        response: {
          url: "string",
          title: "string|null",
          description: "string|null",
          content: "string"
        }
      }
    },
    examples: {
      share: {
        curl: "curl -X POST \"http://localhost:3000/api/capture/share\" -H \"x-rebar-ingest-key: <REBAR_INGEST_API_KEY>\" -H \"x-user-id: <USER_UUID>\" -H \"content-type: application/json\" -d '{\"content\":\"공유 텍스트\",\"title\":\"공유 제목\",\"url\":\"https://example.com\"}'"
      }
    },
    note: "All supported integrations in this guide are free-tier friendly."
  })
}
