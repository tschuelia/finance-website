import { useCategories } from '@/hooks/use-categories'
import { useContracts } from '@/hooks/use-contracts'
import type { ApiError } from '@/api/index'
import type { Category } from '@/types/categories'
import type { ContractSummary } from '@/types/contracts'

type TransactionFormOptions =
  | { status: 'loading' }
  | { status: 'error'; error: ApiError }
  | { status: 'success'; categories: Category[]; contracts: ContractSummary[] }

export const useTransactionFormOptions = (): TransactionFormOptions => {
  const categories = useCategories()
  const contracts = useContracts()

  if (categories.status === 'loading' || contracts.status === 'loading') {
    return { status: 'loading' }
  }

  if (categories.status === 'error') {
    return { status: 'error', error: categories.error }
  }

  if (contracts.status === 'error') {
    return { status: 'error', error: contracts.error }
  }

  const contractsById = new Map<number, ContractSummary>()

  for (const contract of [...contracts.data.active, ...contracts.data.inactive]) {
    contractsById.set(contract.id, contract)
  }

  return {
    status: 'success',
    categories: categories.data,
    contracts: [...contractsById.values()]
  }
}
