import * as z from 'zod'
import { DateSchema, DecimalSchema, UserSummarySchema } from '@/types/common'
import { TransactionSchema } from '@/types/transactions'

export const ContractFileSchema = z
  .object({
    id: z.number().int().positive(),
    filename: z.string(),
    download_url: z.string()
  })
  .strict()

export type ContractFile = z.infer<typeof ContractFileSchema>

export const ContractSummarySchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    owner: UserSummarySchema,
    description: z.string().nullable(),
    is_active: z.boolean(),
    start_date: DateSchema.nullable(),
    end_date: DateSchema.nullable()
  })
  .strict()

export type ContractSummary = z.infer<typeof ContractSummarySchema>

export const ContractListSchema = z
  .object({
    active: z.array(ContractSummarySchema),
    inactive: z.array(ContractSummarySchema)
  })
  .strict()

export type ContractList = z.infer<typeof ContractListSchema>

export const ContractDetailSchema = ContractSummarySchema.extend({
  balance: DecimalSchema,
  first_transaction_date: DateSchema.nullable(),
  last_transaction_date: DateSchema.nullable(),
  transactions: z.array(TransactionSchema),
  files: z.array(ContractFileSchema)
}).strict()

export type ContractDetail = z.infer<typeof ContractDetailSchema>

export const ContractWriteSchema = z
  .object({
    owner_id: z.number().int().positive(),
    name: z.string().trim().min(1).max(255),
    description: z.string().nullable().optional(),
    is_active: z.boolean().default(true),
    start_date: DateSchema.nullable().optional(),
    end_date: DateSchema.nullable().optional()
  })
  .strict()
  .refine(
    ({ start_date, end_date }) =>
      start_date === undefined ||
      end_date === undefined ||
      start_date === null ||
      end_date === null ||
      start_date <= end_date,
    { message: 'Das Enddatum darf nicht vor dem Startdatum liegen.', path: ['end_date'] }
  )

export type ContractWrite = z.infer<typeof ContractWriteSchema>
