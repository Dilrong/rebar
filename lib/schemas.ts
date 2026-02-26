import { z } from "zod"

export const RecordKindSchema = z.enum(["quote", "note", "link", "ai"])

export const RecordStateSchema = z.enum([
  "INBOX",
  "ACTIVE",
  "PINNED",
  "ARCHIVED",
  "TRASHED"
])

export const ReviewActionSchema = z.enum(["reviewed", "resurface"])

export const CreateRecordSchema = z
  .object({
    kind: RecordKindSchema,
    content: z.string().min(1),
    url: z.string().url().optional(),
    source_title: z.string().min(1).optional(),
    tag_ids: z.array(z.string().uuid()).optional()
  })
  .superRefine((value, ctx) => {
    if (value.kind === "link" && !value.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["url"],
        message: "url is required for link kind"
      })
    }
  })

export const UpdateRecordSchema = z
  .object({
    state: RecordStateSchema.optional(),
    tag_ids: z.array(z.string().uuid()).optional(),
    url: z.string().url().optional(),
    source_title: z.string().min(1).optional()
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field must be provided"
  })

export const ReviewRecordSchema = z.object({
  action: ReviewActionSchema
})

export type RecordKind = z.infer<typeof RecordKindSchema>
export type RecordState = z.infer<typeof RecordStateSchema>
export type ReviewAction = z.infer<typeof ReviewActionSchema>
export type CreateRecordInput = z.infer<typeof CreateRecordSchema>
export type UpdateRecordInput = z.infer<typeof UpdateRecordSchema>
export type ReviewRecordInput = z.infer<typeof ReviewRecordSchema>

const AllowedTransitions: Readonly<Record<RecordState, readonly RecordState[]>> = {
  INBOX: ["ACTIVE", "TRASHED"],
  ACTIVE: ["PINNED", "ARCHIVED", "TRASHED"],
  PINNED: ["ACTIVE", "ARCHIVED", "TRASHED"],
  ARCHIVED: ["ACTIVE", "TRASHED"],
  TRASHED: []
}

export function isValidStateTransition(from: RecordState, to: RecordState): boolean {
  if (from === to) {
    return true
  }

  return AllowedTransitions[from].includes(to)
}
