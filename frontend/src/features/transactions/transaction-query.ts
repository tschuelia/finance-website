import type { QueryClient } from '@tanstack/react-query'

export const invalidateAccountTransactionData = async (
  queryClient: QueryClient,
  accountId: number
): Promise<void> => {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['transactions', accountId] }),
    queryClient.invalidateQueries({ queryKey: ['account', accountId] }),
    queryClient.invalidateQueries({ queryKey: ['portfolio'] }),
    queryClient.invalidateQueries({ queryKey: ['analytics'] }),
    queryClient.invalidateQueries({ queryKey: ['contracts'] }),
    queryClient.invalidateQueries({ queryKey: ['contract'] })
  ])
}
