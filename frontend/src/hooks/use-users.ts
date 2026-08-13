import { useQuery } from '@tanstack/react-query'
import { getUsers } from '@/api/users'
import { resolveQuery } from '@/hooks/resolveQuery'
import type { HookReturnValue } from '@/hooks/resolveQuery'
import type { UserSummary } from '@/types/common'

export const usersQueryKey = ['users'] as const

export const useUsers = (): HookReturnValue<UserSummary[]> => {
  const query = useQuery({ queryKey: usersQueryKey, queryFn: getUsers })
  return resolveQuery(query)
}
