import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { previewAssignmentPatterns } from '@/api/review'
import { useAuthenticatedUserId } from '@/features/auth/use-auth'
import type { PatternPreview, PatternPreviewRequest } from '@/types/review'

type PatternPreviewState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'success'; data: PatternPreview }

export const usePatternPreview = (request: PatternPreviewRequest): PatternPreviewState => {
  const userId = useAuthenticatedUserId()
  const [debounced, setDebounced] = useState(request)
  const { patterns, owner_id, start_date, end_date } = request

  useEffect(() => {
    const timeout = window.setTimeout(
      () => setDebounced({ patterns, owner_id, start_date, end_date }),
      350
    )
    return () => window.clearTimeout(timeout)
  }, [patterns, owner_id, start_date, end_date])

  const enabled = userId !== null && debounced.patterns.trim() !== ''
  const query = useQuery({
    queryKey: ['pattern-preview', userId, debounced],
    queryFn: async () => await previewAssignmentPatterns(debounced),
    enabled
  })

  if (!enabled) return { status: 'idle' }
  if (query.isPending) return { status: 'loading' }
  if (query.isError) {
    return {
      status: 'error',
      error: query.error instanceof Error ? query.error : new Error('Vorschau fehlgeschlagen')
    }
  }
  return { status: 'success', data: query.data }
}
