import { apiClient, parseApiResponse } from '@/api/index'
import { CategorySchema, CategoryWriteSchema, RecategorizationSchema } from '@/types/categories'
import type { Category, CategoryWrite, Recategorization } from '@/types/categories'
import * as z from 'zod'

const CategoryListSchema = z.array(CategorySchema)

export const getCategories = async (): Promise<Category[]> => {
  const response = await apiClient.get('/categories')
  return parseApiResponse(CategoryListSchema, response.data)
}

export const createCategory = async (payload: CategoryWrite): Promise<Category> => {
  const request = CategoryWriteSchema.parse(payload)
  const response = await apiClient.post('/categories', request)
  return parseApiResponse(CategorySchema, response.data)
}

export const updateCategory = async (
  categoryId: number,
  payload: CategoryWrite
): Promise<Category> => {
  const request = CategoryWriteSchema.parse(payload)
  const response = await apiClient.put(`/categories/${categoryId}`, request)
  return parseApiResponse(CategorySchema, response.data)
}

export const recategorizeAccount = async (accountId: number): Promise<Recategorization> => {
  const response = await apiClient.post(`/accounts/${accountId}/recategorize`)
  return parseApiResponse(RecategorizationSchema, response.data)
}
