/* cspell:words Anmeldedaten Finanzverwaltung */

import type { FormEvent } from 'react'
import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Landmark, LogIn } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/features/auth/use-auth'
import { HOME } from '@/routes/urls'
import { toast } from 'sonner'

type LoginLocationState = {
  from?: string
  sessionExpired?: boolean
}

const readLoginState = (value: unknown): LoginLocationState => {
  if (typeof value !== 'object' || value === null) {
    return {}
  }

  const candidate = value as Record<string, unknown>
  return {
    from: typeof candidate.from === 'string' ? candidate.from : undefined,
    sessionExpired: candidate.sessionExpired === true
  }
}

export const LoginPage = () => {
  const { signIn, isSigningIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | undefined>()
  const state = readLoginState(location.state)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setFormError(undefined)

    try {
      await signIn({ username, password })
      navigate(state.from ?? HOME, { replace: true })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Die Anmeldung ist fehlgeschlagen.'
      setFormError(message)
      toast.error('Die Anmeldung ist fehlgeschlagen.', {
        description: message,
        id: `login-error-${message.slice(0, 100)}`
      })
    }
  }

  return (
    <main className="grid min-h-svh place-items-center bg-muted/40 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Landmark className="size-5" aria-hidden />
          </div>
          <div>
            <CardTitle className="text-xl">Bei Finanzen anmelden</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {state.sessionExpired ? (
            <p className="mb-4 rounded-md bg-muted p-3 text-sm">
              Deine Sitzung ist abgelaufen. Melde Dich bitte erneut an.
            </p>
          ) : null}
          <form className="grid gap-4" onSubmit={submit}>
            <div className="grid gap-2">
              <Label htmlFor="username">Benutzername</Label>
              <Input
                autoComplete="username"
                id="username"
                onChange={(event) => setUsername(event.target.value)}
                required
                value={username}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Passwort</Label>
              <Input
                autoComplete="current-password"
                id="password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </div>
            {formError === undefined ? null : (
              <p className="text-sm text-destructive">{formError}</p>
            )}
            <Button className="w-full" disabled={isSigningIn} type="submit">
              <LogIn aria-hidden />
              {isSigningIn ? 'Anmeldung läuft …' : 'Anmelden'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
