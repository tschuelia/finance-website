/* cspell:words Monatswähler */

import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from 'lucide-react'
import * as React from 'react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

const monthPattern = /^(\d{4})-(0[1-9]|1[0-2])$/

type ParsedMonth = {
  month: number
  year: number
}

const parseMonth = (value: string): ParsedMonth => {
  const match = monthPattern.exec(value)
  if (match === null) {
    throw new Error(`Invalid ISO month: ${value}`)
  }

  return {
    year: Number(match[1]),
    month: Number(match[2])
  }
}

const isoMonth = (year: number, month: number): string =>
  `${year}-${String(month).padStart(2, '0')}`

const monthIndex = ({ year, month }: ParsedMonth): number => year * 12 + month - 1

const monthDate = ({ year, month }: ParsedMonth): Date => new Date(year, month - 1, 1)

type MonthPickerProps = {
  className?: string
  disabled?: boolean
  endMonth: string
  id?: string
  onValueChange: (value: string) => void
  startMonth: string
  value: string
}

const MonthPicker = ({
  className,
  disabled = false,
  endMonth,
  id,
  onValueChange,
  startMonth,
  value
}: MonthPickerProps) => {
  const selected = parseMonth(value)
  const start = parseMonth(startMonth)
  const end = parseMonth(endMonth)
  const minimum = Math.min(monthIndex(start), monthIndex(end))
  const maximum = Math.max(monthIndex(start), monthIndex(end))
  const startYear = Math.floor(minimum / 12)
  const endYear = Math.floor(maximum / 12)
  const [open, setOpen] = React.useState(false)
  const [visibleYear, setVisibleYear] = React.useState(selected.year)
  const displayedYear = Math.min(Math.max(visibleYear, startYear), endYear)
  const years = Array.from({ length: endYear - startYear + 1 }, (_, index) => endYear - index)
  const currentMonth = parseMonth(isoMonth(new Date().getFullYear(), new Date().getMonth() + 1))

  const changeOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      setVisibleYear(selected.year)
    }
    setOpen(nextOpen)
  }

  return (
    <Popover onOpenChange={changeOpen} open={open}>
      <PopoverTrigger asChild>
        <Button
          aria-label={`Ausgewählter Monat: ${format(monthDate(selected), 'MMMM yyyy', { locale: de })}`}
          className={cn('w-full justify-start font-normal', className)}
          disabled={disabled}
          id={id}
          type="button"
          variant="outline"
        >
          <CalendarIcon data-icon="inline-start" />
          {format(monthDate(selected), 'MMMM yyyy', { locale: de })}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <Button
            aria-label="Vorheriges Jahr"
            disabled={displayedYear <= startYear}
            onClick={() => setVisibleYear(displayedYear - 1)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <ChevronLeftIcon aria-hidden />
          </Button>
          <Select
            onValueChange={(nextYear) => setVisibleYear(Number(nextYear))}
            value={String(displayedYear)}
          >
            <SelectTrigger aria-label="Jahr auswählen" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((year) => (
                <SelectItem key={year} value={String(year)}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            aria-label="Nächstes Jahr"
            disabled={displayedYear >= endYear}
            onClick={() => setVisibleYear(displayedYear + 1)}
            size="icon-sm"
            type="button"
            variant="ghost"
          >
            <ChevronRightIcon aria-hidden />
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-1" role="grid">
          {Array.from({ length: 12 }, (_, index) => {
            const month = index + 1
            const candidate = { year: displayedYear, month }
            const candidateIndex = monthIndex(candidate)
            const isSelected = value === isoMonth(displayedYear, month)
            const isCurrent = monthIndex(candidate) === monthIndex(currentMonth)

            return (
              <Button
                aria-current={isCurrent ? 'date' : undefined}
                aria-label={`${format(monthDate(candidate), 'MMMM yyyy', { locale: de })} auswählen`}
                className={cn(isCurrent && !isSelected && 'bg-muted')}
                disabled={candidateIndex < minimum || candidateIndex > maximum}
                key={month}
                onClick={() => {
                  onValueChange(isoMonth(displayedYear, month))
                  setOpen(false)
                }}
                role="gridcell"
                type="button"
                variant={isSelected ? 'default' : 'ghost'}
              >
                {format(monthDate(candidate), 'MMM', { locale: de })}
              </Button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}

export { MonthPicker }
