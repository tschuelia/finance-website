import { useQuery } from '@tanstack/react-query'
import { getTransaction, getTransactions } from '@/api/transactions'
import { resolveQuery } from '@/hooks/resolveQuery'
import type { HookReturnValue } from '@/hooks/resolveQuery'
import type { Transaction, TransactionFilters, TransactionPage } from '@/types/transactions'

export const transactionQueryKey = (accountId: number, filters: TransactionFilters) =>
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

export const useTransaction = (
  accountId: number,
  transactionId: number
): HookReturnValue<Transaction> => {
  const query = useQuery({
    queryKey: ['transaction', accountId, transactionId],
    queryFn: async () => await getTransaction(accountId, transactionId),
    enabled:
      Number.isInteger(accountId) &&
      accountId > 0 &&
      Number.isInteger(transactionId) &&
      transactionId > 0
  })
  return resolveQuery(query)
}
