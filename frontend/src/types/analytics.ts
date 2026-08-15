import * as z from 'zod'
import { DecimalSchema } from '@/types/common'
import { TransactionDataFiltersSchema } from '@/types/transactions'

export const AnalyticsFiltersSchema = TransactionDataFiltersSchema

export type AnalyticsFilters = z.infer<typeof AnalyticsFiltersSchema>

const CategoryTotalSchema = z
  .object({
    category: z.string(),
    income: DecimalSchema,
    expense: DecimalSchema
  })
  .strict()

export const CategoryTotalsSchema = z
  .object({
    income_color: z.string(),
    expense_color: z.string(),
    series: z.array(CategoryTotalSchema)
  })
  .strict()

export type CategoryTotals = z.infer<typeof CategoryTotalsSchema>

const ComparisonPeriodSchema = z
  .object({
    period: z.string(),
    label: z.string(),
    series: z.array(CategoryTotalSchema)
  })
  .strict()

export const CategoryComparisonsSchema = z
  .object({
    income_color: z.string(),
    expense_color: z.string(),
    comparisons: z.array(ComparisonPeriodSchema)
  })
  .strict()

export type CategoryComparisons = z.infer<typeof CategoryComparisonsSchema>

const MonthlyTotalSchema = z
  .object({
    period: z.string(),
    label: z.string(),
    income: DecimalSchema,
    expense: DecimalSchema
  })
  .strict()

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
