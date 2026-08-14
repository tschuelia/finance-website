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

export const AccountDetailSchema = AccountSummarySchema.extend({
  owner: UserSummarySchema
}).strict()

export type AccountDetail = z.infer<typeof AccountDetailSchema>

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

export const DepotBalancePointSchema = z
  .object({
    date: DateSchema,
    balance: DecimalSchema
  })
  .strict()

export type DepotBalancePoint = z.infer<typeof DepotBalancePointSchema>

export const DepotAssetSchema = z
  .object({
    id: z.number().int().positive(),
    name: z.string(),
    current_balance: DecimalSchema,
    last_update: DateSchema,
    transaction_total: DecimalSchema,
    transactions: z.array(DepotAssetTransactionSchema),
    balance_history: z.array(DepotBalancePointSchema)
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
    balance_history: z.array(DepotBalancePointSchema),
    assets: z.array(DepotAssetSchema)
  })
  .strict()

export type DepotDetail = z.infer<typeof DepotDetailSchema>

export const DepotAssetUpdateSchema = z
  .object({
    current_balance: DecimalSchema
  })
  .strict()

export type DepotAssetUpdate = z.infer<typeof DepotAssetUpdateSchema>
