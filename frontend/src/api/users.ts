import { apiClient, parseApiResponse } from '@/api/index'
import { UserSummarySchema } from '@/types/common'
import type { UserSummary } from '@/types/common'
import * as z from 'zod'

const UserListSchema = z.array(UserSummarySchema)

export const getUsers = async (): Promise<UserSummary[]> => {
  const response = await apiClient.get('/users')
  return parseApiResponse(UserListSchema, response.data)
}
