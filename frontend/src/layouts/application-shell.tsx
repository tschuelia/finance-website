/* cspell:words Abmelden Hauptnavigation Finanzverwaltung */

import { BarChart3, Landmark, LogOut, ReceiptText, Tags } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { Button } from '@/components/ui/button'
import { ApplicationLayout } from '@/layouts/application-layout'
import { useAuth } from '@/features/auth/use-auth'
import { displayName } from '@/lib/format'
import { ANALYTICS, CATEGORIES, CONTRACTS, HOME, LOGIN } from '@/routes/urls'

type ApplicationShellProps = {
  children: ReactNode
}

const navigation = [
  { label: 'Übersicht', href: HOME, icon: Landmark },
  { label: 'Verträge', href: CONTRACTS, icon: ReceiptText },
  { label: 'Kategorien', href: CATEGORIES, icon: Tags },
  { label: 'Auswertungen', href: ANALYTICS, icon: BarChart3 }
]

const activeNavigation = (pathname: string): string => {
  if (pathname.startsWith(CONTRACTS)) {
    return CONTRACTS
  }

  if (pathname.startsWith(CATEGORIES)) {
    return CATEGORIES
  }

  if (pathname.startsWith(ANALYTICS)) {
    return ANALYTICS
  }

  return HOME
}

export const ApplicationShell = ({ children }: ApplicationShellProps) => {
  const { state, signOut, isSigningOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (state.status !== 'authenticated') {
    return children
  }

  const logout = async () => {
    await signOut()
    navigate(LOGIN, { replace: true })
  }

  return (
    <ApplicationLayout
      activeHref={activeNavigation(location.pathname)}
      brand="Finanzen"
      footer={
        <div className="rounded-lg bg-sidebar-accent p-2 text-sm">
          <p className="truncate font-medium">{displayName(state.user)}</p>
          <p className="truncate text-xs text-muted-foreground">{state.user.username}</p>
        </div>
      }
      headerActions={
        <>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {displayName(state.user)}
          </span>
          <Button disabled={isSigningOut} onClick={logout} size="sm" variant="ghost">
            <LogOut aria-hidden />
            Abmelden
          </Button>
        </>
      }
      navigation={navigation}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">{children}</div>
    </ApplicationLayout>
  )
}
