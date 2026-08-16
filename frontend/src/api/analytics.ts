import { apiClient, parseApiResponse } from '@/api/index'
import {
  CashFlowDashboardSchema,
  CashFlowQuerySchema,
  WealthDashboardSchema,
  WealthQuerySchema
} from '@/types/analytics'
import type {
  CashFlowDashboard,
  CashFlowQuery,
  WealthDashboard,
  WealthQuery
} from '@/types/analytics'

export const getCashFlowDashboard = async (query: CashFlowQuery): Promise<CashFlowDashboard> => {
  const params = CashFlowQuerySchema.parse(query)
  const response = await apiClient.get('/analytics/cash-flow', { params })
  return parseApiResponse(CashFlowDashboardSchema, response.data)
}

export const getWealthDashboard = async (query: WealthQuery): Promise<WealthDashboard> => {
  const params = WealthQuerySchema.parse(query)
  const response = await apiClient.get('/analytics/wealth', { params })
  return parseApiResponse(WealthDashboardSchema, response.data)
}
