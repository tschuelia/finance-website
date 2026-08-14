import { useQuery } from '@tanstack/react-query'
import { getDepot, getPortfolioOverview } from '@/api/accounts'
import { resolveQuery } from '@/hooks/resolveQuery'
import type { HookReturnValue } from '@/hooks/resolveQuery'
import type { DepotDetail, PortfolioOverview } from '@/types/accounts'

const portfolioQueryKey = ['portfolio'] as const

export const usePortfolioOverview = (): HookReturnValue<PortfolioOverview> => {
  const query = useQuery({ queryKey: portfolioQueryKey, queryFn: getPortfolioOverview })
  return resolveQuery(query)
}

export const useDepot = (depotId: number): HookReturnValue<DepotDetail> => {
  const query = useQuery({
    queryKey: ['depot', depotId],
    queryFn: async () => await getDepot(depotId),
    enabled: Number.isInteger(depotId) && depotId > 0
  })
  return resolveQuery(query)
}
