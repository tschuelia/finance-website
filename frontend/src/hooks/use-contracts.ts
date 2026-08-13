import { useQuery } from '@tanstack/react-query'
import { getContract, getContracts } from '@/api/contracts'
import { resolveQuery } from '@/hooks/resolveQuery'
import type { HookReturnValue } from '@/hooks/resolveQuery'
import type { ContractDetail, ContractList } from '@/types/contracts'

export const contractsQueryKey = ['contracts'] as const

export const useContracts = (): HookReturnValue<ContractList> => {
  const query = useQuery({ queryKey: contractsQueryKey, queryFn: getContracts })
  return resolveQuery(query)
}

export const useContract = (contractId: number): HookReturnValue<ContractDetail> => {
  const query = useQuery({
    queryKey: ['contract', contractId],
    queryFn: async () => await getContract(contractId),
    enabled: Number.isInteger(contractId) && contractId > 0
  })
  return resolveQuery(query)
}
