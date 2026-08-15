import { apiClient, parseApiResponse } from '@/api/index'
import {
  TransactionFiltersSchema,
  TransactionPageSchema,
  TransactionSchema,
  TransactionWriteSchema
} from '@/types/transactions'
import type {
  Transaction,
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
