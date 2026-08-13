import { apiClient, parseApiResponse } from '@/api/index'
import {
  TransactionBulkCreateSchema,
  TransactionBulkSchema,
  TransactionFiltersSchema,
  TransactionPageSchema,
  TransactionSchema,
  TransactionWriteSchema
} from '@/types/transactions'
import type {
  Transaction,
  TransactionBulk,
  TransactionFilters,
  TransactionPage,
  TransactionWrite
} from '@/types/transactions'

const transactionUrl = (accountId: number) => `/accounts/${accountId}/transactions`

export const getTransactions = async (
  accountId: number,
  filters: TransactionFilters
): Promise<TransactionPage> => {
  const params = TransactionFiltersSchema.parse(filters)
  const response = await apiClient.get(transactionUrl(accountId), { params })
  return parseApiResponse(TransactionPageSchema, response.data)
}

export const getTransaction = async (
  accountId: number,
  transactionId: number
): Promise<Transaction> => {
  const response = await apiClient.get(`${transactionUrl(accountId)}/${transactionId}`)
  return parseApiResponse(TransactionSchema, response.data)
}

export const updateTransaction = async (
  accountId: number,
  transactionId: number,
  payload: TransactionWrite
): Promise<Transaction> => {
  const request = TransactionWriteSchema.parse(payload)
  const response = await apiClient.put(`${transactionUrl(accountId)}/${transactionId}`, request)
  return parseApiResponse(TransactionSchema, response.data)
}

export const deleteTransaction = async (
  accountId: number,
  transactionId: number
): Promise<void> => {
  await apiClient.delete(`${transactionUrl(accountId)}/${transactionId}`)
}

export const createTransactions = async (
  accountId: number,
  items: TransactionWrite[]
): Promise<TransactionBulk> => {
  const request = TransactionBulkCreateSchema.parse({ items })
  const response = await apiClient.post(`${transactionUrl(accountId)}/bulk`, request)
  return parseApiResponse(TransactionBulkSchema, response.data)
}
