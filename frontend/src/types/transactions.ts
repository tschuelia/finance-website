import * as z from 'zod'
import { DateSchema, DecimalSchema } from '@/types/common'

export const TransactionTypeSchema = z.enum(['all', 'income', 'expense'])

export type TransactionType = z.infer<typeof TransactionTypeSchema>

export const TransactionSchema = z
  .object({
    id: z.number().int().positive(),
    bank_account_id: z.number().int().positive().nullable(),
    recipient: z.string(),
    amount: DecimalSchema,
    subject: z.string(),
    date_issue: DateSchema,
    date_booking: DateSchema.nullable(),
    full_subject_string: z.string(),
    category_id: z.number().int().positive().nullable(),
    category_name: z.string().nullable(),
    contract_id: z.number().int().positive().nullable(),
    contract_name: z.string().nullable()
  })
  .strict()

export type Transaction = z.infer<typeof TransactionSchema>

export const TransactionSummarySchema = z
  .object({
    total: DecimalSchema,
    paid: DecimalSchema,
    received: DecimalSchema,
    minimum_date: DateSchema.nullable(),
    maximum_date: DateSchema.nullable()
  })
  .strict()

export type TransactionSummary = z.infer<typeof TransactionSummarySchema>

export const TransactionPageSchema = z
  .object({
    items: z.array(TransactionSchema),
    page: z.number().int().positive(),
    page_size: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    total_pages: z.number().int().nonnegative(),
    summary: TransactionSummarySchema
  })
  .strict()

export type TransactionPage = z.infer<typeof TransactionPageSchema>

export const TransactionWriteSchema = z
  .object({
    bank_account_id: z.number().int().positive(),
    recipient: z.string().max(255).nullable().optional(),
    amount: DecimalSchema,
    subject: z.string().max(1024),
    date_issue: DateSchema,
    date_booking: DateSchema.nullable().optional(),
    full_subject_string: z.string().nullable().optional(),
    category_id: z.number().int().positive().nullable().optional(),
    contract_id: z.number().int().positive().nullable().optional()
  })
  .strict()

export type TransactionWrite = z.infer<typeof TransactionWriteSchema>

export const TransactionFiltersSchema = z
  .object({
    q: z.string().optional(),
    date_start: DateSchema.optional(),
    date_end: DateSchema.optional(),
    amount_min: DecimalSchema.optional(),
    amount_max: DecimalSchema.optional(),
    category_ids: z.array(z.number().int().positive()).default([]),
    transaction_type: TransactionTypeSchema.default('all'),
    page: z.number().int().positive().default(1),
    page_size: z.number().int().positive().max(500).default(100)
  })
  .strict()

export type TransactionFilters = z.infer<typeof TransactionFiltersSchema>
