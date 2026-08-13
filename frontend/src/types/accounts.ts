import * as z from 'zod'
import { DateSchema, DecimalSchema, UserSummarySchema } from '@/types/common'

export const AccountSummarySchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    bank: z.string(),
    current_amount: DecimalSchema,
    balance: DecimalSchema,
    oldest_transaction_date: DateSchema,
    newest_transaction_date: DateSchema,
    maximum_absolute_transaction_amount: DecimalSchema
  })
  .strict()

export type AccountSummary = z.infer<typeof AccountSummarySchema>

export const DepotSummarySchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    balance: DecimalSchema,
    last_update: DateSchema
  })
  .strict()

export type DepotSummary = z.infer<typeof DepotSummarySchema>

export const PortfolioGroupSchema = z
  .object({
    owner: UserSummarySchema,
    accounts: z.array(AccountSummarySchema),
    depots: z.array(DepotSummarySchema),
    balance: DecimalSchema
  })
  .strict()

export type PortfolioGroup = z.infer<typeof PortfolioGroupSchema>

export const PortfolioOverviewSchema = z
  .object({
    groups: z.array(PortfolioGroupSchema),
    total_balance: DecimalSchema
  })
  .strict()

export type PortfolioOverview = z.infer<typeof PortfolioOverviewSchema>

export const DepotAssetTransactionSchema = z
  .object({
    id: z.number().int().positive(),
    amount: DecimalSchema,
    date_issue: DateSchema
  })
  .strict()

export type DepotAssetTransaction = z.infer<typeof DepotAssetTransactionSchema>

export const DepotAssetSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    current_balance: DecimalSchema,
    last_update: DateSchema,
    transaction_total: DecimalSchema,
    transactions: z.array(DepotAssetTransactionSchema)
  })
  .strict()

export type DepotAsset = z.infer<typeof DepotAssetSchema>

export const DepotDetailSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    owner: UserSummarySchema,
    balance: DecimalSchema,
    last_update: DateSchema,
    assets: z.array(DepotAssetSchema)
  })
  .strict()

export type DepotDetail = z.infer<typeof DepotDetailSchema>

export const DepotAssetUpdateSchema = z
  .object({
    current_balance: DecimalSchema,
    last_update: DateSchema
  })
  .strict()

export type DepotAssetUpdate = z.infer<typeof DepotAssetUpdateSchema>
