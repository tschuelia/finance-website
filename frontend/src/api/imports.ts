import { apiClient, parseApiResponse } from '@/api/index'
import { CsvCommitResponseSchema, CsvCommitSchema, CsvPreviewSchema } from '@/types/imports'
import type { CsvCommitResponse, CsvPreview } from '@/types/imports'
import type { TransactionWrite } from '@/types/transactions'

const importUrl = (accountId: number) => `/accounts/${accountId}/transactions/import`

export const previewCsvImport = async (accountId: number, file: File): Promise<CsvPreview> => {
  const formData = new FormData()
  formData.append('upload', file)
  const response = await apiClient.post(`${importUrl(accountId)}/preview`, formData)
  return parseApiResponse(CsvPreviewSchema, response.data)
}

export const commitCsvImport = async (
  accountId: number,
  items: TransactionWrite[]
): Promise<CsvCommitResponse> => {
  const request = CsvCommitSchema.parse({ items })
  const response = await apiClient.post(`${importUrl(accountId)}/commit`, request)
  return parseApiResponse(CsvCommitResponseSchema, response.data)
}
