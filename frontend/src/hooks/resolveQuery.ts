import type { UseQueryResult } from '@tanstack/react-query'
import { ApiError } from '@/api/index'

export type HookReturnValue<T> =
  | {
      status: 'loading'
    }
  | {
      status: 'error'
      error: ApiError
    }
  | {
      status: 'success'
      data: T
    }

const toApiError = (error: unknown): ApiError => {
  if (error instanceof ApiError) {
    return error
  }

  if (error instanceof Error) {
    return new ApiError(error.message)
  }

  return new ApiError('Die Daten konnten nicht geladen werden.')
}

export const resolveQuery = <T>(query: UseQueryResult<T, Error>): HookReturnValue<T> => {
  if (query.isPending) {
    return { status: 'loading' }
  }

  if (query.isError) {
    return { status: 'error', error: toApiError(query.error) }
  }

  return { status: 'success', data: query.data }
}
