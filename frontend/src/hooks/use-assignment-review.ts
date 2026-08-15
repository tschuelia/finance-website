import { useQuery } from '@tanstack/react-query'
import { getAssignmentReview } from '@/api/review'
import { useAuthenticatedUserId } from '@/features/auth/use-auth'
import { resolveQuery } from '@/hooks/resolveQuery'
import type { HookReturnValue } from '@/hooks/resolveQuery'
import type { AssignmentReviewFilters, AssignmentReviewPage } from '@/types/review'

export const assignmentReviewQueryKey = ['assignment-review'] as const

export const useAssignmentReview = (
  filters: AssignmentReviewFilters
): HookReturnValue<AssignmentReviewPage> => {
  const userId = useAuthenticatedUserId()
  const query = useQuery({
    queryKey: [...assignmentReviewQueryKey, userId, filters],
    queryFn: async () => await getAssignmentReview(filters),
    enabled: userId !== null
  })
  return resolveQuery(query)
}
