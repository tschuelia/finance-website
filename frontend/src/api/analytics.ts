import { apiClient, parseApiResponse } from '@/api/index'
import {
  AnalyticsFiltersSchema,
  CategoryComparisonsSchema,
  CategoryTotalsSchema,
  ComparisonQuerySchema,
  MonthlyQuerySchema,
  MonthlyTotalsSchema
} from '@/types/analytics'
import type {
  AnalyticsFilters,
  CategoryComparisons,
  CategoryTotals,
  ComparisonQuery,
  MonthlyQuery,
  MonthlyTotals
} from '@/types/analytics'

const analyticsUrl = (accountId: number) => `/accounts/${accountId}/analytics`

export const getCategoryTotals = async (
  accountId: number,
  filters: AnalyticsFilters
): Promise<CategoryTotals> => {
  const params = AnalyticsFiltersSchema.parse(filters)
  const response = await apiClient.get(`${analyticsUrl(accountId)}/categories`, { params })
  return parseApiResponse(CategoryTotalsSchema, response.data)
}

export const getCategoryComparisons = async (
  accountId: number,
  query: ComparisonQuery
): Promise<CategoryComparisons> => {
  const params = ComparisonQuerySchema.parse(query)
  const response = await apiClient.get(`${analyticsUrl(accountId)}/comparisons`, { params })
  return parseApiResponse(CategoryComparisonsSchema, response.data)
}

export const getMonthlyTotals = async (
  accountId: number,
  query: MonthlyQuery
): Promise<MonthlyTotals> => {
  const params = MonthlyQuerySchema.parse(query)
  const response = await apiClient.get(`${analyticsUrl(accountId)}/monthly`, { params })
  return parseApiResponse(MonthlyTotalsSchema, response.data)
}
