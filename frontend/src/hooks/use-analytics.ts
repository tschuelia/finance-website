import { useQuery } from '@tanstack/react-query'
import { getCategoryComparisons, getCategoryTotals, getMonthlyTotals } from '@/api/analytics'
import { useAuthenticatedUserId } from '@/features/auth/use-auth'
import { resolveQuery } from '@/hooks/resolveQuery'
import type { HookReturnValue } from '@/hooks/resolveQuery'
import type {
  AnalyticsFilters,
  CategoryComparisons,
  CategoryTotals,
  MonthlyQuery,
  MonthlyTotals
} from '@/types/analytics'
import type { ComparisonQuery } from '@/types/analytics'

export const useCategoryTotals = (
  accountId: number,
  filters: AnalyticsFilters
): HookReturnValue<CategoryTotals> => {
  const userId = useAuthenticatedUserId()
  const query = useQuery({
    queryKey: ['analytics', userId, 'categories', accountId, filters],
    queryFn: async () => await getCategoryTotals(accountId, filters),
    enabled: userId !== null && Number.isInteger(accountId) && accountId > 0
  })
  return resolveQuery(query)
}

export const useCategoryComparisons = (
  accountId: number,
  queryInput: ComparisonQuery
): HookReturnValue<CategoryComparisons> => {
  const userId = useAuthenticatedUserId()
  const query = useQuery({
    queryKey: ['analytics', userId, 'comparisons', accountId, queryInput],
    queryFn: async () => await getCategoryComparisons(accountId, queryInput),
    enabled: userId !== null && Number.isInteger(accountId) && accountId > 0
  })
  return resolveQuery(query)
}

export const useMonthlyTotals = (
  accountId: number,
  queryInput: MonthlyQuery
): HookReturnValue<MonthlyTotals> => {
  const userId = useAuthenticatedUserId()
  const query = useQuery({
    queryKey: ['analytics', userId, 'monthly', accountId, queryInput],
    queryFn: async () => await getMonthlyTotals(accountId, queryInput),
    enabled: userId !== null && Number.isInteger(accountId) && accountId > 0
  })
  return resolveQuery(query)
}
