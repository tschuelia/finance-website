import axios from 'axios'
import type { AxiosRequestConfig } from 'axios'
import type { z } from 'zod'
import { ProblemDetailsSchema } from '@/types/common'
import type { ProblemDetails } from '@/types/common'

type ApiRequestConfig = AxiosRequestConfig & {
  skipSessionExpired?: boolean
}

type RequestConfigWithSession = AxiosRequestConfig & {
  skipSessionExpired?: boolean
}

let csrfToken: string | undefined
let unauthorizedHandler: (() => void) | undefined

export class ApiError extends Error {
  readonly status: number | undefined
  readonly problem: ProblemDetails | undefined

  constructor(message: string, status?: number, problem?: ProblemDetails) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }
}

export const apiClient = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: {
    Accept: 'application/json'
  },
  paramsSerializer: {
    indexes: null
  }
})

apiClient.interceptors.request.use((config) => {
  const method = config.method?.toLowerCase()
  const isMutation = method !== undefined && !['get', 'head', 'options'].includes(method)

  if (isMutation && csrfToken !== undefined) {
    config.headers.set('X-CSRF-Token', csrfToken)
  }

  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (!axios.isAxiosError(error)) {
      return Promise.reject(error)
    }

    const status = error.response?.status
    const parsedProblem = ProblemDetailsSchema.safeParse(error.response?.data)
    const problem = parsedProblem.success ? parsedProblem.data : undefined
    const requestConfig = error.config as RequestConfigWithSession | undefined

    if (status === 401 && !requestConfig?.skipSessionExpired) {
      unauthorizedHandler?.()
    }

    return Promise.reject(
      new ApiError(
        problem?.detail ?? 'Die Anfrage konnte nicht verarbeitet werden.',
        status,
        problem
      )
    )
  }
)

export const parseApiResponse = <T>(schema: z.ZodType<T>, responseData: unknown): T => {
  const parsed = schema.safeParse(responseData)

  if (parsed.success) {
    return parsed.data
  }

  throw new ApiError('Die Serverantwort entspricht nicht dem erwarteten Format.')
}

export const setCsrfToken = (token: string) => {
  csrfToken = token
}

export const clearCsrfToken = () => {
  csrfToken = undefined
}

export const setUnauthorizedHandler = (handler: (() => void) | undefined) => {
  unauthorizedHandler = handler
}

export const withSession = (config: ApiRequestConfig = {}): ApiRequestConfig => config
