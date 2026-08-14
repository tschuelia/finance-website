import { useQuery } from '@tanstack/react-query'
import { getUsers } from '@/api/users'
import { useAuthenticatedUserId } from '@/features/auth/use-auth'
import { resolveQuery } from '@/hooks/resolveQuery'
import type { HookReturnValue } from '@/hooks/resolveQuery'
import type { UserSummary } from '@/types/common'

const usersQueryKey = ['users'] as const

export const useUsers = (): HookReturnValue<UserSummary[]> => {
  const userId = useAuthenticatedUserId()
  const query = useQuery({
    queryKey: [...usersQueryKey, userId],
    queryFn: getUsers,
    enabled: userId !== null
  })
  return resolveQuery(query)
}
