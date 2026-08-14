import * as z from 'zod'

export const DecimalSchema = z.number()
export const DateSchema = z.iso.date()
export const DateTimeSchema = z.iso.datetime({ local: true })

export const UserSummarySchema = z
  .object({
    id: z.number().int().positive(),
    username: z.string(),
    first_name: z.string(),
    last_name: z.string(),
    is_superuser: z.boolean()
  })
  .strict()

export type UserSummary = z.infer<typeof UserSummarySchema>

const ValidationIssueSchema = z
  .object({
    location: z.array(z.union([z.string(), z.number().int()])),
    message: z.string(),
    code: z.string()
  })
  .strict()

export const ProblemDetailsSchema = z
  .object({
    type: z.string(),
    title: z.string(),
    status: z.number().int(),
    detail: z.string(),
    instance: z.string(),
    request_id: z.string(),
    errors: z.array(ValidationIssueSchema).nullable().optional()
  })
  .strict()

export type ProblemDetails = z.infer<typeof ProblemDetailsSchema>
