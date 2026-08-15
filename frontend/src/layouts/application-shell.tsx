/* cspell:words Abmelden Hauptnavigation Finanzverwaltung */

import { BarChart3, Landmark, ListChecks, LogOut, ReceiptText, Tags } from 'lucide-react'
import type { ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { useSidebar } from '@/components/ui/sidebar'
import { ApplicationLayout } from '@/layouts/application-layout'
import { useAuth } from '@/features/auth/use-auth'
import { displayName } from '@/lib/format'
import { ANALYTICS, ASSIGNMENTS, CATEGORIES, CONTRACTS, HOME, LOGIN } from '@/routes/urls'

type ApplicationShellProps = {
  children: ReactNode
}

const navigation = [
  { label: 'Übersicht', href: HOME, icon: Landmark },
  { label: 'Verträge', href: CONTRACTS, icon: ReceiptText },
  { label: 'Kategorien', href: CATEGORIES, icon: Tags },
  { label: 'Zuordnungen', href: ASSIGNMENTS, icon: ListChecks },
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

  if (pathname.startsWith(ASSIGNMENTS)) {
    return ASSIGNMENTS
  }

  return HOME
}

const initialsFor = (name: string): string => {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const initials = (parts.length > 1 ? [parts[0], parts.at(-1)] : parts)
    .map((part) => Array.from(part ?? '')[0] ?? '')
    .join('')

  return initials === '' ? '?' : initials.toLocaleUpperCase('de-DE')
}

type UserSidebarFooterProps = {
  initials: string
  isSigningOut: boolean
  logout: () => Promise<void>
  username: string
}

const UserSidebarFooter = ({
  initials,
  isSigningOut,
  logout,
  username
}: UserSidebarFooterProps) => {
  const { isMobile, state } = useSidebar()

  return (
    <div className="flex w-full items-center gap-2 overflow-hidden rounded-lg bg-sidebar-accent p-2 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0">
      <Tooltip>
        <TooltipTrigger asChild>
          <Avatar aria-label={`Angemeldet als ${username}`} tabIndex={0}>
            <AvatarFallback className="bg-sidebar-primary font-medium text-sidebar-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
        </TooltipTrigger>
        <TooltipContent align="center" hidden={state !== 'collapsed' || isMobile} side="right">
          {username}
        </TooltipContent>
      </Tooltip>
      <span className="min-w-0 flex-1 truncate text-sm font-medium group-data-[collapsible=icon]:hidden">
        {username}
      </span>
      <Button
        aria-label="Abmelden"
        className="ml-auto group-data-[collapsible=icon]:hidden"
        disabled={isSigningOut}
        onClick={logout}
        size="icon-sm"
        variant="ghost"
      >
        <LogOut aria-hidden />
      </Button>
    </div>
  )
}

export const ApplicationShell = ({ children }: ApplicationShellProps) => {
  const { state, signOut, isSigningOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  if (state.status !== 'authenticated') {
    return children
  }

  const logout = async () => {
    try {
      await signOut()
      navigate(LOGIN, { replace: true })
    } catch (error) {
      toast.error('Die Abmeldung ist fehlgeschlagen.', {
        description:
          error instanceof Error ? error.message : 'Bitte versuche die Abmeldung erneut.',
        id: 'logout-error'
      })
    }
  }

  return (
    <ApplicationLayout
      activeHref={activeNavigation(location.pathname)}
      brand="Finanzen"
      footer={
        <UserSidebarFooter
          initials={initialsFor(displayName(state.user))}
          isSigningOut={isSigningOut}
          logout={logout}
          username={state.user.username}
        />
      }
      navigation={navigation}
    >
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6">{children}</div>
    </ApplicationLayout>
  )
}
