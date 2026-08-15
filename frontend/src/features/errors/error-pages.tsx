/* cspell:words Wiederherstellungsversuch */

import { AlertTriangle, ArrowLeft, Compass } from 'lucide-react'
import type { ReactNode } from 'react'
import { Component } from 'react'
import { Link } from 'react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { HOME } from '@/routes/urls'

export const NotFoundPage = () => {
  return (
    <main className="grid min-h-svh place-items-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Compass className="size-5" aria-hidden />
            Diese Seite gibt es nicht
          </CardTitle>
          <CardDescription>
            Die Adresse ist ungültig oder die Seite wurde verschoben.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link to={HOME}>
              <ArrowLeft aria-hidden />
              Zur Finanzübersicht
            </Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  )
}

export const FatalErrorPage = () => {
  return (
    <main className="grid min-h-svh place-items-center bg-muted/40 p-4">
      <Card className="w-full max-w-lg border-destructive/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" aria-hidden />
            Etwas ist schiefgelaufen
          </CardTitle>
          <CardDescription>
            Die Anwendung konnte diese Ansicht nicht wiederherstellen. Lade die Seite bitte neu.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => window.location.reload()}>Seite neu laden</Button>
        </CardContent>
      </Card>
    </main>
  )
}

type AppErrorBoundaryProps = {
  children: ReactNode
}

type AppErrorBoundaryState = {
  failed: boolean
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true }
  }

  render(): ReactNode {
    if (this.state.failed) {
      return <FatalErrorPage />
    }

    return this.props.children
  }
}
