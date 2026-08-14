import { useQuery } from '@tanstack/react-query'
import { getContract, getContracts } from '@/api/contracts'
import { useAuthenticatedUserId } from '@/features/auth/use-auth'
import { resolveQuery } from '@/hooks/resolveQuery'
import type { HookReturnValue } from '@/hooks/resolveQuery'
import type { ContractDetail, ContractList } from '@/types/contracts'

export const contractsQueryKey = ['contracts'] as const

export const useContracts = (): HookReturnValue<ContractList> => {
  const userId = useAuthenticatedUserId()
  const query = useQuery({
    queryKey: [...contractsQueryKey, userId],
    queryFn: getContracts,
    enabled: userId !== null
  })
  return resolveQuery(query)
}

export const useContract = (contractId: number, page = 1): HookReturnValue<ContractDetail> => {
  const userId = useAuthenticatedUserId()
  const query = useQuery({
    queryKey: ['contract', userId, contractId, page],
    queryFn: async () => await getContract(contractId, page),
    enabled: userId !== null && Number.isInteger(contractId) && contractId > 0
  })
  return resolveQuery(query)
}
