/* cspell:words Transaktionsfilter */

import { DateSchema, DecimalSchema } from '@/types/common'
import {
  TransactionDataFiltersSchema,
  TransactionFiltersSchema,
  TransactionTypeSchema
} from '@/types/transactions'
import type {
  TransactionDataFilters,
  TransactionFilters,
  TransactionType
} from '@/types/transactions'

const defaultDataFilters = (): TransactionDataFilters => ({
  category_ids: [],
  transaction_type: 'all'
})

const positiveInteger = (value: string | null, fallback: number): number => {
  const parsed = Number(value)
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback
}

const validDate = (value: string | null): string | undefined => {
  const parsed = DateSchema.safeParse(value)
  return parsed.success ? parsed.data : undefined
}

const validAmount = (value: string | null): number | undefined => {
  if (value === null || value === '') {
    return undefined
  }

  const parsed = DecimalSchema.safeParse(Number(value))
  return parsed.success && parsed.data >= 0 ? parsed.data : undefined
}

const validTransactionType = (value: string | null): TransactionType => {
  const parsed = TransactionTypeSchema.safeParse(value)
  return parsed.success ? parsed.data : 'all'
}

const validCategoryIds = (values: string[]): number[] => {
  const ids = values
    .map((value) => Number(value))
    .filter((value) => Number.isInteger(value) && value > 0)

  return [...new Set(ids)]
}

const transactionDataFiltersFromSearch = (search: string): TransactionDataFilters => {
  const params = new URLSearchParams(search)
  const dateStart = validDate(params.get('date_start'))
  const dateEnd = validDate(params.get('date_end'))
  const amountMin = validAmount(params.get('amount_min'))
  const amountMax = validAmount(params.get('amount_max'))
  return TransactionDataFiltersSchema.parse({
    q: params.get('q')?.trim() || undefined,
    date_start:
      dateStart !== undefined && (dateEnd === undefined || dateStart <= dateEnd)
        ? dateStart
        : undefined,
    date_end:
      dateEnd !== undefined && (dateStart === undefined || dateStart <= dateEnd)
        ? dateEnd
        : undefined,
    amount_min:
      amountMin !== undefined && (amountMax === undefined || amountMin <= amountMax)
        ? amountMin
        : undefined,
    amount_max:
      amountMax !== undefined && (amountMin === undefined || amountMin <= amountMax)
        ? amountMax
        : undefined,
    category_ids: validCategoryIds(params.getAll('category_ids')),
    transaction_type: validTransactionType(params.get('transaction_type'))
  })
}

export const transactionFiltersFromSearch = (search: string): TransactionFilters => {
  const params = new URLSearchParams(search)
  return TransactionFiltersSchema.parse({
    ...transactionDataFiltersFromSearch(search),
    page: positiveInteger(params.get('page'), 1),
    page_size: Math.min(positiveInteger(params.get('page_size'), 100), 500)
  })
}

const transactionDataFiltersToSearchParams = (filters: TransactionDataFilters): URLSearchParams => {
  const params = new URLSearchParams()

  if (filters.q !== undefined && filters.q !== '') {
    params.set('q', filters.q)
  }

  if (filters.date_start !== undefined) {
    params.set('date_start', filters.date_start)
  }

  if (filters.date_end !== undefined) {
    params.set('date_end', filters.date_end)
  }

  if (filters.amount_min !== undefined) {
    params.set('amount_min', String(filters.amount_min))
  }

  if (filters.amount_max !== undefined) {
    params.set('amount_max', String(filters.amount_max))
  }

  for (const categoryId of filters.category_ids) {
    params.append('category_ids', String(categoryId))
  }

  params.set('transaction_type', filters.transaction_type)
  return params
}

export const transactionFiltersToSearch = (filters: TransactionFilters): string => {
  const params = transactionDataFiltersToSearchParams(filters)
  params.set('page', String(filters.page))
  params.set('page_size', String(filters.page_size))

  const serialized = params.toString()
  return serialized === '' ? '' : `?${serialized}`
}

export const transactionFiltersForPage = (
  filters: TransactionFilters,
  page: number
): TransactionFilters => ({
  ...filters,
  page
})

export const defaultTransactionDataFilters = (): TransactionDataFilters => defaultDataFilters()
