import type { QueryClient } from '@tanstack/react-query'

export const invalidateAccountTransactionData = async (
  queryClient: QueryClient,
  accountId: number
): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === 'transactions' && query.queryKey[2] === accountId
    }),
    queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === 'account' && query.queryKey[2] === accountId
    }),
    queryClient.invalidateQueries({ queryKey: ['portfolio'] }),
    queryClient.invalidateQueries({
      predicate: (query) => query.queryKey[0] === 'analytics' && query.queryKey[3] === accountId
    }),
    queryClient.invalidateQueries({ queryKey: ['contracts'] }),
    queryClient.invalidateQueries({ queryKey: ['contract'] })
  ])
}
