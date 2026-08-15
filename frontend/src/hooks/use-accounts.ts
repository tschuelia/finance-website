import { useQuery } from '@tanstack/react-query'
import { getAccount, getDepot, getPortfolioOverview } from '@/api/accounts'
import { useAuthenticatedUserId } from '@/features/auth/use-auth'
import { resolveQuery } from '@/hooks/resolveQuery'
import type { HookReturnValue } from '@/hooks/resolveQuery'
import type { AccountDetail, DepotDetail, PortfolioOverview } from '@/types/accounts'

const portfolioQueryKey = ['portfolio'] as const

export const usePortfolioOverview = (): HookReturnValue<PortfolioOverview> => {
  const userId = useAuthenticatedUserId()
  const query = useQuery({
    queryKey: [...portfolioQueryKey, userId],
    queryFn: getPortfolioOverview,
    enabled: userId !== null
  })
  return resolveQuery(query)
}

export const useAccount = (accountId: number): HookReturnValue<AccountDetail> => {
  const userId = useAuthenticatedUserId()
  const query = useQuery({
    queryKey: ['account', userId, accountId],
    queryFn: async () => await getAccount(accountId),
    enabled: userId !== null && Number.isInteger(accountId) && accountId > 0
  })
  return resolveQuery(query)
}

export const useDepot = (depotId: number): HookReturnValue<DepotDetail> => {
  const userId = useAuthenticatedUserId()
  const query = useQuery({
    queryKey: ['depot', userId, depotId],
    queryFn: async () => await getDepot(depotId),
    enabled: userId !== null && Number.isInteger(depotId) && depotId > 0
  })
  return resolveQuery(query)
}
