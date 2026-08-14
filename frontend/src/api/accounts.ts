import { apiClient, parseApiResponse } from '@/api/index'
import { DepotAssetSchema, DepotDetailSchema, PortfolioOverviewSchema } from '@/types/accounts'
import type { DepotAsset, DepotAssetUpdate, DepotDetail, PortfolioOverview } from '@/types/accounts'

export const getPortfolioOverview = async (): Promise<PortfolioOverview> => {
  const response = await apiClient.get('/accounts')
  return parseApiResponse(PortfolioOverviewSchema, response.data)
}

export const getDepot = async (depotId: number): Promise<DepotDetail> => {
  const response = await apiClient.get(`/depots/${depotId}`)
  return parseApiResponse(DepotDetailSchema, response.data)
}

export const updateDepotAsset = async (
  depotId: number,
  assetId: number,
  payload: DepotAssetUpdate
): Promise<DepotAsset> => {
  const response = await apiClient.patch(`/depots/${depotId}/assets/${assetId}`, payload)
  return parseApiResponse(DepotAssetSchema, response.data)
}
