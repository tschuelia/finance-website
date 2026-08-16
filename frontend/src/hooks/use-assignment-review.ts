import { useQuery } from '@tanstack/react-query'
import { getAssignmentReview, getTransferReview } from '@/api/review'
import { useAuthenticatedUserId } from '@/features/auth/use-auth'
import { resolveQuery } from '@/hooks/resolveQuery'
import type { HookReturnValue } from '@/hooks/resolveQuery'
import type {
  AssignmentReviewFilters,
  AssignmentReviewPage,
  TransferReviewFilters,
  TransferReviewPage
} from '@/types/review'

export const assignmentReviewQueryKey = ['assignment-review'] as const
export const transferReviewQueryKey = ['transfer-review'] as const

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

export const useTransferReview = (
  filters: TransferReviewFilters
): HookReturnValue<TransferReviewPage> => {
  const userId = useAuthenticatedUserId()
  const query = useQuery({
    queryKey: [...transferReviewQueryKey, userId, filters],
    queryFn: async () => await getTransferReview(filters),
    enabled: userId !== null
  })
  return resolveQuery(query)
}
