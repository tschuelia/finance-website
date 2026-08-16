import * as z from 'zod'
import { DateSchema, DecimalSchema } from '@/types/common'

const MonthSchema = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)

const DashboardPeriodSchema = z
  .object({
    start_month: MonthSchema,
    end_month: MonthSchema,
    label: z.string(),
    month_count: z.number().int().positive(),
    is_partial: z.boolean()
  })
  .strict()

const ComparedMetricSchema = z
  .object({
    value: DecimalSchema,
    previous_value: DecimalSchema,
    absolute_change: DecimalSchema,
    percentage_change: DecimalSchema.nullable()
  })
  .strict()

const CashFlowSummarySchema = z
  .object({
    income: ComparedMetricSchema,
    expense: ComparedMetricSchema,
    net: ComparedMetricSchema,
    savings_rate: ComparedMetricSchema.nullable()
  })
  .strict()

const MonthlyCashFlowSchema = z
  .object({
    period: MonthSchema,
    label: z.string(),
    income: DecimalSchema,
    expense: DecimalSchema,
    net: DecimalSchema
  })
  .strict()

const AccountCashFlowSchema = z
  .object({
    account_id: z.number().int().positive(),
    account_name: z.string(),
    owner_name: z.string(),
    income: DecimalSchema,
    expense: DecimalSchema,
    net: DecimalSchema
  })
  .strict()

const CategoryCashFlowSchema = z
  .object({
    category_id: z.number().int().positive().nullable(),
    category: z.string(),
    expense: DecimalSchema,
    previous_expense: DecimalSchema,
    share: DecimalSchema,
    previous_share: DecimalSchema
  })
  .strict()

const CategoryMonthSchema = z
  .object({
    period: MonthSchema,
    category_id: z.number().int().positive().nullable(),
    category: z.string(),
    expense: DecimalSchema
  })
  .strict()

const ContractExpenseSchema = z
  .object({
    contract_id: z.number().int().positive(),
    contract_name: z.string(),
    owner_name: z.string(),
    expense: DecimalSchema,
    monthly_average: DecimalSchema,
    share: DecimalSchema
  })
  .strict()

const SpendingAnomalySchema = z
  .object({
    period: MonthSchema,
    category_id: z.number().int().positive().nullable(),
    category: z.string(),
    expense: DecimalSchema,
    baseline_median: DecimalSchema,
    absolute_change: DecimalSchema,
    percentage_change: DecimalSchema.nullable()
  })
  .strict()

const CategoryChangeSchema = z
  .object({
    category_id: z.number().int().positive().nullable(),
    category: z.string(),
    monthly_average: DecimalSchema,
    previous_monthly_average: DecimalSchema,
    absolute_change: DecimalSchema,
    percentage_change: DecimalSchema.nullable()
  })
  .strict()

export const CashFlowDashboardSchema = z
  .object({
    period: DashboardPeriodSchema,
    comparison_period: DashboardPeriodSchema,
    data_through: DateSchema.nullable(),
    account_ids: z.array(z.number().int().positive()),
    excluded_transfer_count: z.number().int().nonnegative(),
    summary: CashFlowSummarySchema,
    monthly: z.array(MonthlyCashFlowSchema),
    accounts: z.array(AccountCashFlowSchema),
    categories: z.array(CategoryCashFlowSchema),
    category_monthly: z.array(CategoryMonthSchema),
    contracts: z.array(ContractExpenseSchema),
    contract_expense_share: DecimalSchema,
    anomalies: z.array(SpendingAnomalySchema),
    increases: z.array(CategoryChangeSchema),
    decreases: z.array(CategoryChangeSchema)
  })
  .strict()

export type CashFlowDashboard = z.infer<typeof CashFlowDashboardSchema>

const WealthPointSchema = z
  .object({
    period: MonthSchema,
    label: z.string(),
    total: DecimalSchema.nullable(),
    bank_balance: DecimalSchema,
    depot_balance: DecimalSchema.nullable(),
    estimated: z.boolean(),
    coverage: DecimalSchema
  })
  .strict()

const WealthSourceSchema = z
  .object({
    source_type: z.enum(['account', 'depot']),
    source_id: z.number().int().positive(),
    name: z.string(),
    owner_name: z.string(),
    balance: DecimalSchema,
    last_update: DateSchema
  })
  .strict()

export const WealthDashboardSchema = z
  .object({
    period: DashboardPeriodSchema,
    current_total: DecimalSchema,
    liquid_total: DecimalSchema,
    invested_total: DecimalSchema,
    period_start_total: DecimalSchema.nullable(),
    period_end_total: DecimalSchema.nullable(),
    absolute_change: DecimalSchema.nullable(),
    percentage_change: DecimalSchema.nullable(),
    monthly: z.array(WealthPointSchema),
    sources: z.array(WealthSourceSchema)
  })
  .strict()

export type WealthDashboard = z.infer<typeof WealthDashboardSchema>

export const CashFlowQuerySchema = z
  .object({
    account_ids: z.array(z.number().int().positive()),
    start_month: MonthSchema.optional(),
    end_month: MonthSchema.optional()
  })
  .strict()

export type CashFlowQuery = z.infer<typeof CashFlowQuerySchema>

export const WealthQuerySchema = z
  .object({
    sources: z.array(z.string()).min(1),
    start_month: MonthSchema.optional(),
    end_month: MonthSchema.optional()
  })
  .strict()

export type WealthQuery = z.infer<typeof WealthQuerySchema>
