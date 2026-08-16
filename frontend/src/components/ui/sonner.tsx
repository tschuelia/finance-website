'use client'

import { useTheme } from 'next-themes'
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import {
  CircleCheckIcon,
  InfoIcon,
  TriangleAlertIcon,
  OctagonXIcon,
  Loader2Icon
} from 'lucide-react'

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4 text-emerald-700 dark:text-emerald-400" />,
        info: <InfoIcon className="size-4 text-primary" />,
        warning: <TriangleAlertIcon className="size-4 text-amber-600" />,
        error: <OctagonXIcon className="size-4 text-destructive" />,
        loading: <Loader2Icon className="size-4 animate-spin text-muted-foreground" />
      }}
      style={
        {
          '--normal-bg': 'var(--secondary)',
          '--normal-text': 'var(--secondary-foreground)',
          '--normal-border': 'var(--primary)',
          '--border-radius': 'var(--radius)'
        } as React.CSSProperties
      }
      toastOptions={{
        style: {
          background: 'var(--secondary)',
          borderColor: 'var(--primary)',
          color: 'var(--secondary-foreground)',
          transitionProperty: 'transform, height, box-shadow'
        }
      }}
      {...props}
    />
  )
}

export { Toaster }
