import { apiClient, clearCsrfToken, parseApiResponse, setCsrfToken } from '@/api/index'
import type { ApiRequestConfig } from '@/api/index'
import { AuthenticatedUserSchema, LoginRequestSchema } from '@/types/auth'
import type { AuthenticatedUser, LoginRequest } from '@/types/auth'

const skipSessionExpiredConfig: ApiRequestConfig = { skipSessionExpired: true }

const parseAuthenticatedUser = (responseData: unknown): AuthenticatedUser => {
  const user = parseApiResponse(AuthenticatedUserSchema, responseData)
  setCsrfToken(user.csrf_token)
  return user
}

export const login = async (payload: LoginRequest): Promise<AuthenticatedUser> => {
  const request = LoginRequestSchema.parse(payload)
  const response = await apiClient.post('/auth/login', request, skipSessionExpiredConfig)
  return parseAuthenticatedUser(response.data)
}

export const logout = async (): Promise<void> => {
  await apiClient.post('/auth/logout')
  clearCsrfToken()
}

export const getCurrentUser = async (): Promise<AuthenticatedUser> => {
  const response = await apiClient.get('/auth/me', skipSessionExpiredConfig)
  return parseAuthenticatedUser(response.data)
}
