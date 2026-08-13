/* cspell:words Hauptnavigation Seitenleiste */

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Landmark } from 'lucide-react'
import { Link } from 'react-router'
import { Separator } from '@/components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger
} from '@/components/ui/sidebar'

export type NavigationItem = {
  label: string
  href: string
  icon: LucideIcon
}

type ApplicationLayoutProps = {
  children: ReactNode
  navigation: NavigationItem[]
  activeHref?: string
  brand?: string
  headerActions?: ReactNode
  footer?: ReactNode
}

export const ApplicationLayout = ({
  children,
  navigation,
  activeHref,
  brand = 'Finanzen',
  headerActions,
  footer
}: ApplicationLayoutProps) => {
  return (
    <SidebarProvider>
      <Sidebar collapsible="offcanvas">
        <SidebarHeader>
          <Link
            className="flex items-center gap-2 px-2 py-1.5 font-heading text-base font-semibold"
            to="/"
          >
            <Landmark className="size-4" aria-hidden />
            <span>{brand}</span>
          </Link>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Navigation</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu aria-label="Hauptnavigation">
                {navigation.map(({ label, href, icon: Icon }) => (
                  <SidebarMenuItem key={href}>
                    <SidebarMenuButton asChild isActive={href === activeHref} tooltip={label}>
                      <Link to={href}>
                        <Icon aria-hidden />
                        <span>{label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        {footer === undefined ? null : <SidebarFooter>{footer}</SidebarFooter>}
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4 sm:px-6">
          <SidebarTrigger aria-label="Seitenleiste umschalten" />
          <Separator orientation="vertical" className="h-4" />
          <div className="ml-auto flex items-center gap-2">{headerActions}</div>
        </header>
        <main className="flex min-h-0 flex-1 flex-col px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
