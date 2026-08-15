import * as z from 'zod'

const MatchCandidateSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    matched_patterns: z.array(z.string())
  })
  .strict()

export const RuleMatchSchema = z
  .object({
    status: z.enum(['none', 'unique', 'ambiguous']),
    candidates: z.array(MatchCandidateSchema)
  })
  .strict()

export type RuleMatch = z.infer<typeof RuleMatchSchema>
