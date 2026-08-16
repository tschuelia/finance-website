import { useQuery } from '@tanstack/react-query'
import { getCashFlowDashboard, getWealthDashboard } from '@/api/analytics'
import { useAuthenticatedUserId } from '@/features/auth/use-auth'
import { resolveQuery } from '@/hooks/resolveQuery'
import type { HookReturnValue } from '@/hooks/resolveQuery'
import type {
  CashFlowDashboard,
  CashFlowQuery,
  WealthDashboard,
  WealthQuery
} from '@/types/analytics'

export const useCashFlowDashboard = (
  queryInput: CashFlowQuery
): HookReturnValue<CashFlowDashboard> => {
  const userId = useAuthenticatedUserId()
  const query = useQuery({
    queryKey: ['analytics', userId, 'cash-flow', queryInput],
    queryFn: async () => await getCashFlowDashboard(queryInput),
    enabled: userId !== null && queryInput.account_ids.length > 0
  })
  return resolveQuery(query)
}

export const useWealthDashboard = (
  queryInput: WealthQuery,
  enabled: boolean
): HookReturnValue<WealthDashboard> => {
  const userId = useAuthenticatedUserId()
  const query = useQuery({
    queryKey: ['analytics', userId, 'wealth', queryInput],
    queryFn: async () => await getWealthDashboard(queryInput),
    enabled: enabled && userId !== null && queryInput.sources.length > 0
  })
  return resolveQuery(query)
}
