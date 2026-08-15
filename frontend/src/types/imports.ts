import * as z from 'zod'
import { TransactionSchema, TransactionWriteSchema } from '@/types/transactions'
import { RuleMatchSchema } from '@/types/matching'

const CsvPreviewRowSchema = z
  .object({
    source_row: z.number().int().positive(),
    transaction: TransactionWriteSchema,
    category_match: RuleMatchSchema,
    contract_match: RuleMatchSchema
  })
  .strict()

export type CsvPreviewRow = z.infer<typeof CsvPreviewRowSchema>

const CsvSkippedRowSchema = z
  .object({
    source_row: z.number().int().positive(),
    reason: z.string()
  })
  .strict()

export const CsvPreviewSchema = z
  .object({
    items: z.array(CsvPreviewRowSchema).min(1).max(500),
    skipped_rows: z.array(CsvSkippedRowSchema)
  })
  .strict()

export type CsvPreview = z.infer<typeof CsvPreviewSchema>

export const CsvCommitSchema = z
  .object({
    items: z.array(TransactionWriteSchema).min(1).max(500)
  })
  .strict()

export const CsvCommitResponseSchema = z
  .object({
    items: z.array(TransactionSchema),
    created: z.number().int().nonnegative()
  })
  .strict()

export type CsvCommitResponse = z.infer<typeof CsvCommitResponseSchema>
