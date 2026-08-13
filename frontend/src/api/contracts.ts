import { apiClient, parseApiResponse } from '@/api/index'
import {
  ContractDetailSchema,
  ContractFileSchema,
  ContractListSchema,
  ContractSummarySchema,
  ContractWriteSchema
} from '@/types/contracts'
import type {
  ContractDetail,
  ContractFile,
  ContractList,
  ContractSummary,
  ContractWrite
} from '@/types/contracts'

export const getContracts = async (): Promise<ContractList> => {
  const response = await apiClient.get('/contracts')
  return parseApiResponse(ContractListSchema, response.data)
}

export const getContract = async (contractId: number): Promise<ContractDetail> => {
  const response = await apiClient.get(`/contracts/${contractId}`)
  return parseApiResponse(ContractDetailSchema, response.data)
}

export const createContract = async (payload: ContractWrite): Promise<ContractSummary> => {
  const request = ContractWriteSchema.parse(payload)
  const response = await apiClient.post('/contracts', request)
  return parseApiResponse(ContractSummarySchema, response.data)
}

export const updateContract = async (
  contractId: number,
  payload: ContractWrite
): Promise<ContractSummary> => {
  const request = ContractWriteSchema.parse(payload)
  const response = await apiClient.put(`/contracts/${contractId}`, request)
  return parseApiResponse(ContractSummarySchema, response.data)
}

export const uploadContractFile = async (contractId: number, file: File): Promise<ContractFile> => {
  const formData = new FormData()
  formData.append('upload', file)
  const response = await apiClient.post(`/contracts/${contractId}/files`, formData)
  return parseApiResponse(ContractFileSchema, response.data)
}

export const deleteContractFile = async (contractId: number, fileId: number): Promise<void> => {
  await apiClient.delete(`/contracts/${contractId}/files/${fileId}`)
}

export const downloadContractFile = async (downloadUrl: string): Promise<Blob> => {
  const relativeUrl = downloadUrl.startsWith('/api/v1/')
    ? downloadUrl.slice('/api/v1'.length)
    : downloadUrl
  const response = await apiClient.get(relativeUrl, { responseType: 'blob' })
  return response.data as Blob
}
