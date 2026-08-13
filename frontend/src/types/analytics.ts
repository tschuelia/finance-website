import * as z from 'zod'
import { DateSchema, DecimalSchema } from '@/types/common'
import { TransactionTypeSchema } from '@/types/transactions'

export const AnalyticsFiltersSchema = z
  .object({
    date_start: DateSchema.optional(),
    date_end: DateSchema.optional(),
    amount_min: DecimalSchema.optional(),
    amount_max: DecimalSchema.optional(),
    category_ids: z.array(z.number().int().positive()).default([]),
    transaction_type: TransactionTypeSchema.default('all')
  })
  .strict()

export type AnalyticsFilters = z.infer<typeof AnalyticsFiltersSchema>

export const CategoryTotalSchema = z
  .object({
    category: z.string(),
    income: DecimalSchema,
    expense: DecimalSchema
  })
  .strict()

export type CategoryTotal = z.infer<typeof CategoryTotalSchema>

export const CategoryTotalsSchema = z
  .object({
    income_color: z.string(),
    expense_color: z.string(),
    series: z.array(CategoryTotalSchema)
  })
  .strict()

export type CategoryTotals = z.infer<typeof CategoryTotalsSchema>

export const ComparisonPeriodSchema = z
  .object({
    period: z.string(),
    label: z.string(),
    series: z.array(CategoryTotalSchema)
  })
  .strict()

export type ComparisonPeriod = z.infer<typeof ComparisonPeriodSchema>

export const CategoryComparisonsSchema = z
  .object({
    income_color: z.string(),
    expense_color: z.string(),
    comparisons: z.array(ComparisonPeriodSchema)
  })
  .strict()

export type CategoryComparisons = z.infer<typeof CategoryComparisonsSchema>

export const MonthlyTotalSchema = z
  .object({
    period: z.string(),
    label: z.string(),
    income: DecimalSchema,
    expense: DecimalSchema
  })
  .strict()

export type MonthlyTotal = z.infer<typeof MonthlyTotalSchema>

export const MonthlyTotalsSchema = z
  .object({
    income_color: z.string(),
    expense_color: z.string(),
    series: z.array(MonthlyTotalSchema)
  })
  .strict()

export type MonthlyTotals = z.infer<typeof MonthlyTotalsSchema>

export const ComparisonQuerySchema = AnalyticsFiltersSchema.extend({
  periods: z.array(z.string()).length(3)
}).strict()

export type ComparisonQuery = z.infer<typeof ComparisonQuerySchema>

export const MonthlyQuerySchema = AnalyticsFiltersSchema.extend({
  months: z.number().int().min(1).max(120).default(12)
}).strict()

export type MonthlyQuery = z.infer<typeof MonthlyQuerySchema>
