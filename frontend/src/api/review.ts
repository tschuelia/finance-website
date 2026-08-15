import { apiClient, parseApiResponse } from '@/api/index'
import {
  AssignmentBulkUpdateResponseSchema,
  AssignmentBulkUpdateSchema,
  AssignmentReviewFiltersSchema,
  AssignmentReviewPageSchema,
  PatternPreviewRequestSchema,
  PatternPreviewResponseSchema
} from '@/types/review'
import type {
  AssignmentBulkUpdate,
  AssignmentReviewFilters,
  AssignmentReviewPage,
  PatternPreview,
  PatternPreviewRequest
} from '@/types/review'

export const getAssignmentReview = async (
  filters: AssignmentReviewFilters
): Promise<AssignmentReviewPage> => {
  const params = AssignmentReviewFiltersSchema.parse(filters)
  const response = await apiClient.get('/transactions/review', { params })
  return parseApiResponse(AssignmentReviewPageSchema, response.data)
}

export const updateAssignments = async (payload: AssignmentBulkUpdate): Promise<number> => {
  const request = AssignmentBulkUpdateSchema.parse(payload)
  const response = await apiClient.patch('/transactions/review', request)
  return parseApiResponse(AssignmentBulkUpdateResponseSchema, response.data).updated
}

export const previewAssignmentPatterns = async (
  payload: PatternPreviewRequest
): Promise<PatternPreview> => {
  const request = PatternPreviewRequestSchema.parse(payload)
  const response = await apiClient.post('/transactions/review/patterns/preview', request)
  return parseApiResponse(PatternPreviewResponseSchema, response.data)
}
