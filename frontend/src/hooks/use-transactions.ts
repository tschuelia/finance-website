import { useQuery } from '@tanstack/react-query'
import { getTransactions } from '@/api/transactions'
import { useAuthenticatedUserId } from '@/features/auth/use-auth'
import { resolveQuery } from '@/hooks/resolveQuery'
import type { HookReturnValue } from '@/hooks/resolveQuery'
import type { TransactionFilters, TransactionPage } from '@/types/transactions'

const transactionQueryKey = (
  userId: number | null,
  accountId: number,
  filters: TransactionFilters
) => ['transactions', userId, accountId, filters] as const

export const useTransactions = (
  accountId: number,
  filters: TransactionFilters
): HookReturnValue<TransactionPage> => {
  const userId = useAuthenticatedUserId()
  const query = useQuery({
    queryKey: transactionQueryKey(userId, accountId, filters),
    queryFn: async () => await getTransactions(accountId, filters),
    enabled: userId !== null && Number.isInteger(accountId) && accountId > 0
  })
  return resolveQuery(query)
}
