import * as z from 'zod'
import { TransactionSchema, TransactionWriteSchema } from '@/types/transactions'

export const CsvPreviewSchema = z
  .object({
    items: z.array(TransactionWriteSchema).min(1).max(500)
  })
  .strict()

export type CsvPreview = z.infer<typeof CsvPreviewSchema>

export const CsvCommitSchema = z
  .object({
    items: z.array(TransactionWriteSchema).min(1).max(500)
  })
  .strict()

export type CsvCommit = z.infer<typeof CsvCommitSchema>

export const CsvCommitResponseSchema = z
  .object({
    items: z.array(TransactionSchema),
    created: z.number().int().nonnegative()
  })
  .strict()

export type CsvCommitResponse = z.infer<typeof CsvCommitResponseSchema>
