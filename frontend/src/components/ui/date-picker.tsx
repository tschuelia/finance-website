/* cspell:words Datumswähler */

import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

type DatePickerProps = {
  value?: Date
  onValueChange?: (value: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

export const DatePicker = ({
  value,
  onValueChange,
  placeholder = 'Datum auswählen',
  disabled = false,
  className
}: DatePickerProps) => {
  const [open, setOpen] = React.useState(false)
  const formattedDate = value === undefined ? undefined : format(value, 'PPP', { locale: de })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          aria-label={
            formattedDate === undefined ? placeholder : `Ausgewähltes Datum: ${formattedDate}`
          }
          className={cn(
            'w-full justify-start font-normal',
            formattedDate === undefined && 'text-muted-foreground',
            className
          )}
        >
          <CalendarIcon data-icon="inline-start" />
          {formattedDate ?? placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(nextValue) => {
            onValueChange?.(nextValue)
            setOpen(false)
          }}
          locale={de}
        />
      </PopoverContent>
    </Popover>
  )
}
