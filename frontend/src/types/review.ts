import * as z from 'zod'
import { UserSummarySchema } from '@/types/common'
import { RuleMatchSchema } from '@/types/matching'
import { TransactionSchema } from '@/types/transactions'

const ReviewIssueSchema = z.enum(['all', 'category', 'contract'])
export type ReviewIssue = z.infer<typeof ReviewIssueSchema>

export const AssignmentReviewFiltersSchema = z
  .object({
    issue: ReviewIssueSchema.default('all'),
    owner_id: z.number().int().positive().optional(),
    account_id: z.number().int().positive().optional(),
    contract_id: z.number().int().positive().optional(),
    q: z.string().optional(),
    page: z.number().int().positive().default(1),
    page_size: z.number().int().positive().max(100).default(50)
  })
  .strict()

export type AssignmentReviewFilters = z.infer<typeof AssignmentReviewFiltersSchema>

const AssignmentReviewRowSchema = z
  .object({
    transaction: TransactionSchema,
    account_name: z.string(),
    owner: UserSummarySchema,
    category_match: RuleMatchSchema,
    contract_match: RuleMatchSchema,
    issues: z.array(z.enum(['category', 'contract']))
  })
  .strict()

export const AssignmentReviewPageSchema = z
  .object({
    items: z.array(AssignmentReviewRowSchema),
    page: z.number().int().positive(),
    page_size: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    total_pages: z.number().int().positive()
  })
  .strict()

export type AssignmentReviewPage = z.infer<typeof AssignmentReviewPageSchema>

export const AssignmentBulkUpdateSchema = z
  .object({
    transaction_ids: z.array(z.number().int().positive()).min(1).max(500),
    set_category: z.boolean(),
    category_id: z.number().int().positive().nullable().optional(),
    set_contract: z.boolean(),
    contract_id: z.number().int().positive().nullable().optional()
  })
  .strict()

export type AssignmentBulkUpdate = z.infer<typeof AssignmentBulkUpdateSchema>

export const AssignmentBulkUpdateResponseSchema = z
  .object({ updated: z.number().int().nonnegative() })
  .strict()

export const PatternPreviewRequestSchema = z
  .object({
    patterns: z.string(),
    owner_id: z.number().int().positive().optional(),
    start_date: z.iso.date().nullable().optional(),
    end_date: z.iso.date().nullable().optional()
  })
  .strict()

export type PatternPreviewRequest = z.infer<typeof PatternPreviewRequestSchema>

export const PatternPreviewResponseSchema = z
  .object({
    total: z.number().int().nonnegative(),
    examples: z.array(
      z
        .object({
          id: z.number().int().positive(),
          recipient: z.string(),
          subject: z.string(),
          date_issue: z.iso.date(),
          account_name: z.string()
        })
        .strict()
    )
  })
  .strict()

export type PatternPreview = z.infer<typeof PatternPreviewResponseSchema>
