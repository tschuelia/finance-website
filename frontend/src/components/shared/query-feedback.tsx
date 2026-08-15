/* cspell:words Berechtigung Ladevorgang */

import { AlertCircle, Inbox, LockKeyhole } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Spinner } from '@/components/ui/spinner'
import type { ApiError } from '@/api/index'

type FeedbackProps = {
  title?: string
  description?: string
  action?: ReactNode
}

export const LoadingState = ({
  title = 'Daten werden geladen',
  description = 'Einen kleinen Moment bitte.'
}: FeedbackProps) => {
  return (
    <Card className="max-w-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Spinner />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  )
}

export const EmptyState = ({
  title = 'Noch keine Einträge',
  description = 'Sobald Daten vorhanden sind, findest Du sie hier.',
  action
}: FeedbackProps) => {
  return (
    <Card className="max-w-xl border-dashed">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Inbox className="size-5" aria-hidden />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      {action === undefined ? null : <CardContent>{action}</CardContent>}
    </Card>
  )
}

type ErrorStateProps = FeedbackProps & {
  error: ApiError
  onRetry?: () => void
}

export const ErrorState = ({ error, title, description, onRetry, action }: ErrorStateProps) => {
  const isForbidden = error.status === 403
  const displayedTitle =
    title ?? (isForbidden ? 'Kein Zugriff' : 'Daten konnten nicht geladen werden')
  const displayedDescription =
    description ??
    error.problem?.detail ??
    (isForbidden
      ? 'Du hast keine Berechtigung für diesen Bereich.'
      : 'Bitte prüfe Deine Verbindung und versuche es erneut.')
  const Icon = isForbidden ? LockKeyhole : AlertCircle

  return (
    <Card className="max-w-xl border-destructive/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className="size-5 text-destructive" aria-hidden />
          {displayedTitle}
        </CardTitle>
        <CardDescription>{displayedDescription}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {onRetry === undefined ? null : (
          <Button variant="outline" onClick={onRetry}>
            Erneut versuchen
          </Button>
        )}
        {action}
      </CardContent>
    </Card>
  )
}
