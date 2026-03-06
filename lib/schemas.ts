import { z } from "zod"

export const RecordKindSchema = z.enum(["quote", "note", "link", "ai"])
export const TagNameSchema = z.string().min(1).max(50)

export const RecordStateSchema = z.enum([
  "INBOX",
  "ACTIVE",
  "PINNED",
  "ARCHIVED",
  "TRASHED"
])

export const ReviewActionSchema = z.enum(["reviewed", "resurface"])

export const TriageDecisionTypeSchema = z.enum(["ARCHIVE", "ACT", "DEFER"])
export const TriageActionTypeSchema = z.enum(["EXPERIMENT", "SHARE", "TODO"])
export const TriageDeferReasonSchema = z.enum(["NEED_INFO", "LOW_CONFIDENCE", "NO_TIME"])

export const CreateRecordSchema = z
  .object({
    kind: RecordKindSchema,
    content: z.string().min(1),
    url: z.string().url().optional(),
    source_title: z.string().min(1).optional(),
    tag_ids: z.array(z.string().uuid()).optional(),
    on_duplicate: z.enum(["error", "merge"]).optional()
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
  action: ReviewActionSchema,
  snooze_days: z.number().int().min(1).max(30).optional()
}).superRefine((value, ctx) => {
  if (value.snooze_days && value.action !== "resurface") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["snooze_days"],
      message: "snooze_days is only valid with resurface action"
    })
  }
})

export const TriageDecisionSchema = z
  .object({
    decisionType: TriageDecisionTypeSchema,
    actionType: TriageActionTypeSchema.optional(),
    deferReason: TriageDeferReasonSchema.optional(),
    snooze_days: z.number().int().min(1).max(30).optional()
  })
  .superRefine((value, ctx) => {
    if (value.decisionType === "ACT" && !value.actionType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actionType"],
        message: "actionType is required when decisionType is ACT"
      })
    }

    if (value.decisionType !== "ACT" && value.actionType) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["actionType"],
        message: "actionType is only valid when decisionType is ACT"
      })
    }

    if (value.decisionType === "DEFER" && !value.deferReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deferReason"],
        message: "deferReason is required when decisionType is DEFER"
      })
    }

    if (value.decisionType !== "DEFER" && value.deferReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["deferReason"],
        message: "deferReason is only valid when decisionType is DEFER"
      })
    }

    if (value.snooze_days && value.decisionType !== "DEFER") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["snooze_days"],
        message: "snooze_days is only valid when decisionType is DEFER"
      })
    }
  })

export type RecordKind = z.infer<typeof RecordKindSchema>
export type RecordState = z.infer<typeof RecordStateSchema>
export type ReviewAction = z.infer<typeof ReviewActionSchema>
export type TriageDecisionType = z.infer<typeof TriageDecisionTypeSchema>
export type TriageActionType = z.infer<typeof TriageActionTypeSchema>
export type TriageDeferReason = z.infer<typeof TriageDeferReasonSchema>
export type CreateRecordInput = z.infer<typeof CreateRecordSchema>
export type UpdateRecordInput = z.infer<typeof UpdateRecordSchema>
export type ReviewRecordInput = z.infer<typeof ReviewRecordSchema>
export type TriageDecisionInput = z.infer<typeof TriageDecisionSchema>

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
