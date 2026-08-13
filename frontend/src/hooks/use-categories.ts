import { useQuery } from '@tanstack/react-query'
import { getCategories } from '@/api/categories'
import { resolveQuery } from '@/hooks/resolveQuery'
import type { HookReturnValue } from '@/hooks/resolveQuery'
import type { Category } from '@/types/categories'

export const categoriesQueryKey = ['categories'] as const

export const useCategories = (): HookReturnValue<Category[]> => {
  const query = useQuery({ queryKey: categoriesQueryKey, queryFn: getCategories })
  return resolveQuery(query)
}
