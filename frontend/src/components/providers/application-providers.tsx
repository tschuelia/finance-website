import type { ReactNode } from 'react'
import { ThemeProvider } from 'next-themes'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useState } from 'react'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

type ApplicationProvidersProps = {
  children: ReactNode
}

export const ApplicationProviders = ({ children }: ApplicationProvidersProps) => {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: false,
            refetchOnWindowFocus: false
          }
        }
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <TooltipProvider>
          {children}
          <Toaster closeButton position="top-right" />
        </TooltipProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}
