/* cspell:words Hauptnavigation Seitenleiste */

import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { Landmark } from 'lucide-react'
import { Link } from 'react-router'
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

type NavigationItem = {
  label: string
  href: string
  icon: LucideIcon
}

type ApplicationLayoutProps = {
  children: ReactNode
  navigation: NavigationItem[]
  activeHref?: string
  brand?: string
  footer?: ReactNode
}

export const ApplicationLayout = ({
  children,
  navigation,
  activeHref,
  brand = 'Finanzen',
  footer
}: ApplicationLayoutProps) => {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader className="h-14 shrink-0 justify-center border-b">
          <div className="flex items-center justify-between gap-2 group-data-[collapsible=icon]:justify-center">
            <Link
              className="flex min-w-0 items-center gap-2 px-2 py-1.5 font-heading text-base font-semibold group-data-[collapsible=icon]:hidden"
              to="/"
            >
              <Landmark className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{brand}</span>
            </Link>
            <SidebarTrigger className="hidden shrink-0 md:inline-flex" />
          </div>
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
        <SidebarTrigger
          className="absolute top-4 left-4 z-10 bg-background shadow-sm md:hidden"
          variant="outline"
        />
        <main className="flex min-h-0 flex-1 flex-col px-4 pt-16 pb-6 sm:px-6 md:py-6 lg:px-8">
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
