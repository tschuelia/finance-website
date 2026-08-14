import { useQuery } from '@tanstack/react-query'
import { getTransactions } from '@/api/transactions'
import { resolveQuery } from '@/hooks/resolveQuery'
import type { HookReturnValue } from '@/hooks/resolveQuery'
import type { TransactionFilters, TransactionPage } from '@/types/transactions'

const transactionQueryKey = (accountId: number, filters: TransactionFilters) =>
  ['transactions', accountId, filters] as const

export const useTransactions = (
  accountId: number,
  filters: TransactionFilters
): HookReturnValue<TransactionPage> => {
  const query = useQuery({
    queryKey: transactionQueryKey(accountId, filters),
    queryFn: async () => await getTransactions(accountId, filters),
    enabled: Number.isInteger(accountId) && accountId > 0
  })
  return resolveQuery(query)
}
