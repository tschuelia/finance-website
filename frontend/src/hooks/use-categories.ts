import { useQuery } from '@tanstack/react-query'
import { getCategories } from '@/api/categories'
import { useAuthenticatedUserId } from '@/features/auth/use-auth'
import { resolveQuery } from '@/hooks/resolveQuery'
import type { HookReturnValue } from '@/hooks/resolveQuery'
import type { Category } from '@/types/categories'

export const categoriesQueryKey = ['categories'] as const

export const useCategories = (): HookReturnValue<Category[]> => {
  const userId = useAuthenticatedUserId()
  const query = useQuery({
    queryKey: [...categoriesQueryKey, userId],
    queryFn: getCategories,
    enabled: userId !== null
  })
  return resolveQuery(query)
}
